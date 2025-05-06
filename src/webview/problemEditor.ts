import * as vscode from "vscode";
import { SubmissionFile } from "../storage";

export class ProblemEditor {
  static async show(submissionFile: SubmissionFile) {
    const codeEditor = vscode.window.showTextDocument(submissionFile.Uri, {
      preview: false,
      preserveFocus: false,
      viewColumn: vscode.ViewColumn.Two,
    });
  }
}
