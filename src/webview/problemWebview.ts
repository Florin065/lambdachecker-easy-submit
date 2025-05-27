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


  /**
   * Creează repo local + remote GitHub ("origin") pentru problema curentă.
   * În interiorul clasei care conține `this.problem` și `this.panel`.
   */
  private async createRepository(): Promise<void> {
    /* ───────────────────────────────────────────────────────────────────────┐
      1. Găsește API-ul Git
    ──────────────────────────────────────────────────────────────────────────*/
    const gitExt = vscode.extensions.getExtension("vscode.git")?.exports;
    const git    = gitExt?.getAPI(1);
    if (!git) {
      vscode.window.showErrorMessage("Extensia Git nu este disponibilă.");
      return;
    }

    /* ───────────────────────────────────────────────────────────────────────┐
      2. Construiește căile locale
    ──────────────────────────────────────────────────────────────────────────*/
    const submissionsPath = SubmissionFile.getSubmissionsFolderPath();
    const repoDirName = `${this.problem.id}_${this.problem.name.trim().replaceAll(" ", "_")}_repo`;
    const repoUri     = vscode.Uri.file(path.join(submissionsPath, repoDirName));

    try {
      /* Creează directorul dacă lipsește */
      try { await vscode.workspace.fs.stat(repoUri); }
      catch { await vscode.workspace.fs.createDirectory(repoUri); }

      /* ───────────────────────────────────────────────────────────────────┐
        3. Inițializează repo-ul local
      ──────────────────────────────────────────────────────────────────────*/
      await git.init(repoUri);                         // echivalent `git init`

      /* Adaugă repo-ul la extensia Git (dacă nu s-a adăugat implicit) */
      if (!git.getRepository(repoUri)) {
        if (typeof git.openRepository === "function") {
          await git.openRepository(repoUri);
        } else {
          await vscode.commands.executeCommand("git.openRepository", repoUri);
        }
      }

      /* ───────────────────────────────────────────────────────────────┐
        4. Creează remote „origin” pe GitHub folosind contul VS Code
      ──────────────────────────────────────────────────────────────────*/
      try {
        /* 4.1  Obține token GitHub (scope repo) */
        const ghSession = await vscode.authentication.getSession(
          "github",               // provider
          ["repo"],               // scope minim pentru repo-uri
          { createIfNone: true }  // deschide dialog OAuth dacă e nevoie
        );
        const token = ghSession.accessToken;

        /* 4.2  Creează repo pe GitHub (nume = id_name) */
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
          throw new Error(`GitHub API a răspuns cu status ${ghResp.status}`);
        }

        const ghRepo = await ghResp.json() as { clone_url: string; ssh_url?: string; [key: string]: any }; // clone_url, ssh_url etc.

        /* 4.3  Înregistrează remote-ul în repo-ul local */
        const repo = git.getRepository(repoUri)!;
        await repo.addRemote("origin", ghRepo.clone_url);

        vscode.window.showInformationMessage(`Remote „origin” creat pe GitHub: ${ghRepo.clone_url}`);
      } catch (remoteErr) {
        vscode.window.showWarningMessage(
          `Repo local creat, dar remote-ul GitHub NU a fost adăugat: ${(remoteErr as Error).message}`
        );
      }

      /* ───────────────────────────────────────────────────────────────┐
        5. Trimite feedback către web-view
      ──────────────────────────────────────────────────────────────────*/
      this.panel.webview.postMessage({ action: "repo-created" });
      vscode.window.showInformationMessage(`Repository local „${repoDirName}” a fost creat cu succes.`);
    }
    /* ──────────────────────────────────────────────────────────────────────*/
    catch (err) {
      vscode.window.showErrorMessage(
        `Eroare la crearea repository-ului: ${(err as Error).message}`
      );
    }
  }

  private async commitRepository(): Promise<void> {
    console.log("Committing…");

    /* 0. Git API ------------------------------------------------------------ */
    const gitExt = vscode.extensions.getExtension("vscode.git")?.exports;
    const git    = gitExt?.getAPI(1);
    if (!git) {
      vscode.window.showErrorMessage("Extensia Git nu este disponibilă.");
      return;
    }

    /* 1. Căi utile ---------------------------------------------------------- */
    const submissionsPath = SubmissionFile.getSubmissionsFolderPath();
    const baseName  = `${this.problem.id}_${this.problem.name.trim().replaceAll(" ", "_")}`;
    const repoDir   = `${baseName}_repo`;
    const repoUri   = vscode.Uri.file(path.join(submissionsPath, repoDir));

    const srcFileUri  = this.submissionFile.Uri;                     // soluţia generată
    const destFileUri = vscode.Uri.joinPath(repoUri, path.basename(srcFileUri.fsPath));

    /* 2. Actualizează fişierul soluţie ------------------------------------- */
    try {
      await this.submissionFile.prepareSubmission();                 // codul tău custom
    } catch (err) {
      vscode.window.showErrorMessage(`Eroare la pregătirea fişierului: ${(err as Error).message}`);
      return;
    }

    /* 3. Copiază doar dacă există diferenţe -------------------------------- */
    let copied = false;
    try {
      let shouldCopy = true;
      try {
        const [srcBytes, destBytes] = await Promise.all([
          vscode.workspace.fs.readFile(srcFileUri),
          vscode.workspace.fs.readFile(destFileUri)
        ]);
        if (Buffer.compare(srcBytes, destBytes) === 0) { shouldCopy = false; }
      } catch { /* destFile încă nu există → îl copiem */ }

      if (shouldCopy) {
        await vscode.workspace.fs.copy(srcFileUri, destFileUri, { overwrite: true });
        copied = true;
      }
    } catch (err) {
      vscode.window.showErrorMessage(`Eroare la copierea fişierului: ${(err as Error).message}`);
      return;
    }

    if (!copied) {
      vscode.window.showInformationMessage("Fişier identic – nimic de comis.");
      return;
    }

    /* 4. Deschide repo-ul dacă nu e deja cunoscut -------------------------- */
    let repo = git.getRepository(repoUri);
    if (!repo) {
      try { repo = await git.openRepository?.(repoUri); } catch {}
      if (!repo) {
        await vscode.commands.executeCommand("git.openRepository", repoUri);
        repo = git.getRepository(repoUri);
      }
    }
    if (!repo) {
      vscode.window.showErrorMessage("Repository-ul Git nu a putut fi deschis.");
      return;
    }

    /* 5. Reîmprospătează & verifică modificările --------------------------- */
    await repo.status();   // obliga Git API să recalculeze working tree

    const dirty =
      repo.state.indexChanges.length +
      repo.state.workingTreeChanges.length +
      repo.state.mergeChanges.length > 0;

    if (!dirty) {      // ar trebui să nu se întâmple, dar pentru siguranţă
      vscode.window.showInformationMessage("Nu există modificări de comis.");
      return;
    }

    /* 6. Cere mesajul de commit -------------------------------------------- */
    const commitMsg = await vscode.window.showInputBox({
      prompt: "Commit message",
      value: `Problema ${this.problem.id} • ${new Date().toLocaleString()}`
    });
    if (!commitMsg) { return; }   // utilizatorul a anulat

    /* 7. Stage + commit ----------------------------------------------------- */
    try {
      // stage-uim TOT ce e modificat
      await repo.add([]);                       // [] = toate fişierele schimbate
      await repo.commit(commitMsg, { all: true });

      vscode.window.showInformationMessage(`Commit realizat cu succes în ${repoDir}.`);
      this.panel.webview.postMessage({ action: "commit-submitted" });
    } catch (err) {
      vscode.window.showErrorMessage(`Eroare la commit: ${(err as Error).message}`);
    }
  }

private async pushRepository(): Promise<void> {
  console.log("Pushing…");

  // 0. Obţine Git API
  const gitExt = vscode.extensions.getExtension("vscode.git")?.exports;
  const git    = gitExt?.getAPI(1);
  if (!git) {
    vscode.window.showErrorMessage("Git API nu e disponibilă.");
    return;
  }

  // 1. Calculează repoUri
  const submissions    = SubmissionFile.getSubmissionsFolderPath();
  const repoDir        = `${this.problem.id}_${this.problem.name.trim().replaceAll(" ", "_")}_repo`;
  const repoUri        = vscode.Uri.file(path.join(submissions, repoDir));

  // 2. Deschide / recuperează repository-ul
  let repo = git.getRepository(repoUri)
          ?? await git.openRepository?.(repoUri).catch(() => undefined);
  if (!repo) {
    await vscode.commands.executeCommand("git.openRepository", repoUri);
    repo = git.getRepository(repoUri);
  }
  if (!repo) {
    vscode.window.showErrorMessage("Nu pot deschide repository-ul Git.");
    return;
  }

  // 3. Reîmprospătează status
  await repo.fetch("origin").catch(() => {/* ignori fetch errors */});
  await repo.status();

// 4.1. Verifică dacă suntem pe un branch, altfel facem checkout + branch
const head = repo.state.HEAD;
if (!head?.name) {
  const newBranch = "main";
  try {
    await vscode.commands.executeCommand(
      "git.checkout",
      { ref: head?.commit, createBranch: newBranch }
    );
    vscode.window.showInformationMessage(`Branch '${newBranch}' creat și selectat.`);
  } catch (e) {
    vscode.window.showErrorMessage(
      `Nu am putut crea branch-ul '${newBranch}' pentru push: ${(e as Error).message}`
    );
    return;
  }
  // mici delay ca Git API să-și reîmprospăteze HEAD
  await new Promise(res => setTimeout(res, 300));
}

  // 5. După eventualul checkout, recalculează HEAD
  await repo.status();
  const finalHead = repo.state.HEAD!;
  const branch    = finalHead.name!;
  const isFirst   = !finalHead.upstream;

  // 6. Pregăteşte refspec-ul explicit
  const refspec = `${branch}:${branch}`;  // ex: "main:main"

  // 7. „împinge” cu setUpstream la primul push
  try {
    await repo.push("origin", refspec, isFirst);
    const msg = isFirst
      ? `Push inițial efectuat și upstream setat pe ${branch}.`
      : `Push efectuat cu succes pe ${branch}.`;
    vscode.window.showInformationMessage(msg);
    this.panel.webview.postMessage({ action: "push-done" });
  } catch (err) {
    // dacă eroarea e generată de Git CLI, surviev prin Git Output
    const detail = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Eroare la push: ${detail}`);
  }
}


private async pullRepository(): Promise<void> {
  /* 0. Git API */
  const gitExt = vscode.extensions.getExtension("vscode.git")?.exports;
  const git    = gitExt?.getAPI(1);
  if (!git) {
    vscode.window.showErrorMessage("Extensia Git nu este disponibilă.");
    return;
  }

  /* 1. Căile repo-ului */
  const submissionsPath = SubmissionFile.getSubmissionsFolderPath();
  const baseName        = `${this.problem.id}_${this.problem.name.trim().replaceAll(" ", "_")}`;
  const repoDir         = `${baseName}_repo`;
  const repoUri         = vscode.Uri.file(path.join(submissionsPath, repoDir));

  /* 2. Deschide / obține repo-ul */
  let repo = git.getRepository(repoUri)
           ?? await git.openRepository?.(repoUri).catch(() => undefined);
  if (!repo) {
    await vscode.commands.executeCommand("git.openRepository", repoUri);
    repo = git.getRepository(repoUri);
  }
  if (!repo) {
    vscode.window.showErrorMessage("Repository-ul Git nu a putut fi deschis.");
    return;
  }

  /* 3. Fetch + status */
  await repo.fetch("origin").catch(() => {});
  await repo.status();

  /* 4. Alege versiunea (QuickPick) */
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
    placeHolder: "Alege commit/branch/tag pentru pull"
  });
  if (!choice) { return; }

  const ref = choice.label.split(" ")[1];
  if (!ref) {
    vscode.window.showErrorMessage("Nu am determinat referința aleasă.");
    return;
  }

  /* 5. Checkout */
  try {
    await repo.checkout(ref);
  } catch (err) {
    vscode.window.showErrorMessage(`Eroare la checkout: ${(err as Error).message}`);
    return;
  }

  /* 6. Copiază fișierul înapoi unde era inițial */
  const srcFile  = vscode.Uri.joinPath(repoUri, path.basename(this.submissionFile.Uri.fsPath));
  const destFile = this.submissionFile.Uri;  // exact locația originală
  try {
    await vscode.workspace.fs.copy(srcFile, destFile, { overwrite: true });
  } catch (err) {
    vscode.window.showWarningMessage(
      `Pull OK, dar nu am putut copia fișierul: ${(err as Error).message}`
    );
    return;
  }

  /* 7. Feedback + reaplică split-ul */
  // 7.1 notifici pull-ul terminat
  this.panel.webview.postMessage({ action: "pull-done" });
  // 7.2 trimiți “code” exact ca un click pe butonul Code
  this.panel.webview.postMessage({ action: "code" });

  vscode.window.showInformationMessage(`Pulled ${ref} și fișierul a fost restaurat.`);
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
