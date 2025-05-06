export interface SubmissionResult {
  id: number;
  user_id: number;
  problem_id: number;
  contest_id: number | null;
  compilation_result: string;
  run_output: RunOutput;
  grade: number;
  maxGrade: number | null;
  date: string;
  code: string;
  ip: string;
  comments_count: number;
  sent_during_contest: boolean;
}

/**
 * Interface used to destructurate the SubmissionResult.run_output
 * from a serialized JSON into an object
 */
export interface RunOutput {
  compiled: boolean;
  error?: string;
  results?: TestResult[];
  version?: number;
}

export interface TestResult {
  status: string;
  out: string;
  ref: string;
}
