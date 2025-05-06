import * as vscode from "vscode";

export class StatusBar {
  static readonly statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left
  );

  static {
    this.statusBarItem.command = "lambdachecker.login";
    this.statusBarItem.show();
  }

  public static updateStatus(username?: string) {
    if (username !== undefined) {
      this.statusBarItem.text = `\u03BB Checker: ${username}`;
    } else {
      this.statusBarItem.text = "\u03BB Checker: Sign in";
    }
  }
}
