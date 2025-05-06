import * as vscode from "vscode";

import path from "path";
import { HTTPClient } from "../api";
import { LambdaChecker } from "../commands";
import {
  BaseProblem,
  Difficulty,
  Language,
  SpecificProblem,
  languageExtensions,
} from "../models";
import { ProblemItem } from "./problemItem";

export class ProblemDataProvider
  implements vscode.TreeDataProvider<ProblemItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    ProblemItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  root: ProblemItem[];
  lambdacheckerClient: HTTPClient;
  problemsPromise: Promise<ProblemItem[]>;

  // Attribute useful only for teachers, to allow
  // editing only the problems created by them
  static ownedProblems: number[] = [];
  static currentUserRole: string = "student";

  constructor(client: HTTPClient) {
    this.lambdacheckerClient = client;
    LambdaChecker.problemDataProvider = this;

    this.root = Object.values(Language).map((language) => {
      const childrenItems = Object.values(Difficulty).map(
        (difficulty) =>
          new ProblemItem(
            difficulty,
            {
              type: "difficulty",
              difficulty: difficulty,
              language: language,
            },
            path.join("/", "problems", language, difficulty)
          )
      );

      return new ProblemItem(
        language,
        {
          type: "programming-language",
          language: language,
          children: childrenItems,
        },
        path.join("/", "problems", language)
      );
    });

    this.problemsPromise = this.getAllProblems();
    this.refresh();
  }

  refresh() {
    this.problemsPromise = this.getAllProblems();
    ProblemDataProvider.currentUserRole = (
      LambdaChecker.userDataCache.get("user") as unknown as Record<
        string,
        unknown
      >
    )["role"] as string;

    if (ProblemDataProvider.currentUserRole === "teacher") {
      LambdaChecker.client.getOwnedProblems().then((problems) => {
        ProblemDataProvider.ownedProblems = problems.map(
          (problem) => problem.id
        );

        this._onDidChangeTreeData.fire();
        LambdaChecker.contestDataProvider.refreshContestProblems();

        return ProblemDataProvider.ownedProblems;
      });
    }

    this._onDidChangeTreeData.fire();
  }

  async getAllProblems(): Promise<ProblemItem[]> {
    return this.lambdacheckerClient
      .getProblems()
      .then((problems: BaseProblem[]) => {
        return problems.map(
          (problem) =>
            new ProblemItem(`${problem.id}. ${problem.name}` as string, {
              type: "problem",
              difficulty: problem.difficulty,
              language: problem.language,
              problemMetadata: problem,
            })
        );
      })
      .catch((error: any) => {
        return vscode.window
          .showErrorMessage(
            "Error fetching problems. Would you like to try again?\n" +
              error.message,
            "Go to output"
          )
          .then((selection) => {
            if (selection === "Go to output") {
              LambdaChecker.outputChannel.show();
            }

            return [];
          });
      });
  }

  async getProblemsByDifficultyAndLanguage(
    difficulty: Difficulty,
    language: Language
  ): Promise<ProblemItem[]> {
    const problemsTreeItemsPromise = this.problemsPromise.then((problems) =>
      problems.filter(
        (problem) =>
          problem.props.difficulty === difficulty &&
          problem.props.language === language
      )
    );

    return problemsTreeItemsPromise;
  }

  getChildren(element?: ProblemItem): vscode.ProviderResult<ProblemItem[]> {
    if (element === undefined) {
      return this.root;
    }

    switch (element.props.type) {
      case "programming-language":
        return element.props.children;
      case "difficulty":
        return this.getProblemsByDifficultyAndLanguage(
          element.props.difficulty as Difficulty,
          element.props.language as Language
        );
      case "problem":
        return [];
      default:
        return [];
    }
  }

  getTreeItem(
    element: ProblemItem
  ): vscode.TreeItem | Thenable<vscode.TreeItem> {
    if (element.props.type === "problem") {
      element.command = {
        command: "lambdachecker.show-problem",
        title: "Show Problem",
        arguments: [element.props.problemMetadata!.id],
      };

      element.partialPath = path.join(
        "/",
        element.props.language as string,
        element.props.difficulty as string,
        `${element.props.problemMetadata!.id}${
          languageExtensions[element.props.language as Language]
        }`
      );

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
      element.contextValue = element.props.type;
    }

    element.resourceUri = vscode.Uri.from({
      scheme: "lambdachecker",
      // authority: element.props.type,
      path: element.partialPath,
    });

    return element;
  }
}
