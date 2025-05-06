import * as vscode from "vscode";
import { LambdaChecker } from "../commands";
import { CreateContestWebviewMessage } from "../models";

export class CreateContestListener {
  constructor(
    public panel: vscode.WebviewPanel,
    private newContest: boolean = true,
    private contestId?: number
  ) {}

  async webviewListener(message: CreateContestWebviewMessage) {
    if (message.action === "submitContestForm") {
      try {
        const response = await (this.newContest
          ? LambdaChecker.client.createContest(message.contestData)
          : LambdaChecker.client.editContest(
              this.contestId!,
              message.contestData
            ));

        LambdaChecker.contestDataProvider.refresh();
        vscode.window.showInformationMessage(
          `Successfully ${this.newContest ? "created" : "edited"} Contest ${
            response.id
          }: ${message.contestData.name}!`
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
    }
  }
}
