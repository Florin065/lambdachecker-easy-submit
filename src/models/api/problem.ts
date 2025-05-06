export enum Difficulty {
  Easy = "Easy",
  Medium = "Medium",
  Hard = "Hard",
}

export enum Language {
  C = "C",
  Java = "Java",
}

export const languageIdMapping: { [key: number]: Language } = {
  1: Language.Java,
  2: Language.C,
};

// Common fields for Problem
export interface BaseProblem {
  id: number;
  name: string;
  visible: boolean;
  difficulty: Difficulty;
  categories: string;
  description?: string;
  language?: Language;
}

// Interface used to store data received from LambdaChecker API
// for a problem as item displayed in a list of filtered problems
export interface ProblemMetadataContestContext extends BaseProblem {
  language_id: number;
  user_id: number;
  skeleton_id: number;
  example_id: number;
  created_at: string;
  updated_at: string;
}

// Interface used to store data received from LambdaChecker API
// for a specific problem
export interface SpecificProblem extends Required<BaseProblem> {
  user: Record<string, unknown>;
  skeleton?: ProblemSkeleton;
  example: ProblemTest;
  tests: ProblemTest[];
  is_owner: boolean;
}

interface ProblemSkeleton {
  code: string;
}

export interface ProblemTest {
  input: string;
  output: string;
  grade: number;
}

export interface ProblemCreate {
  name: string;
  language: Language;
  difficulty: Difficulty;
  categories: string;
  description: string;
  visible: boolean;
  skeleton: string;
  example: ProblemTest;
  tests: ProblemTest[];
  skeleton_source_is_local?: boolean;
}

export interface ProblemCreateResponse {
  status: string;
  message: string;
}
