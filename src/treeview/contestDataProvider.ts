import path from "path";
import * as vscode from "vscode";
import { HTTPClient } from "../api";
import { LambdaChecker } from "../commands";
import { defaultFolderIcon, fileIconMapping } from "../icons";
import {
  Contest,
  ContestSubject,
  EnrollmentStatus,
  Language,
  getAcademicYearsRange,
  languageExtensions,
  languageExtensionsById,
  languageIdMapping,
} from "../models";
import { ContestItem } from "./contestItem";
import { ProblemDataProvider } from "./problemDataProvider";
import { ProblemItem } from "./problemItem";

export class ContestDataProvider
  implements vscode.TreeDataProvider<ContestItem | ProblemItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    ContestItem | undefined | null | void
  >();

  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  root: ContestItem[];
  lambdacheckerClient: HTTPClient;
  contestsPromises: Map<ContestSubject, Promise<ContestItem[]>> = new Map();
  archivedContestsPromises: Map<string, Promise<ContestItem[]>> = new Map();
  sessionUnlockedContests: Set<number> = new Set();
  private currentUserId: number;

  constructor(client: HTTPClient) {
    this.lambdacheckerClient = client;
    LambdaChecker.contestDataProvider = this;

    // Create a subroot for each subject and for
    // the archived academical years
    this.root = Object.values(ContestSubject).map((subject) => {
      const childrenItems = getAcademicYearsRange().map(
        (year) =>
          new ContestItem(
            year,
            {
              type: "academic_year",
              subject: subject,
            },
            path.join("/", "contests", subject)
          )
      );

      return new ContestItem(
        subject,
        {
          type: "subject",
          children: childrenItems,
        },
        path.join("/", "contests", subject)
      );
    });

    this.currentUserId = (
      LambdaChecker.userDataCache.get("user") as unknown as Record<
        string,
        unknown
      >
    )["id"] as number;
    this.refresh();
  }

  refresh(contestId?: number) {
    if (contestId === undefined) {
      // Get the remote enrollment status for each of the contests
      this.contestsPromises.clear();
      this.archivedContestsPromises.clear();

      // Create a promise for each subject for fetching contests
      Object.values(ContestSubject).forEach((subject) => {
        this.contestsPromises.set(subject, this.getContestsBySubject(subject));

        getAcademicYearsRange().forEach((year) => {
          this.archivedContestsPromises.set(
            subject + year,
            this.getContestsBySubject(subject, true, year)
          );
        });
      });
    } else {
      // Update the enrollment status for the specific contest
      this.sessionUnlockedContests.add(contestId);
    }

    // Update the current user
    this.currentUserId = (
      LambdaChecker.userDataCache.get("user") as unknown as Record<
        string,
        unknown
      >
    )["id"] as number;

    this._onDidChangeTreeData.fire();
  }

  refreshContestProblems() {
    this._onDidChangeTreeData.fire();
  }

  async getContestsBySubject(
    subject: ContestSubject,
    archived: boolean = false,
    academic_year?: string
  ): Promise<ContestItem[]> {
    let contests: Contest[] = [];

    try {
      const contestsPromises = archived
        ? [
            this.lambdacheckerClient.getArchivedContests(
              academic_year!,
              subject
            ),
          ]
        : [
            this.lambdacheckerClient.getActiveContests(subject),
            this.lambdacheckerClient.getPastContests(subject),
          ];

      contests = await Promise.all(contestsPromises).then((values) => {
        return values.flat();
      });
    } catch (error: any) {
      vscode.window
        .showErrorMessage(
          "Error fetching contests. Would you like to log in again?" +
            "\n" +
            error.message,
          "Go to output"
        )
        .then((selection) => {
          if (selection === "Go to output") {
            LambdaChecker.outputChannel.show();
          }
        });
      return [];
    }

    // Start the requests for status here, and when they are
    // finished, fill in the status for each contest
    const statusPromises = await Promise.all(
      contests.map(
        async (contest) =>
          await this.lambdacheckerClient
            .getEnrollmentStatus(contest.id)
            .catch((error) => {
              LambdaChecker.outputChannel.appendLine(
                "Cannot obtain enrollment status for contest: " +
                  contest.name +
                  error
              );

              return undefined;
            })
      )
    );

    const contestsTreeItems = contests.map(
      (contest, idx) =>
        new ContestItem(
          contest["name"] as string,
          {
            type: "contest",
            contestMetadata: contest,
            hasPassword: contest.password,
            status: statusPromises[idx],
          },
          path.join("/", "contests", subject, contest.name)
        )
    );

    return contestsTreeItems;
  }

  getChildren(
    element?: ContestItem
  ): vscode.ProviderResult<ContestItem[] | ProblemItem[]> {
    if (element === undefined) {
      return this.root;
    }

    switch (element.props.type) {
      case "subject":
        // Concatenate the contests of the current year
        // with new items, one for each archived academic year
        return this.contestsPromises
          .get(element.label as ContestSubject)
          ?.then((contests) => {
            contests.sort(
              (x, y) =>
                new Date(y.props.contestMetadata!.start_date).getTime() -
                new Date(x.props.contestMetadata!.start_date).getTime()
            );

            // Reverse a copy of the list of children
            return [...contests, ...[...element.props.children!].reverse()];
          });
      case "academic_year":
        // Retrieve the archived contests for a specific academic year
        return this.archivedContestsPromises
          .get((element.props.subject! + element.label) as string)
          ?.then((contests) => {
            contests.sort(
              (x, y) =>
                new Date(y.props.contestMetadata!.start_date).getTime() -
                new Date(x.props.contestMetadata!.start_date).getTime()
            );

            return contests;
          });
      case "contest":
        if (element.props.status === EnrollmentStatus.NOT_ENROLLED) {
          return [];
        }

        return element.props.contestMetadata!.problems.map(
          (problem) =>
            new ProblemItem(
              `${problem.id}. ${problem.name}` as string,
              {
                type: "problem",
                difficulty: problem.difficulty,
                language: languageIdMapping[problem.language_id],
                problemMetadata: problem,
                contestMetadata: element.props.contestMetadata,
              },
              path.join(
                element.partialPath,
                `${problem.id}${languageExtensionsById[problem.language_id]}`
              )
            )
        );
      case "problem":
        return [];
      default:
        return [];
    }
  }

  getTreeItem(
    element: ContestItem | ProblemItem
  ): vscode.TreeItem | Thenable<vscode.TreeItem> {
    if (element instanceof ProblemItem) {
      element.command = {
        command: "lambdachecker.show-problem",
        title: "Show Problem",
        arguments: [
          element.props.problemMetadata!.id,
          element.props.contestMetadata,
        ],
      };

      if (
        ProblemDataProvider.ownedProblems.includes(
          element.props.problemMetadata!.id
        )
      ) {
        element.contextValue = "editable-problem";
      } else {
        element.contextValue = "problem";
      }
    } else {
      if (element.props.type === "contest") {
        // Update the status for the contest if it was unlocked during this session
        if (
          this.sessionUnlockedContests.has(element.props.contestMetadata!.id)
        ) {
          element.props.status = EnrollmentStatus.ENROLLED;
        }

        if (element.props.status === EnrollmentStatus.NOT_ENROLLED) {
          element.command = {
            command: "lambdachecker.enroll-in-contest",
            title: "Enroll",
            arguments: [
              element.props.contestMetadata!.id,
              element.props.hasPassword,
              this,
            ],
          };
        } else {
          element.command = undefined;
        }

        // Allow only the creator or the owner to edit a contest
        if (
          element.props.contestMetadata!.user_id === this.currentUserId ||
          element.props.contestMetadata!.collab_id === this.currentUserId
        ) {
          element.contextValue = "editable-contest";
        }
      }
    }

    element.resourceUri = vscode.Uri.from({
      scheme: "lambdachecker",
      // authority: element.props.type,
      path: element.partialPath,
      query: `${
        element instanceof ProblemItem
          ? ""
          : element.props.status
          ? "status=" + element.props.status + "&"
          : ""
      }${
        element instanceof ProblemItem
          ? ""
          : element.props.contestMetadata === undefined
          ? ""
          : `active=${
              new Date(element.props.contestMetadata.end_date) > new Date()
            }&`
      }type=${element.props.type}`,
    });

    return element;
  }
}
