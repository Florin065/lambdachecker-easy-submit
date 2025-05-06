import * as vscode from "vscode";
import { ProblemTest, RunOutput, SubmissionResult } from "../api";
import {
  getExecutionResultHTML,
  getFailedCompilationHTML,
} from "./htmlTemplates";

/**
 * Proxy for the functions which populate the HTML template
 *
 * @param submissionResult
 * @param tests
 * @returns
 */
export const getSubmissionResultWebviewContent = (
  stylesUri: vscode.Uri,
  scriptsUri: vscode.Uri,
  submissionResult: SubmissionResult,
  tests: ProblemTest[]
) => {
  if (submissionResult.run_output.compiled === false) {
    return getFailedCompilationHTML(
      submissionResult.compilation_result,
      submissionResult.date
    );
  }

  return getExecutionResultHTML(
    stylesUri,
    scriptsUri,
    submissionResult.run_output.results!,
    submissionResult.date,
    tests
  );

  // table
  // Status                   Contest
  // ------------------------- ----------------
  // Accepted/Rejected        "SD Partial" / ...
  // date
  // ------------------------- ----------------

  // View for singular submission
  // Status (Accepted/Wrong Answer/ Compilation Failed) | 7/32 testcases passed

  // Input
  // textbox
  // Output
  // textbox
  // Expected
  // textbox si highlight pe diff

  // button copy to editor
};

export const getEphemeralSubmissionResultWebviewContent = (
  stylesUri: vscode.Uri,
  scriptsUri: vscode.Uri,
  runOutput: RunOutput,
  tests: ProblemTest[]
) => {
  if (runOutput.compiled === false) {
    return getFailedCompilationHTML(
      runOutput.error || "",
      new Date().toISOString(),
      true
    );
  }

  return getExecutionResultHTML(
    stylesUri,
    scriptsUri,
    runOutput.results!,
    new Date().toISOString(),
    tests,
    true
  );
};
