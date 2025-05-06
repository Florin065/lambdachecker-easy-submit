import * as vscode from "vscode";
import { SpecificProblem } from "../api";

/**
 * Proxy class for vscode.WebviewPanel, used to store
 * addition data about the content displayed in the view
 */
export class Webview {
  public webviewPanel: vscode.WebviewPanel;
  private listeners: vscode.Disposable[] = [];

  constructor(
    public viewType: string,
    public title: string,
    showOptions:
      | vscode.ViewColumn
      | {
          viewColumn: vscode.ViewColumn;
          preserveFocus: boolean;
        },
    options?: vscode.WebviewPanelOptions & vscode.WebviewOptions,
    public problem?: SpecificProblem // Only for problem views
  ) {
    this.webviewPanel = vscode.window.createWebviewPanel(
      viewType,
      title,
      showOptions,
      options
    );

    this.webviewPanel.onDidDispose(() => {
      this.listeners.forEach((listener) => {
        console.log("Disposing listener", listener);
        listener.dispose();
      });
    });
  }

  public addListener(listener: (e: any) => any) {
    const disposableListener =
      this.webviewPanel.webview.onDidReceiveMessage(listener);

    this.listeners.push(disposableListener);
  }

  public disposeListeners() {
    this.listeners.forEach((listener) => {
      listener.dispose();
    });
    this.listeners.length = 0;
  }
}
