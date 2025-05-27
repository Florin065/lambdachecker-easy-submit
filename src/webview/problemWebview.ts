import * as path from "path";
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

  private async createRepository(): Promise<void> {
    const gitExt = vscode.extensions.getExtension("vscode.git")?.exports;
    const git    = gitExt?.getAPI(1);
    if (!git) {
      vscode.window.showErrorMessage("Git extension is not available.");
      return;
    }

    const submissionsPath = SubmissionFile.getSubmissionsFolderPath();
    const repoDirName = `${this.problem.id}_${this.problem.name.trim().replaceAll(" ", "_")}_repo`;
    const repoUri     = vscode.Uri.file(path.join(submissionsPath, repoDirName));

    try {
      try { await vscode.workspace.fs.stat(repoUri); }
      catch { await vscode.workspace.fs.createDirectory(repoUri); }

      await git.init(repoUri);

      if (!git.getRepository(repoUri)) {
        if (typeof git.openRepository === "function") {
          await git.openRepository(repoUri);
        } else {
          await vscode.commands.executeCommand("git.openRepository", repoUri);
        }
      }

      try {
        const ghSession = await vscode.authentication.getSession(
          "github",
          ["repo"],
          { createIfNone: true }
        );
        const token = ghSession.accessToken;

        const ghResp = await fetch("https://api.github.com/user/repos", {
          method: "POST",
          headers: {
            "Authorization": `token ${token}`,
            "Accept": "application/vnd.github+json"
          },
          body: JSON.stringify({
            name: repoDirName,
            private: true
          })
        });

        if (!ghResp.ok) {
          throw new Error(`GitHub API error: ${ghResp.status} ${ghResp.statusText}`);
        }

        const ghRepo = await ghResp.json() as { clone_url: string; ssh_url?: string; [key: string]: any };

        const repo = git.getRepository(repoUri)!;
        await repo.addRemote("origin", ghRepo.clone_url);

        vscode.window.showInformationMessage(`Remote „origin” created at ${ghRepo.clone_url}`);
      } catch (remoteErr) {
        vscode.window.showWarningMessage(
          `Local repository created, but failed to create remote on GitHub: ${(remoteErr as Error).message}`
        );
      }

      this.panel.webview.postMessage({ action: "repo-created" });
      vscode.window.showInformationMessage(`Local repository created at: ${repoUri.fsPath}`);
    }
    catch (err) {
      vscode.window.showErrorMessage(
        `Error creating repository: ${(err as Error).message}`
      );
    }
  }

  private async commitRepository(): Promise<void> {
    const gitExt = vscode.extensions.getExtension("vscode.git")?.exports;
    const git    = gitExt?.getAPI(1);
    if (!git) {
      vscode.window.showErrorMessage("Git extension is not available.");
      return;
    }

    const submissionsPath = SubmissionFile.getSubmissionsFolderPath();
    const baseName  = `${this.problem.id}_${this.problem.name.trim().replaceAll(" ", "_")}`;
    const repoDir   = `${baseName}_repo`;
    const repoUri   = vscode.Uri.file(path.join(submissionsPath, repoDir));

    const srcFileUri  = this.submissionFile.Uri;
    const destFileUri = vscode.Uri.joinPath(repoUri, path.basename(srcFileUri.fsPath));

    try {
      await this.submissionFile.prepareSubmission();
    } catch (err) {
      vscode.window.showErrorMessage(`Error preparing submission file: ${(err as Error).message}`);
      return;
    }

    let copied = false;
    try {
      let shouldCopy = true;
      try {
        const [srcBytes, destBytes] = await Promise.all([
          vscode.workspace.fs.readFile(srcFileUri),
          vscode.workspace.fs.readFile(destFileUri)
        ]);
        if (Buffer.compare(srcBytes, destBytes) === 0) { shouldCopy = false; }
      } catch { }

      if (shouldCopy) {
        await vscode.workspace.fs.copy(srcFileUri, destFileUri, { overwrite: true });
        copied = true;
      }
    } catch (err) {
      vscode.window.showErrorMessage(`Error copying file: ${(err as Error).message}`);
      return;
    }

    if (!copied) {
      vscode.window.showInformationMessage("Identical file already exists in the repository.");
      return;
    }

    let repo = git.getRepository(repoUri);
    if (!repo) {
      try { repo = await git.openRepository?.(repoUri); } catch {}
      if (!repo) {
        await vscode.commands.executeCommand("git.openRepository", repoUri);
        repo = git.getRepository(repoUri);
      }
    }
    if (!repo) {
      vscode.window.showErrorMessage("Git repository could not be opened.");
      return;
    }

    await repo.status();

    const dirty =
      repo.state.indexChanges.length +
      repo.state.workingTreeChanges.length +
      repo.state.mergeChanges.length > 0;

    if (!dirty) {
      vscode.window.showInformationMessage("No changes to commit.");
      return;
    }

    const commitMsg = await vscode.window.showInputBox({
      prompt: "Commit message",
      value: `Problem ${this.problem.id} • ${new Date().toLocaleString()}`
    });
    if (!commitMsg) { return; }

    try {
      await repo.add([]);
      await repo.commit(commitMsg, { all: true });

      vscode.window.showInformationMessage(`Commit successful: ${commitMsg}`);
      this.panel.webview.postMessage({ action: "commit-submitted" });
      
    } catch (err) {
      vscode.window.showErrorMessage(`Error during commit: ${(err as Error).message}`);
    }
  }

private async pushRepository(): Promise<void> {
  const gitExt = vscode.extensions.getExtension("vscode.git")?.exports;
  const git    = gitExt?.getAPI(1);
  if (!git) {
    vscode.window.showErrorMessage("Git API is not available.");
    return;
  }

  const submissions = SubmissionFile.getSubmissionsFolderPath();
  const repoDir     = `${this.problem.id}_${this.problem.name.trim().replaceAll(" ", "_")}_repo`;
  const repoUri     = vscode.Uri.file(path.join(submissions, repoDir));

  let repo = git.getRepository(repoUri)
          ?? await git.openRepository?.(repoUri).catch(() => undefined);
  if (!repo) {
    await vscode.commands.executeCommand("git.openRepository", repoUri);
    repo = git.getRepository(repoUri);
  }
  if (!repo) {
    vscode.window.showErrorMessage("Could not open Git repository.");
    return;
  }

  await repo.fetch("origin").catch(() => {});
  await repo.status();

  let head = repo.state.HEAD;
  if (!head?.name) {
    const newBranch = "main";
    try {
      await vscode.commands.executeCommand(
        "git.checkout",
        { ref: head?.commit, createBranch: newBranch }
      );
      head = repo.state.HEAD!;
      vscode.window.showInformationMessage(`Created and switched to '${newBranch}'.`);
    } catch (e) {
      vscode.window.showErrorMessage(`Error creating branch: ${(e as Error).message}`);
      return;
    }
    await new Promise(res => setTimeout(res, 300));
    await repo.status();
    head = repo.state.HEAD!;
  }

  const localBranch = head.name!;
  const isFirst     = !head.upstream;

  let remoteBranch = localBranch;
  if (isFirst) {
    const allRefs = await (repo as any).getRefs?.() as Array<{ name: string, type: number }>;
    const remoteHeads = allRefs
      .filter(r => r.type === 3 && r.name.startsWith("origin/"))
      .map(r => r.name.replace(/^origin\//, ""));

    if (remoteHeads.includes(localBranch)) {
      remoteBranch = localBranch;
    } else if (remoteHeads.includes("master") && localBranch !== "master") {
      const pick = await vscode.window.showQuickPick(
        [ localBranch, "master" ],
        { placeHolder: `Remote default branches: ${remoteHeads.join(", ")}` }
      );
      if (!pick) {
        vscode.window.showInformationMessage("Push canceled.");
        return;
      }
      remoteBranch = pick;
    } else {
      remoteBranch = localBranch;
    }
  }

  const head2 = repo.state.HEAD!;
  if (!isFirst && head2.ahead === 0) {
    vscode.window.showInformationMessage("No new commits to push.");
    return;
  }

  const refspec = `${localBranch}:${remoteBranch}`;
  try {
    await repo.push("origin", refspec, isFirst);
    const msg = isFirst
      ? `Initial push to ${remoteBranch} successful.`
      : `Push to ${remoteBranch} successful.`;
    vscode.window.showInformationMessage(msg);
    this.panel.webview.postMessage({ action: "push-done" });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Error pushing to remote: ${detail}`);
  }
}


private async pullRepository(): Promise<void> {
  const gitExt = vscode.extensions.getExtension("vscode.git")?.exports;
  const git    = gitExt?.getAPI(1);
  if (!git) {
    vscode.window.showErrorMessage("Git extension is not available.");
    return;
  }

  const submissionsPath = SubmissionFile.getSubmissionsFolderPath();
  const baseName        = `${this.problem.id}_${this.problem.name.trim().replaceAll(" ", "_")}`;
  const repoDir         = `${baseName}_repo`;
  const repoUri         = vscode.Uri.file(path.join(submissionsPath, repoDir));

  let repo = git.getRepository(repoUri)
          ?? await git.openRepository?.(repoUri).catch(() => undefined);
  if (!repo) {
    await vscode.commands.executeCommand("git.openRepository", repoUri);
    repo = git.getRepository(repoUri);
  }
  if (!repo) {
    vscode.window.showErrorMessage("Git repository could not be opened.");
    return;
  }

  await repo.fetch("origin").catch(() => {});
  await repo.status();

  const items: vscode.QuickPickItem[] = [];
  const log = await repo.log({ maxEntries: 20 });
  for (const c of log) {
    items.push({
      label: `$(git-commit) ${c.hash.slice(0,7)}`,
      description: c.message,
      detail: `Local – ${c.authorDate.toLocaleString()}`
    });
  }
  for (const ref of repo.state.refs.filter((r: { type: number; }) => r.type === 3 /* RemoteHead */)) {
    items.push({ label: `$(cloud-download) ${ref.name}`, description: "Remote", detail: ref.commit });
  }
  for (const ref of repo.state.refs.filter((r: { type: number; }) => r.type === 4 /* Tag */)) {
    items.push({ label: `$(tag) ${ref.name}`, description: "Tag", detail: ref.commit });
  }
  const choice = await vscode.window.showQuickPick(items, {
    placeHolder: "Pick a commit or branch to pull",
  });
  if (!choice) { return; }

  const ref = choice.label.split(" ")[1];
  if (!ref) {
    vscode.window.showErrorMessage("No valid reference selected for pull.");
    return;
  }

  try {
    await repo.checkout(ref);
  } catch (err) {
    vscode.window.showErrorMessage(`Error at checkout: ${(err as Error).message}`);
    return;
  }

  const srcFile  = vscode.Uri.joinPath(repoUri, path.basename(this.submissionFile.Uri.fsPath));
  const destFile = this.submissionFile.Uri;
  try {
    await vscode.workspace.fs.copy(srcFile, destFile, { overwrite: true });
  } catch (err) {
    vscode.window.showWarningMessage(
      `Could not copy file from repository: ${(err as Error).message}`
    );
    return;
  }

  this.panel.webview.postMessage({ action: "pull-done" });

  vscode.window.showInformationMessage(`Pulled ${ref} and updated local file.`);
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

      case "create-repo":
        await this.createRepository();
        break;

      case "commit":
        await this.commitRepository();
        break;

      case "push":
        await this.pushRepository();
        break;

      case "pull":
        await this.pullRepository();
        break;
    }
  }
}
