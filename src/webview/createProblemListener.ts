import * as vscode from "vscode";
import { LambdaChecker } from "../commands";
import { CreateProblemWebviewMessage, SpecificProblem } from "../models";
import { SubmissionFile } from "../storage";

export class CreateProblemListener {
  private submissionFile?: SubmissionFile;

  constructor(
    public panel: vscode.WebviewPanel,
    private newProblem: boolean = true,
    private problemData?: SpecificProblem
  ) {}

  async webviewListener(message: CreateProblemWebviewMessage) {
    const uploadOptions: vscode.OpenDialogOptions = {
      canSelectFiles: true,
      canSelectFolders: false,
      title: "Upload From",
    };

    switch (message.action) {
      case "uploadTestFile":
        vscode.window.showOpenDialog(uploadOptions).then(async (fileUri) => {
          if (fileUri && fileUri[0]) {
            const fileContent = await vscode.workspace.fs.readFile(fileUri[0]);

            this.panel.webview.postMessage({
              action: "uploadTestFileResponse",
              testId: message.testId,
              data: fileContent.toString(),
            });
          }
        });
        break;
      case "openSkeletonFile":
        if (this.submissionFile === undefined) {
          this.submissionFile = new SubmissionFile(
            0,
            message.problemData!.name,
            message.problemData!.language,
            ""
          );
        }
        this.submissionFile.openInEditor();

        break;
      case "uploadSkeletonFile":
        vscode.window.showOpenDialog(uploadOptions).then(async (fileUri) => {
          if (fileUri && fileUri[0]) {
            // Read the file
            const fileContent = await vscode.workspace.fs.readFile(fileUri[0]);

            // Return the content to the webview
            this.panel.webview.postMessage({
              action: "uploadSkeletonFileResponse",
              data: fileContent.toString(),
            });
          }
        });
        break;
      case "sendRequestToApi":
        const { skeleton_source_is_local, ...createProblemData } =
          message.problemData!;

        if (skeleton_source_is_local === true) {
          createProblemData.skeleton =
            (await this.submissionFile?.readSubmissionFile())?.toString() || "";
        }

        try {
          const response = await (this.newProblem
            ? LambdaChecker.client.createProblem(createProblemData)
            : LambdaChecker.client.editProblem(
                this.problemData!.id,
                createProblemData
              ));

          LambdaChecker.problemDataProvider.refresh();
          vscode.window.showInformationMessage(
            `Successfully ${this.newProblem ? "created" : "edited"} Problem ${
              message.problemData!.name
            }!`
          );
          this.panel.dispose();
        } catch (error: any) {
          vscode.window
            .showErrorMessage(error.message, "Go to output")
            .then((selection) => {
              if (selection === "Go to output") {
                LambdaChecker.outputChannel.show();
              }
            });
        }

        break;
    }
  }
}
