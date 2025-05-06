import { ContestCreate, ProblemCreate, ProblemTest } from "../api";

export interface WebviewMessage {
  /**
   * The action sent from webview
   */
  action: string;

  /**
   * The ID of the contest where the solution
   * will be submitted
   */
  contestId?: number;

  /**
   * The tests against which the code is run
   * (only for action "run")
   */
  tests?: ProblemTest[];

  testId?: string;
}

export interface ProblemSubmissionWebviewMessage {
  action: string;
  submissionIdx?: number;
}

export interface CreateProblemWebviewMessage {
  action: string;
  problemData?: ProblemCreate;
  testId?: string;
}

export interface CreateContestWebviewMessage {
  action: string;
  contestData: ContestCreate;
}

export interface ContestRankingWebviewMessage {
  action: string;
  problemId?: number;
  page?: number;
  slidingWindow?: number[];
}
