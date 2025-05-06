import * as vscode from "vscode";
import { LambdaChecker } from "../commands";
import { Webview } from "../models";

export enum ViewType {
  UserAllSubmissions = "lambdachecker.webview.user-all-submissions",
  UserSubmissionResult = "lambdachecker.webview.user-submission-result",
  ContestRanking = "lambdachecker.webview.contest-ranking",
  ProblemStatement = "lambdachecker.webview.problem-statement",
}

const deduplicatedViewTypes = new Set<ViewType>([
  ViewType.ProblemStatement,
  ViewType.ContestRanking,
]);

/**
 * Class used for tracking the active Webviews and listeners
 */
export class WebviewFactory {
  static openWebviews: Map<string, Map<string, Webview>> = new Map();

  static async showWebview(title: string) {
    if (this.openWebviews.has(title)) {
    }
  }

  static createWebview(
    viewType: ViewType,
    title: string,
    listener?: (e: any) => any
  ): Webview {
    if (!Object.values(ViewType).includes(viewType)) {
      throw new Error("Invalid viewType");
    }

    if (
      deduplicatedViewTypes.has(viewType) &&
      this.openWebviews.has(viewType)
    ) {
      const desiredWebview = this.openWebviews.get(viewType)!.get(title);

      if (desiredWebview !== undefined) {
        desiredWebview.webviewPanel.reveal();
        return desiredWebview;
      }
    }

    const newWebview = new Webview(
      viewType,
      title,
      viewType === ViewType.UserAllSubmissions
        ? {
            viewColumn: vscode.ViewColumn.Two,
            preserveFocus: false,
          }
        : viewType === ViewType.UserSubmissionResult
        ? {
            viewColumn: vscode.ViewColumn.Two,
            preserveFocus: false,
          }
        : viewType === ViewType.ContestRanking
        ? {
            viewColumn: vscode.ViewColumn.One,
            preserveFocus: false,
          }
        : viewType === ViewType.ProblemStatement
        ? {
            viewColumn: vscode.ViewColumn.One,
            preserveFocus: false,
          }
        : {
            viewColumn: vscode.ViewColumn.Three,
            preserveFocus: false,
          },
      viewType === ViewType.UserAllSubmissions
        ? {
            enableScripts: true,
            enableFindWidget: true,
          }
        : viewType === ViewType.UserSubmissionResult
        ? {
            enableScripts: true,
            enableFindWidget: true,
          }
        : viewType === ViewType.ContestRanking
        ? {
            enableScripts: true,
            enableFindWidget: true,
            localResourceRoots: [
              vscode.Uri.joinPath(
                LambdaChecker.context.extensionUri,
                "resources"
              ),
            ],
            retainContextWhenHidden: true,
          }
        : viewType === ViewType.ProblemStatement
        ? {
            enableScripts: true,
            enableFindWidget: true,
            localResourceRoots: [
              vscode.Uri.joinPath(
                LambdaChecker.context.extensionUri,
                "resources"
              ),
            ],
            retainContextWhenHidden: true,
          }
        : {
            enableScripts: true,
            enableFindWidget: true,
          }
    );

    if (listener !== undefined) {
      newWebview.addListener(listener);
    }

    newWebview.webviewPanel.onDidDispose(() => {
      this.openWebviews.get(viewType)?.delete(title);
    });

    if (!this.openWebviews.has(viewType)) {
      this.openWebviews.set(viewType, new Map<string, Webview>());
    }

    this.openWebviews.get(viewType)!.set(title, newWebview);
    return newWebview;
  }

  static addListenerForWebview(
    viewType: string,
    title: string,
    listener: (e: any) => any
  ) {
    if (!this.openWebviews.has(viewType)) {
      this.openWebviews.set(viewType, new Map<string, Webview>());
    }

    this.openWebviews.get(viewType)!.get(title)?.addListener(listener);
  }

  static disposeListenersForWebview(viewType: string, title: string) {
    if (!this.openWebviews.has(viewType)) {
      this.openWebviews.set(viewType, new Map<string, Webview>());
    }

    this.openWebviews.get(viewType)!.get(title)?.disposeListeners();
  }
}
