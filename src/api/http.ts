import * as vscode from "vscode";
import { LambdaChecker } from "../commands";
import {
  BaseProblem,
  Contest,
  ContestCreate,
  ContestCreateResponse,
  ContestResponse,
  ContestSubject,
  EnrollmentStatus,
  Language,
  ProblemCreate,
  ProblemCreateResponse,
  ProblemTest,
  ProblemTotalGrade,
  RankListEntry,
  RankingResponse,
  RunOutput,
  SpecificProblem,
  SubmissionApiEndpoints,
  SubmissionResult,
  User,
} from "../models";
import { SubmitProps } from "../models/api/submit";

/**
 * An HTTP client sending HTTP requests to the LambdaChecker API.
 */
export class HTTPClient {
  constructor(private token?: string) {}

  async request(route: Route, body?: string): Promise<Response> {
    let headers: { [key: string]: string } = {
      "Content-Type": "application/json",
    };

    if (this.token !== undefined) {
      headers["Authorization"] = "Bearer " + this.token;
    }

    console.log(`[Lambda Checker API]: Fetching data from ${route.url}`);

    // Fetch might throw an error only if there are network issues
    for (let i = 0; i < 10; ++i) {
      try {
        return await fetch(route.url, {
          method: route.method,
          headers: headers,
          body: body,
        }).then((a) => a);
      } catch (error) {
        LambdaChecker.outputChannel.appendLine(
          `Retry ${i}: Network error while trying to fetch data from ${route.url}`
        );
      }
    }

    return await fetch(route.url, {
      method: route.method,
      headers: headers,
      body: body,
    }).catch((error) => {
      throw new Error(
        `Error while fetching response from API: ${error.message}`
      );
    });
  }

  async login(
    email: string,
    password: string
  ): Promise<Record<string, unknown>> {
    const response = await this.request(
      new Route("POST", "/users/login"),
      JSON.stringify({
        email: email,
        password: password,
      })
    );

    const responseData: Record<string, unknown> =
      (await response.json()) as Record<string, unknown>;

    if (responseData["token"] !== undefined) {
      this.token = responseData["token"] as string;
      return responseData;
    }

    throw new Error(responseData["message"] as string);
  }

  async getActiveContests(subject?: ContestSubject): Promise<Contest[]> {
    const response = await this.request(
      new Route(
        "GET",
        `/contests/index_active${
          subject !== undefined ? "?subject_abbreviation=" + subject : ""
        }`
      )
    );

    const contestsData = (await response.json().catch((error) => {
      throw new Error(`${response.statusText} (${response.status})`);
    })) as Record<string, unknown>;

    if (contestsData["contests"] !== undefined) {
      return contestsData["contests"] as Contest[];
    }

    throw new Error(contestsData["message"] as string);
  }

  async getPastContests(subject?: ContestSubject): Promise<Contest[]> {
    const response = await this.request(
      new Route(
        "GET",
        `/contests/index_past${
          subject !== undefined ? "?subject_abbreviation=" + subject : ""
        }`
      )
    );

    const contestsData = (await response.json().catch((error) => {
      throw new Error(`${response.statusText} (${response.status})`);
    })) as Record<string, unknown>;

    return contestsData["contests"] as Contest[];
  }

  async getArchivedContests(
    academic_year: string,
    subject?: ContestSubject
  ): Promise<Contest[]> {
    const response = await this.request(
      new Route(
        "GET",
        `/contests/index_archived?academic_year=${academic_year}${
          subject !== undefined ? "&subject_abbreviation=" + subject : ""
        }`
      )
    );

    const contestsData = (await response.json().catch((error) => {
      throw new Error(`${response.statusText} (${response.status})`);
    })) as Record<string, unknown>;

    return contestsData["contests"] as Contest[];
  }

  async getContest(contestId: number): Promise<ContestResponse> {
    const response = await this.request(
      new Route("GET", `/contests/${contestId}}`)
    );

    try {
      const contestData = await response.text();

      if (response.status !== 200) {
        throw new Error(contestData);
      }

      return JSON.parse(contestData) as ContestResponse;
    } catch (error: any) {
      throw new Error(`[Lambda Checker API]: ${error.message}`);
    }
  }

  async getEnrollmentStatus(contestId: number): Promise<EnrollmentStatus> {
    const response = await this.request(
      new Route("GET", `/contests/${contestId}`)
    ).catch((error) => {
      return undefined;
    });

    if (response === undefined) {
      return EnrollmentStatus.NOT_ENROLLED;
    }

    return response.status === 200
      ? EnrollmentStatus.ENROLLED
      : EnrollmentStatus.NOT_ENROLLED;
  }

  async getProblems(): Promise<BaseProblem[]> {
    const response = await this.request(
      new Route("GET", "/problems/index_privileged")
    );

    const problemsData: Record<string, unknown> =
      (await response.json()) as Record<string, unknown>;

    if (problemsData["problems"] !== undefined) {
      return problemsData["problems"] as BaseProblem[];
    }

    throw new Error(problemsData["message"] as string);
  }

  /**
   *
   * @param problemId The ID of the problem to get.
   * @param contestId Get the problem in context of a certain contest.
   */
  async getProblem(
    problemId: number,
    contestId?: number
  ): Promise<SpecificProblem> {
    const path = `/problems/${problemId}?${
      contestId !== undefined ? "contest_id=" + contestId : ""
    }`;

    const response = await this.request(new Route("GET", path));
    const problemData = await response.json();

    if (response.status !== 200) {
      throw new Error(
        `${response.statusText} (${response.status}): ${
          (problemData as Record<string, unknown>)["error"]
        }`
      );
    }

    return problemData as SpecificProblem;
  }

  async getOwnedProblems(): Promise<SpecificProblem[]> {
    const response = await this.request(
      new Route("GET", `/problems/show_ownership`)
    );

    try {
      const ownedProblemsData = await response.text();

      if (response.status !== 200) {
        throw new Error(ownedProblemsData);
      }

      return JSON.parse(ownedProblemsData) as SpecificProblem[];
    } catch (error: any) {
      throw new Error(`[Lambda Checker API]: ${error.message}`);
    }
  }

  async submitSolution(
    problemId: number,
    contestId: number,
    solution: Uint8Array
  ): Promise<void> {
    const response = await this.request(
      new Route("POST", "/submissions"),
      JSON.stringify({
        code: solution.toString(),
        contest_id: contestId,
        problem_id: problemId,
      })
    );

    try {
      const submissionResponse = await response.text();

      if (response.status !== 200) {
        throw new Error(submissionResponse || response.statusText);
      }
    } catch (error: any) {
      throw new Error(`[Lambda Checker API]: ${error.message}`);
    }
  }

  async runSolution(
    problemId: number,
    code: string,
    tests: ProblemTest[]
  ): Promise<RunOutput> {
    const response = await this.request(
      new Route("POST", "/submissions_run"),
      JSON.stringify({
        problem_id: problemId,
        code: code,
        tests: tests,
      })
    );

    try {
      const runResponse = await response.text();

      if (response.status !== 200) {
        throw new Error(runResponse || response.statusText);
      }

      return JSON.parse(runResponse) as RunOutput;
    } catch (error: any) {
      throw new Error(`[Lambda Checker API]: ${error.message}`);
    }
  }

  async getSubmissions(problemId: number): Promise<SubmissionResult[]> {
    const response = await this.request(
      new Route("GET", `/user-problem-submissions?problem_id=${problemId}`)
    );

    const submissionsData = await response.json();

    if (response.status !== 200) {
      throw new Error(
        `${response.statusText} (${response.status}): ${
          (submissionsData as Record<string, unknown>)["message"]
        }`
      );
    }

    const submissions = submissionsData as SubmissionResult[];
    submissions.forEach((submission) => {
      // Parse the run_output field as JSON
      submission.run_output = JSON.parse(
        submission.run_output as unknown as string
      ) as RunOutput;
    });

    return submissions;
  }

  async getUserRank(): Promise<Record<string, unknown>> {
    const response = await this.request(new Route("GET", "/get_user_rank"));

    const userRankData: Record<string, unknown> =
      (await response.json()) as Record<string, unknown>;

    if (userRankData["user_rank"] !== undefined) {
      return userRankData;
    }

    throw new Error(userRankData["message"] as string);
  }

  async enrollParticipant(contestId: number, password: string): Promise<void> {
    const response = await this.request(
      new Route("POST", "/enroll_participants"),
      JSON.stringify({
        contest_id: contestId,
        password: password,
      })
    );

    const enrollmentData = await response.json().catch((error) => {
      throw new Error(`${response.statusText} (${response.status})`);
    });

    if (response.status !== 200) {
      throw new Error(
        `${response.statusText} (${response.status}): ${
          (enrollmentData as Record<string, unknown>)["message"]
        }`
      );
    }
  }

  async createContest(
    contestContent: ContestCreate
  ): Promise<ContestCreateResponse> {
    const response = await this.request(
      new Route("POST", "/contests"),
      JSON.stringify(contestContent)
    );

    const contestCreateData = await response.json();

    if (response.status !== 200) {
      throw new Error(
        `${response.statusText} (${response.status}): ${
          (contestCreateData as Record<string, unknown>)["message"]
        }`
      );
    }

    return contestCreateData as ContestCreateResponse;
  }

  async editContest(
    contestId: number,
    contestContent: ContestCreate
  ): Promise<ContestCreateResponse> {
    const response = await this.request(
      new Route("PUT", `/contests/${contestId}`),
      JSON.stringify(contestContent)
    );

    try {
      const contestEditData = await response.text();

      if (response.status !== 200) {
        throw new Error(contestEditData);
      }

      return JSON.parse(contestEditData) as ContestCreateResponse;
    } catch (error: any) {
      throw new Error(`[Lambda Checker API]: ${error.message}`);
    }
  }

  async createProblem(
    problemContent: Omit<ProblemCreate, "skeleton_source_is_local">
  ): Promise<ProblemCreateResponse> {
    const response = await this.request(
      new Route("POST", "/problems"),
      JSON.stringify(problemContent)
    );

    try {
      const problemCreateData = await response.text();

      if (response.status !== 200) {
        throw new Error(problemCreateData);
      }

      return JSON.parse(problemCreateData) as ProblemCreateResponse;
    } catch (error: any) {
      throw new Error(`[Lambda Checker API]: ${error.message}`);
    }
  }

  async editProblem(
    problemId: number,
    problemContent: Omit<ProblemCreate, "skeleton_source_is_local">
  ): Promise<ProblemCreateResponse> {
    const response = await this.request(
      new Route("PUT", `/problems/${problemId}`),
      JSON.stringify(problemContent)
    );

    try {
      const problemEditData = await response.text();

      if (response.status !== 200) {
        throw new Error(problemEditData);
      }

      return JSON.parse(problemEditData) as ProblemCreateResponse;
    } catch (error: any) {
      throw new Error(`[Lambda Checker API]: ${error.message}`);
    }
  }

  async getUsers(): Promise<User[]> {
    const response = await this.request(new Route("GET", `/users`));

    const usersData = (await response.json().catch((error) => {
      throw new Error(`${response.statusText} (${response.status})`);
    })) as Record<string, User>[];

    if (response.status !== 200) {
      throw new Error(
        `${response.statusText} (${response.status}): ${
          (usersData as unknown as Record<string, unknown>)["message"]
        }`
      );
    }

    return usersData.map((user) => user["user"]) as User[];
  }

  async getProblemsGrades(contestId: number): Promise<ProblemTotalGrade[]> {
    const response = await this.request(
      new Route("GET", `/contests/${contestId}/problems_grades`)
    );

    try {
      const problemsGradeData = await response.text();

      if (response.status !== 200) {
        throw new Error(problemsGradeData);
      }

      return JSON.parse(problemsGradeData)[
        "problems_grades"
      ] as ProblemTotalGrade[];
    } catch (error: any) {
      throw new Error(`[Lambda Checker API]: ${error.message}`);
    }
  }

  async getRanking(
    contestId: number,
    page?: number,
    per_page?: number,
    username?: string
  ): Promise<RankingResponse> {
    const response = await this.request(
      new Route(
        "GET",
        `/contests/${contestId}/get_contest_leaderboard?${
          username ? "username=" + username + "&" : ""
        }page=${page}&per_page=${per_page}`
      )
    );

    try {
      const rankingData = await response.text();

      if (response.status !== 200) {
        throw new Error(rankingData);
      }

      return JSON.parse(rankingData) as RankingResponse;
    } catch (error: any) {
      throw new Error(`[Lambda Checker API]: ${error.message}`);
    }
  }

  async checkTokenValidity(): Promise<boolean> {
    try {
      await this.getUserRank();
      return true;
    } catch (error: any) {
      return false;
    }
  }
}

class Route {
  private static readonly base = "http://localhost:3000";
  // private static readonly base = "http://192.168.124.4:5000";

  public method: string;
  public url: string;

  constructor(method: string, path: string) {
    this.method = method;
    this.url = Route.base + path;
  }
}

/**
 * An HTTP client sending HTTP requests to the Submissions API.
 */
export class SubmissionsApiClient {
  constructor(
    private endpoints: SubmissionApiEndpoints,
    private signature: string
  ) {}

  async submit(
    language: Language,
    submitProps: SubmitProps
  ): Promise<RunOutput> {
    let headers: { [key: string]: string } = {
      "Content-Type": "application/json",
      signature: this.signature,
    };

    let endpoint = (() => {
      switch (language) {
        case Language.C:
          return this.endpoints.c;
        case Language.Java:
          return this.endpoints.java;
      }
    })();

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(submitProps),
      });

      const submissionData = await response.text();

      if (response?.status !== 200) {
        throw new Error(submissionData);
      }

      const submissionDataJSON = JSON.parse(submissionData);

      return submissionDataJSON as RunOutput;
    } catch (error: any) {
      throw new Error(`[Submission API]: ${error.message})`);
    }
  }
}
