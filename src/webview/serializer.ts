import * as vscode from "vscode";
import { LambdaChecker } from "../commands";
import { Contest, SpecificProblem, getProblemWebviewContent } from "../models";
import { getProblemHTML } from "../models/webview/htmlTemplates";
import { ProblemWebview } from "./problemWebview";

export class ProblemWebviewSerializer implements vscode.WebviewPanelSerializer {
  async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
    const problem: SpecificProblem = state.problem;
    const contestMetadata: Contest | undefined = state.contestMetadata;

    const problemWebview = new ProblemWebview(
      problem,
      webviewPanel,
      contestMetadata
    );

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      problemWebview.webviewListener(message);
    });

    const scriptsPath = vscode.Uri.joinPath(
      LambdaChecker.context.extensionUri,
      "resources",
      "scripts",
      "problemView.js"
    );
    const stylesPath = vscode.Uri.joinPath(
      LambdaChecker.context.extensionUri,
      "resources",
      "styles",
      "problemView.css"
    );

    webviewPanel.webview.html = getProblemHTML(
      webviewPanel.webview.asWebviewUri(scriptsPath),
      webviewPanel.webview.asWebviewUri(stylesPath),
      problem,
      contestMetadata
    );
  }
}
