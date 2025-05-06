import path from "path";
import * as vscode from "vscode";
import { HTTPClient, SubmissionsApiClient } from "../api";
import {
  BaseProblem,
  Contest,
  ContestSubject,
  Language,
  ProblemTest,
  RankListEntry,
  RunOutput,
  SpecificProblem,
  StatusBar,
  Storage,
  SubmissionResult,
  User,
  getEphemeralSubmissionResultWebviewContent,
  getProblemWebviewContent,
  getSubmissionResultWebviewContent,
} from "../models";
import { getContestRankingHTML } from "../models/webview/contestRankingTemplate";
import {
  getContestCreationHTML,
  getProblemCreationHTML,
  getProblemHTML,
} from "../models/webview/htmlTemplates";
import {
  ContestDataProvider,
  ProblemDataProvider,
  ProblemItem,
} from "../treeview";
import {
  ContestRankingListener,
  ProblemSubmissionWebviewListener,
  ViewType,
  WebviewFactory,
} from "../webview";
import { CreateContestListener } from "../webview/createContestListener";
import { CreateProblemListener } from "../webview/createProblemListener";
import { ProblemWebview } from "../webview/problemWebview";

export class LambdaChecker {
  static context: vscode.ExtensionContext;
  static client: HTTPClient;
  static userDataCache = new Storage();
  static contestDataProvider: ContestDataProvider;
  static problemDataProvider: ProblemDataProvider;
  static users: User[] = [];
  static problems: BaseProblem[] = [];
  static rankingsPageSize = 5;
  static outputChannel = vscode.window.createOutputChannel(
    "LambdaChecker Output"
  );

  static async getLoginStatus(): Promise<string | undefined> {
    const userToken = await LambdaChecker.userDataCache.getSecret("token");
    const loggedIn = userToken !== undefined;

    if (loggedIn) {
      if (LambdaChecker.client === undefined) {
        LambdaChecker.client = new HTTPClient(userToken as string);
      }

      const user = LambdaChecker.userDataCache.get(
        "user",
        true
      ) as unknown as Record<string, unknown>;
      return user["username"] as string;
    }

    LambdaChecker.client = new HTTPClient();
    return undefined;
  }

  static async login() {
    const status = await LambdaChecker.getLoginStatus();

    const email = await vscode.window.showInputBox({
      ignoreFocusOut: true,
      prompt: "Enter your email",
      title: "LambdaChecker Login",

      value: "@stud.acs.upb.ro",
      valueSelection: [0, 0],
    });

    const password = await vscode.window.showInputBox({
      ignoreFocusOut: true,
      prompt: "Enter your password",
      title: "LambdaChecker Login",
      placeHolder: "Enter your password",
      password: true,
    });

    if (
      email === undefined ||
      password === undefined ||
      (email === "@stud.acs.upb.ro" && password === "")
    ) {
      return;
    }

    try {
      const response = await LambdaChecker.client.login(
        email as string,
        password as string
      );

      vscode.window.showInformationMessage(
        "Successfully logged into you LambdaChecker account!"
      );

      LambdaChecker.userDataCache.clear();

      LambdaChecker.userDataCache.put("user", response["user"] as string);
      LambdaChecker.userDataCache.putSecret(
        "token",
        response["token"] as string
      );
      StatusBar.updateStatus(await LambdaChecker.getLoginStatus());

      // Update the role seen by the extension
      if (
        (response["user"] as unknown as Record<string, unknown>)["role"] ===
        "teacher"
      ) {
        vscode.commands.executeCommand(
          "setContext",
          "lambdachecker.teacher",
          true
        );
      } else {
        vscode.commands.executeCommand(
          "setContext",
          "lambdachecker.teacher",
          false
        );
      }

      if (LambdaChecker.contestDataProvider === undefined) {
        vscode.window.createTreeView("lambdachecker.contests", {
          treeDataProvider: new ContestDataProvider(LambdaChecker.client),
          showCollapseAll: true,
        });
      } else {
        // Update the contests status
        LambdaChecker.contestDataProvider.refresh();
      }

      if (LambdaChecker.problemDataProvider === undefined) {
        vscode.window.createTreeView("lambdachecker.problems", {
          treeDataProvider: new ProblemDataProvider(LambdaChecker.client),
          showCollapseAll: true,
        });
      } else {
        // Update the problems
        LambdaChecker.problemDataProvider.refresh();
      }
    } catch (error: any) {
      vscode.window
        .showErrorMessage(error.message, "Try again")
        .then((selection) => {
          if (selection === "Try again") {
            vscode.commands.executeCommand("lambdachecker.login");
          }
        });
    }
  }

  static async logout() {
    LambdaChecker.userDataCache.clear();
    vscode.commands.executeCommand(
      "setContext",
      "lambdachecker.teacher",
      false
    );

    StatusBar.updateStatus();
    LambdaChecker.client = new HTTPClient();
  }

  // create a thread which manages the token in order to refresh it
  // (I suspect that we don't have a refresh token on the backend)

  static async showProblem(problemId: number, contestMetadata?: Contest) {
    let problem;

    const problemStatementPanelWrapper = WebviewFactory.createWebview(
      ViewType.ProblemStatement,
      `${problemId}${contestMetadata ? `-${contestMetadata.id}` : ""}`,
      async (message) => {
        problemWebview.webviewListener(message);
      }
    );

    try {
      problem = await LambdaChecker.client.getProblem(
        problemId,
        contestMetadata?.id
      );
    } catch (error: any) {
      vscode.window
        .showErrorMessage(error.message, "Go to output")
        .then((selection) => {
          if (selection === "Go to output") {
            LambdaChecker.outputChannel.show();
          }
        });
      return;
    }

    const problemStatementPanel = problemStatementPanelWrapper.webviewPanel;
    problemStatementPanel.title = `${problem.id}. ${problem.name}`;

    // Create the listener once (more efficient than creating a new
    // listener for each message received)
    const problemWebview = new ProblemWebview(
      problem,
      problemStatementPanel,
      contestMetadata
    );

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

    problemStatementPanel.webview.html = getProblemHTML(
      problemStatementPanel.webview.asWebviewUri(scriptsPath),
      problemStatementPanel.webview.asWebviewUri(stylesPath),
      problem,
      contestMetadata
    );
  }

  static async showSubmissionResult(
    submissionResult: SubmissionResult | RunOutput,
    problemName: string,
    problemTests: ProblemTest[],
    problemLanguage: Language,
    ephemeralSubmission: boolean = false
  ) {
    let problemId = ephemeralSubmission
      ? 0
      : (submissionResult as SubmissionResult).problem_id;

    const submissionResultPanelWrapper = WebviewFactory.createWebview(
      ViewType.UserSubmissionResult,
      `${problemId}. ${problemName}`
    );
    const submissionResultPanel = submissionResultPanelWrapper.webviewPanel;

    if (ephemeralSubmission === false) {
      // Create the listener once, and use it for each message received
      const currentProblemResultListener = new ProblemSubmissionWebviewListener(
        problemId,
        problemName,
        problemLanguage,
        (submissionResult as SubmissionResult).code,
        submissionResultPanel,
        problemTests
      );

      submissionResultPanelWrapper.addListener(async (message) => {
        currentProblemResultListener.webviewListener(message);
      });
    }

    const stylesPath = vscode.Uri.joinPath(
      LambdaChecker.context.extensionUri,
      "resources",
      "styles",
      "submissionView.css"
    );

    const scriptsPath = vscode.Uri.joinPath(
      LambdaChecker.context.extensionUri,
      "resources",
      "scripts",
      "submissionView.js"
    );

    if (ephemeralSubmission === false) {
      submissionResultPanel.webview.html = getSubmissionResultWebviewContent(
        submissionResultPanel.webview.asWebviewUri(stylesPath),
        submissionResultPanel.webview.asWebviewUri(scriptsPath),
        submissionResult as SubmissionResult,
        problemTests
      );
    } else {
      submissionResultPanel.webview.html =
        getEphemeralSubmissionResultWebviewContent(
          submissionResultPanel.webview.asWebviewUri(stylesPath),
          submissionResultPanel.webview.asWebviewUri(scriptsPath),
          submissionResult as RunOutput,
          problemTests
        );
    }
  }

  static async enrollInContest(
    contestId: number,
    hasPassword: boolean,
    contestDataProvider: ContestDataProvider
  ) {
    let password = "";

    if (hasPassword) {
      const passwordRaw = await vscode.window.showInputBox({
        ignoreFocusOut: true,
        prompt: "Enter your password",
        title: `Unlock contest ${contestId}`,
        placeHolder: "Enter your password",
        password: true,
      });

      if (passwordRaw === undefined) {
        return;
      } else {
        password = passwordRaw;
      }
    }

    try {
      const response = await LambdaChecker.client.enrollParticipant(
        contestId,
        password
      );

      contestDataProvider.refresh(contestId);
    } catch (error: any) {
      vscode.window
        .showErrorMessage(error.message, "Try again")
        .then((selection) => {
          if (selection === "Try again") {
            vscode.commands.executeCommand(
              "lambdachecker.enroll-in-contest",
              contestId,
              hasPassword,
              contestDataProvider
            );
          }
        });
    }
  }

  static async createContest() {
    const createContestPanel = vscode.window.createWebviewPanel(
      "lambdachecker.webview.create-contest",
      "Create Contest",
      {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: false,
      },
      {
        enableScripts: true,
        enableFindWidget: true,
        localResourceRoots: [
          vscode.Uri.joinPath(LambdaChecker.context.extensionUri, "resources"),
        ],
        retainContextWhenHidden: true,
      }
    );

    LambdaChecker.client.getUsers().then((users) => {
      LambdaChecker.users = users;

      LambdaChecker.outputChannel.appendLine(
        "Sent the newly fetched users to Create Contest Webview"
      );

      createContestPanel.webview.postMessage({
        action: "updateUsers",
        users: users.filter((user) => user.role === "teacher"),
      });
    });

    LambdaChecker.client.getProblems().then((problems) => {
      LambdaChecker.problems = problems;

      LambdaChecker.outputChannel.appendLine(
        "Sent the newly fetched problems to Create Contest Webview"
      );

      createContestPanel.webview.postMessage({
        action: "updateProblems",
        problems: problems,
      });
    });

    const stylesPath = vscode.Uri.joinPath(
      LambdaChecker.context.extensionUri,
      "resources",
      "styles",
      "contestCreation.css"
    );
    const scriptsPath = vscode.Uri.joinPath(
      LambdaChecker.context.extensionUri,
      "resources",
      "scripts",
      "contestCreation.js"
    );

    createContestPanel.webview.html = getContestCreationHTML(
      createContestPanel.webview.asWebviewUri(stylesPath),
      createContestPanel.webview.asWebviewUri(scriptsPath)
    );

    const createContestListener = new CreateContestListener(createContestPanel);
    createContestPanel.webview.onDidReceiveMessage(async (message) =>
      createContestListener.webviewListener(message)
    );
  }

  static async createProblem() {
    const createProblemPanel = vscode.window.createWebviewPanel(
      "lambdachecker.webview.create-problem",
      "Create Problem",
      {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: false,
      },
      {
        enableScripts: true,
        enableFindWidget: true,
        localResourceRoots: [
          vscode.Uri.joinPath(LambdaChecker.context.extensionUri, "resources"),
        ],
        retainContextWhenHidden: true,
      }
    );

    const stylesPath = vscode.Uri.joinPath(
      LambdaChecker.context.extensionUri,
      "resources",
      "styles",
      "problemCreation.css"
    );
    const scriptsPath = vscode.Uri.joinPath(
      LambdaChecker.context.extensionUri,
      "resources",
      "scripts",
      "problemCreation.js"
    );

    createProblemPanel.webview.html = getProblemCreationHTML(
      createProblemPanel.webview.asWebviewUri(stylesPath),
      createProblemPanel.webview.asWebviewUri(scriptsPath)
    );

    const createProblemListener = new CreateProblemListener(createProblemPanel);
    createProblemPanel.webview.onDidReceiveMessage(async (message) => {
      createProblemListener.webviewListener(message);
    });
  }

  static async editProblem(problemId: number) {
    const editProblemPanel = vscode.window.createWebviewPanel(
      "lambdachecker.webview.edit-problem",
      `${problemId}. Edit Problem`,
      {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: false,
      },
      {
        enableScripts: true,
        enableFindWidget: true,
        localResourceRoots: [
          vscode.Uri.joinPath(LambdaChecker.context.extensionUri, "resources"),
        ],
        retainContextWhenHidden: true,
      }
    );

    const stylesPath = vscode.Uri.joinPath(
      LambdaChecker.context.extensionUri,
      "resources",
      "styles",
      "problemCreation.css"
    );
    const scriptsPath = vscode.Uri.joinPath(
      LambdaChecker.context.extensionUri,
      "resources",
      "scripts",
      "problemCreation.js"
    );

    editProblemPanel.webview.html = getProblemCreationHTML(
      editProblemPanel.webview.asWebviewUri(stylesPath),
      editProblemPanel.webview.asWebviewUri(scriptsPath),
      true
    );

    // Populate the form with data (just context data stored in
    // the Treeview node is not enough, since it lacks skeleton,
    // tests, ...) - we need to fetch the full problem data
    const problemData = await LambdaChecker.client.getProblem(problemId);
    editProblemPanel.webview.postMessage({
      action: "populateProblemForm",
      data: JSON.stringify(problemData),
    });

    const createProblemListener = new CreateProblemListener(
      editProblemPanel,
      false,
      problemData
    );
    editProblemPanel.webview.onDidReceiveMessage(async (message) => {
      createProblemListener.webviewListener(message);
    });
  }

  static async editContest(contestId: number) {
    const editContestPanel = vscode.window.createWebviewPanel(
      "lambdachecker.webview.edit-contest",
      `${contestId}. Edit Contest`,
      {
        viewColumn: vscode.ViewColumn.One,
      },
      {
        enableScripts: true,
        enableFindWidget: true,
        localResourceRoots: [
          vscode.Uri.joinPath(LambdaChecker.context.extensionUri, "resources"),
        ],
        retainContextWhenHidden: true,
      }
    );

    LambdaChecker.client.getUsers().then((users) => {
      LambdaChecker.users = users;

      LambdaChecker.outputChannel.appendLine(
        "Sent the newly fetched users to Create Contest Webview"
      );

      editContestPanel.webview.postMessage({
        action: "updateUsers",
        users: users.filter((user) => user.role === "teacher"),
      });
    });

    LambdaChecker.client.getProblems().then((problems) => {
      LambdaChecker.problems = problems;

      LambdaChecker.outputChannel.appendLine(
        "Sent the newly fetched problems to Edit Contest Webview"
      );

      editContestPanel.webview.postMessage({
        action: "updateProblems",
        problems: problems,
      });
    });

    const stylesPath = vscode.Uri.joinPath(
      LambdaChecker.context.extensionUri,
      "resources",
      "styles",
      "contestCreation.css"
    );
    const scriptsPath = vscode.Uri.joinPath(
      LambdaChecker.context.extensionUri,
      "resources",
      "scripts",
      "contestCreation.js"
    );

    editContestPanel.webview.html = getContestCreationHTML(
      editContestPanel.webview.asWebviewUri(stylesPath),
      editContestPanel.webview.asWebviewUri(scriptsPath),
      true
    );

    // Get the fresh data from the API
    const contestData = await LambdaChecker.client.getContest(contestId);

    // Populate the form with data
    editContestPanel.webview.postMessage({
      action: "populateContestForm",
      data: contestData.contest,
    });

    const createContestListener = new CreateContestListener(
      editContestPanel,
      false,
      contestId
    );
    editContestPanel.webview.onDidReceiveMessage(async (message) => {
      createContestListener.webviewListener(message);
    });
  }

  static async showContestRanking(contestMetadata: Contest, page: number = 1) {
    try {
      const contestRankingWebviewWrapper = WebviewFactory.createWebview(
        ViewType.ContestRanking,
        `Ranking ${contestMetadata.name}`,
        async (message) => {
          contestRankingListener.webviewListener(message);
        }
      );
      const contestRankingWebview =
        contestRankingWebviewWrapper.webviewPanel.webview;

      const problemsGrades = await LambdaChecker.client.getProblemsGrades(
        contestMetadata.id
      );

      const stylesPath = vscode.Uri.joinPath(
        LambdaChecker.context.extensionUri,
        "resources",
        "styles",
        "contestRanking.css"
      );
      const scriptsPath = vscode.Uri.joinPath(
        LambdaChecker.context.extensionUri,
        "resources",
        "scripts",
        "contestRanking.js"
      );

      const rankingData = await LambdaChecker.client.getRanking(
        contestMetadata.id,
        page,
        LambdaChecker.rankingsPageSize
      );

      const contestRankingListener = new ContestRankingListener(
        contestMetadata,
        problemsGrades,
        contestRankingWebviewWrapper.webviewPanel,
        rankingData
      );

      contestRankingWebview.html = getContestRankingHTML(
        contestRankingWebview.asWebviewUri(stylesPath),
        contestRankingWebview.asWebviewUri(scriptsPath),
        contestMetadata,
        problemsGrades,
        rankingData.ranking,
        page,
        rankingData.total_pages
      );
    } catch (error: any) {
      vscode.window
        .showErrorMessage(error.message, "Go to output")
        .then((selection) => {
          if (selection === "Go to output") {
            LambdaChecker.outputChannel.show();
          }
        });
      return;
    }
  }
}
