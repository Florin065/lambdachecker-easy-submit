// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { LambdaChecker } from "./commands";
import {
  Contest,
  EnrollmentStatus,
  SpecificProblem,
  StatusBar,
  Storage,
} from "./models";
import {
  ContestDataProvider,
  ContestItem,
  ProblemDataProvider,
  ProblemItem,
} from "./treeview";
import { ProblemWebviewSerializer, ViewType } from "./webview";

interface ProblemProps {
  title: string;
  description: string;
  skel: string;
}

export async function activate(context: vscode.ExtensionContext) {
  try {
    Storage.setContext(context);
    LambdaChecker.context = context;

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "lambdachecker.login",
        LambdaChecker.login
      ),
      vscode.commands.registerCommand(
        "lambdachecker.logout",
        LambdaChecker.logout
      ),
      vscode.commands.registerCommand(
        "lambdachecker.show-problem",
        (problemId: number, contestMetadata?: Contest) =>
          LambdaChecker.showProblem(problemId, contestMetadata)
      ),
      vscode.commands.registerCommand(
        "lambdachecker.enroll-in-contest",
        LambdaChecker.enrollInContest
      ),
      vscode.commands.registerCommand(
        "lambdachecker.create-contest",
        LambdaChecker.createContest
      ),
      vscode.commands.registerCommand(
        "lambdachecker.edit-contest",
        (context: ContestItem) =>
          LambdaChecker.editContest(context.props.contestMetadata!.id)
      ),
      vscode.commands.registerCommand(
        "lambdachecker.create-problem",
        LambdaChecker.createProblem
      ),
      vscode.commands.registerCommand(
        "lambdachecker.edit-problem",
        (context: ProblemItem) =>
          LambdaChecker.editProblem(context.props.problemMetadata!.id)
      ),
      vscode.commands.registerCommand("lambdachecker.refresh-contests", () =>
        LambdaChecker.contestDataProvider.refresh()
      ),
      vscode.commands.registerCommand("lambdachecker.refresh-problems", () =>
        LambdaChecker.problemDataProvider.refresh()
      )
    );
    context.subscriptions.push(StatusBar.statusBarItem);
    context.subscriptions.push(
      vscode.window.registerFileDecorationProvider({
        provideFileDecoration: (uri: vscode.Uri) => {
          if (uri.scheme !== "lambdachecker") {
            return;
          }

          const queryParams = new URLSearchParams(uri.query);
          const isLockedContest =
            queryParams.get("status") === EnrollmentStatus.NOT_ENROLLED;
          const isActiveContest = queryParams.get("active") === "true";

          let badge = "";
          let tooltip = "";

          if (isActiveContest) {
            badge += "\u{1F7E2}";
            tooltip += "Active";
          }

          if (isLockedContest) {
            badge += "\u{1F512}";
            tooltip += (tooltip === "" ? "" : " \u{2022} ") + "Locked";
          }

          return {
            badge: badge || undefined,
            tooltip: tooltip || undefined,
          };
        },
      })
    );

    vscode.window.registerWebviewPanelSerializer(
      ViewType.ProblemStatement,
      new ProblemWebviewSerializer()
    );

    const loggedInUsername = await LambdaChecker.getLoginStatus();
    if (loggedInUsername !== undefined) {
      StatusBar.updateStatus(loggedInUsername);

      const user = LambdaChecker.userDataCache.get("user") as unknown as Record<
        string,
        unknown
      >;

      // Update the role seen by the extension
      if (user["role"] === "teacher") {
        vscode.commands.executeCommand(
          "setContext",
          "lambdachecker.teacher",
          true
        );
      }

      const contestsTreeView = vscode.window.createTreeView(
        "lambdachecker.contests",
        {
          treeDataProvider: new ContestDataProvider(LambdaChecker.client),
          showCollapseAll: true,
        }
      );

      const problemsTreeView = vscode.window.createTreeView(
        "lambdachecker.problems",
        {
          treeDataProvider: new ProblemDataProvider(LambdaChecker.client),
          showCollapseAll: true,
        }
      );
    } else {
      StatusBar.updateStatus();
    }
  } catch (error) {
    console.error(error);
  }
}

export function deactivate() {}
