import { ProblemTest } from "./problem";

export interface SubmitProps {
  code: string;
  flags: any[];
  tests: ProblemTest[];
}
