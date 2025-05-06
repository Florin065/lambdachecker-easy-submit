import * as vscode from "vscode";
import { LambdaChecker } from "../commands";
import {
  Contest,
  ContestRankingWebviewMessage,
  ProblemTotalGrade,
  RankListEntry,
  RankingResponse,
} from "../models";
import { getContestRankingHTML } from "../models/webview/contestRankingTemplate";

export class ContestRankingListener {
  private stylesUri: vscode.Uri;
  private scriptsUri: vscode.Uri;
  private rankingCache = new Map<number, RankListEntry[]>();
  private rankingTotalPages = 0;
  private latestRequestedPage = 1;

  constructor(
    public contestMetadata: Contest,
    public problemsGrades: ProblemTotalGrade[],
    public panel: vscode.WebviewPanel,
    firstRankingPage: RankingResponse
  ) {
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

    this.stylesUri = this.panel.webview.asWebviewUri(stylesPath);
    this.scriptsUri = this.panel.webview.asWebviewUri(scriptsPath);

    this.rankingCache.set(1, firstRankingPage.ranking);
    this.rankingTotalPages = firstRankingPage.total_pages;
  }

  async webviewListener(message: ContestRankingWebviewMessage) {
    switch (message.action) {
      case "show-problem":
        LambdaChecker.showProblem(message.problemId!, this.contestMetadata);
        break;
      case "get-ranking-page":
        this.latestRequestedPage = message.page!;

        LambdaChecker.client
          .getRanking(
            this.contestMetadata.id,
            message.page,
            LambdaChecker.rankingsPageSize
          )
          .then((rankingData) => {
            this.rankingCache.set(message.page!, rankingData.ranking);
            this.rankingTotalPages = rankingData.total_pages;

            if (message.page === this.latestRequestedPage) {
              this.panel.webview.html = getContestRankingHTML(
                this.stylesUri,
                this.scriptsUri,
                this.contestMetadata,
                this.problemsGrades,
                this.rankingCache.get(message.page!) || [],
                message.page!,
                rankingData.total_pages,
                message.slidingWindow
              );
            }
          });

        // Show the old ranking data in the Webview
        if (this.rankingCache.get(message.page!) !== undefined) {
          this.panel.webview.html = getContestRankingHTML(
            this.stylesUri,
            this.scriptsUri,
            this.contestMetadata,
            this.problemsGrades,
            this.rankingCache.get(message.page!) || [],
            message.page!,
            this.rankingTotalPages,
            message.slidingWindow
          );
        }
    }
  }
}
