import path from "path";
import * as vscode from "vscode";
import { LambdaChecker } from "../commands";
import {
  Contest,
  RunOutput,
  SpecificProblem,
  SubmissionResult,
  WebviewMessage,
} from "../models";
import { SubmissionFile } from "../storage";
import { ProblemSubmissionWebviewListener } from "./problemSubmissionWebviewListener";
import { ViewType, WebviewFactory } from "./webviewFactory";

export class ProblemWebview {
  public submissionFile: SubmissionFile;
  private static apiCooldown = 100;
  private static maxApiConsecutiveRequests = 50;
  private createdAllSubmissionsWebview = false;
  private submissionsPanel?: vscode.WebviewPanel;
  private submissionsListener?: ProblemSubmissionWebviewListener;

  constructor(
    public problem: SpecificProblem,
    public panel: vscode.WebviewPanel,
    public contestMetadata?: Contest
  ) {
    this.submissionFile = new SubmissionFile(
      problem.id,
      problem.name,
      problem.language,
      problem.skeleton?.code || ""
    );
  }

  async waitForSubmitionProcessing(
    contestId?: number
  ): Promise<SubmissionResult | undefined> {
    let stopPolling = false;

    LambdaChecker.client
      .submitSolution(
        this.problem.id,
        contestId ? contestId : -1,
        await this.submissionFile.readSubmissionFile()
      )
      .catch((error) => {
        stopPolling = true;
        vscode.window
          .showErrorMessage(error.message, "Go to output")
          .then((selection) => {
            if (selection === "Go to output") {
              LambdaChecker.outputChannel.show();
            }
          });
      });

    const getSubmissionsSafe = async () => {
      return LambdaChecker.client
        .getSubmissions(this.problem.id)
        .catch((error) => {
          vscode.window
            .showErrorMessage(error.message, "Go to output")
            .then((selection) => {
              if (selection === "Go to output") {
                LambdaChecker.outputChannel.show();
              }
            });

          return [] as SubmissionResult[];
        });
    };
    const submissions = await getSubmissionsSafe();

    let currentCooldown = 0;
    let iterations = 0;

    const res = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `[${this.problem.name}] Submitting your source code...`,
        cancellable: false,
      },
      (progress) => {
        return new Promise<SubmissionResult | undefined>((resolve) => {
          let poller = setTimeout(async function loop() {
            const currentSubmissions = await getSubmissionsSafe();

            if (currentSubmissions.length > submissions.length) {
              clearInterval(poller);
              const lastSubmissionResult =
                currentSubmissions[currentSubmissions.length - 1];

              resolve(lastSubmissionResult);
              return;
            }

            if (stopPolling) {
              clearInterval(poller);
              resolve(undefined);
              return;
            }

            if (iterations === ProblemWebview.maxApiConsecutiveRequests) {
              clearInterval(poller);
              vscode.window
                .showErrorMessage(
                  "Submission is taking too long to load, try again in a few seconds",
                  "Go to output"
                )
                .then((selection) => {
                  if (selection === "Go to output") {
                    LambdaChecker.outputChannel.show();
                  }
                });
              resolve(undefined);
              return;
            }

            iterations += 1;
            currentCooldown += ProblemWebview.apiCooldown;

            poller = setTimeout(loop, currentCooldown);
          }, currentCooldown);
        });
      }
    );

    return res;
  }

  async webviewListener(message: WebviewMessage) {
    const uploadOptions: vscode.OpenDialogOptions = {
      canSelectFiles: true,
      canSelectFolders: false,
      title: "Upload From",
    };

    switch (message.action) {
      case "code":
        this.submissionFile.openInEditor();
        break;
      case "restore-skeleton":
        this.submissionFile.problemSkel = this.problem.skeleton?.code || "";
        this.submissionFile.openInEditor(true);
        break;
      case "edit-problem":
        LambdaChecker.editProblem(this.problem.id);
        break;
      case "contest-ranking":
        LambdaChecker.showContestRanking(this.contestMetadata!);
        break;
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
      case "run":
        const executionResultPromise = LambdaChecker.client.runSolution(
          this.problem.id,
          (await this.submissionFile.readSubmissionFile()).toString(),
          message.tests!
        );

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `[${this.problem.name}] Compiling and running your source code...`,
            cancellable: false,
          },
          () =>
            executionResultPromise
              .then((result) => {
                LambdaChecker.showSubmissionResult(
                  result,
                  this.problem.name,
                  message.tests!,
                  this.problem.language,
                  true
                );
              })
              .catch((error) => {
                vscode.window
                  .showErrorMessage(error.message, "Go to output")
                  .then((selection) => {
                    if (selection === "Go to output") {
                      LambdaChecker.outputChannel.show();
                    }
                  });
              })
        );

        break;
      case "submit":
        const submissionResult = await this.waitForSubmitionProcessing(
          message.contestId
        );

        if (submissionResult !== undefined) {
          await LambdaChecker.showSubmissionResult(
            submissionResult,
            this.problem.name,
            this.problem.tests,
            this.problem.language
          );
        }
        break;
      case "view-submissions":
        if (this.createdAllSubmissionsWebview === false) {
          this.createdAllSubmissionsWebview = true;

          // Create only one webview panel for the submissions table
          const submissionsWebviewWrapper = WebviewFactory.createWebview(
            ViewType.UserAllSubmissions,
            `${this.problem.id}. ${this.problem.name}`
          );
          this.submissionsPanel = submissionsWebviewWrapper.webviewPanel;

          this.submissionsListener = new ProblemSubmissionWebviewListener(
            this.problem.id,
            this.problem.name,
            this.problem.language,
            "",
            this.submissionsPanel,
            this.problem.tests
          );

          this.submissionsPanel.webview.onDidReceiveMessage(async (message) => {
            this.submissionsListener!.webviewListener(message);
          });

          this.submissionsPanel.onDidDispose(() => {
            this.createdAllSubmissionsWebview = false;
          });

          // Message sent by postMessage doesn't reach
          // otherwise the submissionPanelListener
          const bounceOffDummyHTML = `
          <html>
            <script>
            const vscode = acquireVsCodeApi();

            window.addEventListener('message', event => {
              vscode.postMessage({
                action: "view-all-submissions",
              });
            });
            </script>
          </html>
          `;

          this.submissionsPanel!.webview.html = bounceOffDummyHTML;
          this.submissionsPanel!.webview.postMessage({});
        } else {
          this.submissionsPanel!.reveal();
        }

        break;
      case "download-tests":
        const downloadOptions: vscode.OpenDialogOptions = {
          canSelectFiles: false,
          canSelectFolders: true,
          title: "Download To",
        };

        vscode.window.showOpenDialog(downloadOptions).then(async (fileUri) => {
          if (!(fileUri && fileUri[0])) {
            return;
          }

          const inputPaths: string[] = [];
          const outputPaths: string[] = [];

          const testsPromises = this.problem.tests.map((test, index) => {
            const inputPath = path.join(fileUri[0].path, `test${index}.in`);
            const outputPath = path.join(fileUri[0].path, `test${index}.out`);

            inputPaths.push(inputPath);
            outputPaths.push(outputPath);

            return [
              vscode.workspace.fs.writeFile(
                vscode.Uri.file(inputPath),
                Buffer.from(test.input || "")
              ),
              vscode.workspace.fs.writeFile(
                vscode.Uri.file(outputPath),
                Buffer.from(test.output || "")
              ),
            ];
          });

          Promise.all(testsPromises.flat()).then(async () => {
            const alternateInOut = inputPaths
              .map((inputPath, index) => [inputPath, outputPaths[index]])
              .flat();

            for (let i = 0; i < inputPaths.length; i++) {
              await vscode.window.showTextDocument(
                vscode.Uri.file(inputPaths[i]),
                {
                  viewColumn: vscode.ViewColumn.Two,
                  preview: false,
                  preserveFocus: true,
                }
              );

              await vscode.window.showTextDocument(
                vscode.Uri.file(outputPaths[i]),
                {
                  viewColumn: vscode.ViewColumn.Three,
                  preview: false,
                  preserveFocus: true,
                }
              );
            }

            await vscode.window.showTextDocument(
              vscode.Uri.file(outputPaths[0]),
              {
                viewColumn: vscode.ViewColumn.Three,
                preview: false,
                preserveFocus: true,
              }
            );

            await vscode.window.showTextDocument(
              vscode.Uri.file(inputPaths[0]),
              {
                viewColumn: vscode.ViewColumn.Two,
                preview: false,
                preserveFocus: false,
              }
            );
          });
        });

        break;
    }
  }
}
