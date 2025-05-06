import * as vscode from "vscode";
import { ProblemDataProvider } from "../../treeview";
import {
  BaseProblem,
  Contest,
  ContestSubject,
  Difficulty,
  Language,
  ProblemTest,
  RunOutput,
  SpecificProblem,
  SubmissionResult,
  TestResult,
  User,
} from "../api";

const styles = `
<style>
  h1 {
    font-size: 24px;
  }

  body.vscode-light {
    color: black;
  }

  body.vscode-dark {
    color: white;
  }

  code, svg, li, .highlight, p {
    font-size: 14px;
  }
  .error {
    font-size: 14px;
    word-break: break-all;
    display: block;
    font-family: monospace;
    white-space: pre-wrap;
  }

  .meta {
    font-size: 12px;
    font-weight: normal;
  }

  .normal {
    font-size: 14px;
    font-weight: normal;
  }

  span {
    font-size: 14px;
  }

  code, svg, li, .highlight, p, pre {
    font-size: 14px;
  }

  pre {
    background-color: rgba(0, 0, 0, 0.4);
    padding: 10px;
    border-radius: 10px;
  }
  .error {
    background-color: rgba(0, 0, 0, 0.4);
    padding: 10px;
    border-radius: 10px;
  }

  p, li {
    line-height: 1.7;
  }
  .accepted {
    color: #0BDA51;
    font-weight: bold;
    font-size: 24px;
  }
  .failed {
    color: #D2042D;
    font-weight: bold;
    font-size: 24px;
  }

  .accepted-normal {
    color: #0BDA51;
    font-weight: bold;
  }

  .failed-normal {
    color: #D2042D;
    font-weight: bold;
  }

  .accepted-thin {
    color: #0BDA51;
  }

  .failed-thin {
    color: #D2042D;
  }

  .buttons {
    padding: 0px 0px;
  }

  .buttons::after {
    content: "";
    display: table;
    clear: both;
  }

  button {
    color: inherit;
  }

  .btn {
    font-size: 14px;
    padding: 8px 0px;
    border: none;
    cursor: pointer;
    font-weight: 500;
    border-radius: 0px;

    display: inline-block;
    background-color: transparent;
    color: var(--vscode-input-foreground);
  }

  .btn:hover {
    color: inherit;
  }
  
  .copy-code {
    float: right;
  }

  .copy-code svg {
    width: 16px;
    height: 16px;
    margin-right: 5px;
    vertical-align: text-top;
  }

  .all-submissions {
    float: left;
  }

  .all-submissions svg {
    width: 16px;
    height: 16px;
    margin-right: 5px;
    vertical-align: text-top;
  }

  div {
    padding-top: 5px;
    min-height: 20px;
  }

  .submissions-table {
    width: 100%;
    border-collapse: collapse;
  }

  .submissions-table th, .submissions-table td {
    padding: 15px;
    text-align: left;
    border-bottom: 1px solid white;
    font-size: 14px;
  }

  .submissions-table tr:nth-child(even) {
    background-color: var(--vscode-inlineChat-background);
  }

  .submissions-table tr:nth-child(odd) {
    background-color: var(--vscode-editor-background);
  }

  .submissions-table tr {
    border: none;
    cursor: pointer;
    border-radius: 0px;
  }

  .bottom-btn {
    font-size: 15px;
    padding: 10px 25px;
    border: none;
    cursor: pointer;
    font-weight: 500;
    border-radius: 3px;
    margin-top: 14px;
  }

  .test-btn {
    font-size: 14px;
    padding: 2px 0px 2px 6px;
    
    border: none;
    cursor: pointer;
    font-weight: strong;
    border-radius: 3px;
    color: var(--vscode-input-foreground);

    display: inline-block;
    background-color: transparent;
  }

  .test-btn:hover {
    color: inherit;
  }

  .test-btn-active-text {
    text-decoration: underline;
    text-underline-position: under;
    text-underline-offset: 2px;
  }

  .button-container {
    display: flex;
    align-items: center;
    padding: 3px 0px 0px;
  }

  .button-container-separator {
    margin: 0px 8px 0px 8px;
    font-size: 18px;
    color: #333;
  }

  .separator {
    margin: 0px 4px 0px px;
    font-size: 18px;
    color: #333;
  }

</style>`;

const problemButtonsStyle = `
<style>
.code {
  color: black;
  background-color: #b680f3;
}
.code:hover {
  background-color: #8c30f5;
  transition: 0.1s;
}
.code:active {
  transform: translateY(4px); 
}
.run {
  float: right;
  color: black;
  background-color: #f4f4f5;
  margin-right: 10px;
}
.run:hover {
  background-color: #8C30F5;
  transition: 0.1s;
}
.run:active {
  transform: translateY(4px); 
}
.submit {
  float: right;
  color: black;
  background-color: #b680f3;
}
.submit:hover {
  background-color: #8c30f5;
  transition: 0.1s;
}
.submit:active {
  transform: translateY(4px); 
}

</style>`;

const head = `
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Submission Result</title>

  ${styles}
  
</head>`;

const stringifyDate = (date: string) => {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  });
};

const getBringCodeToEditorButton = () => {
  return `
  <button id="copy-code" class="btn copy-code" onclick="send('copy-code')">
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M11.9565 6H12.0064C12.8004 6 13.5618 6.31607 14.1232 6.87868C14.6846 7.44129 15 8.20435 15 9C15 9.79565 14.6846 10.5587 14.1232 11.1213C13.5618 11.6839 12.8004 12 12.0064 12V11C12.5357 11 13.0434 10.7893 13.4176 10.4142C13.7919 10.0391 14.0021 9.53044 14.0021 9C14.0021 8.46957 13.7919 7.96086 13.4176 7.58579C13.0434 7.21072 12.5357 7 12.0064 7H11.0924L10.9687 6.143C10.8938 5.60541 10.6456 5.10711 10.2618 4.72407C9.87801 4.34103 9.37977 4.09427 8.84303 4.02143C8.30629 3.94859 7.76051 4.05365 7.2889 4.3206C6.81729 4.58754 6.44573 5.00173 6.23087 5.5L5.89759 6.262L5.08933 6.073C4.90382 6.02699 4.71364 6.0025 4.52255 6C3.86093 6 3.22641 6.2634 2.75858 6.73224C2.29075 7.20108 2.02792 7.83696 2.02792 8.5C2.02792 9.16304 2.29075 9.79893 2.75858 10.2678C3.22641 10.7366 3.86093 11 4.52255 11H5.02148V12H4.52255C4.02745 12.0043 3.5371 11.903 3.08403 11.7029C2.63096 11.5028 2.22553 11.2084 1.89461 10.8394C1.5637 10.4703 1.31488 10.0349 1.16465 9.56211C1.01442 9.08932 0.966217 8.58992 1.02324 8.09704C1.08026 7.60416 1.24121 7.12906 1.4954 6.70326C1.74959 6.27745 2.09121 5.91068 2.49762 5.62727C2.90402 5.34385 3.36591 5.15027 3.85264 5.05937C4.33938 4.96847 4.83984 4.98232 5.32083 5.1C5.6241 4.40501 6.14511 3.82799 6.80496 3.45635C7.4648 3.08472 8.22753 2.9387 8.9776 3.04044C9.72768 3.14217 10.4242 3.4861 10.9618 4.02014C11.4993 4.55418 11.8485 5.24923 11.9565 6ZM6.70719 11.1214L8.0212 12.4354V7H9.01506V12.3992L10.2929 11.1214L11 11.8285L8.85356 13.9749H8.14645L6.00008 11.8285L6.70719 11.1214Z" fill="#C5C5C5"/>
    </svg> Bring Code To Editor <span class="button-container-separator" style="visibility: hidden; ">|</span></button>`;
};

const getAllSubmissionsButton = () => {
  return `
  <button id="all-submissions" class="btn all-submissions" onclick="send('view-all-submissions')">
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M6.99999 3.0929L2 8.09288L2 8.79999L6.99999 13.8L7.7071 13.0929L3.56066 8.94644L14 8.94644L14 7.94644L3.56066 7.94644L7.7071 3.8L6.99999 3.0929Z" fill="#C5C5C5"/>
    </svg> All Submissions <span class="button-container-separator" style="visibility: hidden; ">|</span></button>`;
};

export const getFailedCompilationHTML = (
  compileError: string,
  submissionDate: string,
  ephemeralSubmission: boolean = false
) => {
  return `
<!DOCTYPE html>
<html lang="en">
<html>
${head}
<body>

${
  ephemeralSubmission
    ? ""
    : `
  <div>
    ${getAllSubmissionsButton()}
    ${getBringCodeToEditorButton()}
  </div>`
}

<h1>
  <div><span class="failed">Compilation Error</span></div>
  <div class="meta">Submitted on ${stringifyDate(submissionDate)}</div>
</h1>

  <div class="error">${compileError}</div>

  <script>
    const vscode = acquireVsCodeApi();

    function send(cmd) {
      vscode.postMessage({
        action: cmd,
      });
    }
  </script>

</body>
</html>`;
};

const levenshteinDistanceOps = (word1: string, word2: string) => {
  const dp = Array.from({ length: word1.length + 1 }).map(() =>
    Array.from({ length: word2.length + 1 }).map(() => 0)
  );
  const operations = Array.from({ length: word1.length + 1 }).map(() =>
    Array.from({ length: word2.length + 1 }).map(() => "")
  );

  for (let i = 0; i <= word1.length; i++) {
    dp[i][0] = i;
  }

  for (let i = 0; i <= word2.length; i++) {
    dp[0][i] = i;
  }

  for (let j = 1; j <= word2.length; j++) {
    for (let i = 1; i <= word1.length; i++) {
      if (word1[i - 1] === word2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
        operations[i][j] = " ";
      } else {
        dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;

        if (dp[i][j] === dp[i - 1][j] + 1) {
          operations[i][j] = "-";
        } else if (dp[i][j] === dp[i][j - 1] + 1) {
          operations[i][j] = "+";
        } else {
          operations[i][j] = "&";
        }
      }
    }
  }

  return operations;
};

const getTestResultHTML = (
  testNo: number,
  testResult: TestResult,
  test: ProblemTest | undefined
) => {
  const grade = testResult.status === "PASSED" ? test?.grade : 0;

  let formattedOut = "";
  let formattedRef = "";

  // Find the optimum operations to make the strings equal
  const operations = levenshteinDistanceOps(testResult.out, testResult.ref);

  let i = testResult.out.length;
  let j = testResult.ref.length;

  while (i > 0 && j > 0) {
    if (operations[i][j] === " ") {
      formattedOut = testResult.out[i - 1] + formattedOut;
      formattedRef = testResult.ref[j - 1] + formattedRef;

      i--;
      j--;
    } else if (operations[i][j] === "-") {
      formattedOut =
        `<span class="failed-thin"><b>${testResult.out[i - 1]}</b></span>` +
        formattedOut;
      i--;
    } else if (operations[i][j] === "+") {
      formattedRef =
        `<span class="accepted-thin"><b>${testResult.ref[j - 1]}</b></span>` +
        formattedRef;
      j--;
    } else {
      formattedOut =
        `<span class="failed-thin"><b>${testResult.out[i - 1]}</b></span>` +
        formattedOut;
      formattedRef =
        `<span class="accepted-thin"><b>${testResult.ref[j - 1]}</b></span>` +
        formattedRef;
      i--;
      j--;
    }
  }

  while (i > 0) {
    formattedOut =
      `<span class="failed-thin"><b>${testResult.out[i - 1]}</b></span>` +
      formattedOut;
    i--;
  }

  while (j > 0) {
    formattedRef =
      `<span class="accepted-thin"><b>${testResult.ref[j - 1]}</b></span>` +
      formattedRef;
    j--;
  }

  return `
<h2> <span class=${
    testResult.status === "PASSED" ? "accepted" : "failed"
  }>Case ${testNo} </span> <span class="normal">|  ${grade} / ${
    test?.grade || 0
  } pts</span>
</h2>

<h3>Input:</h3>
<pre>${test?.input || ""}</pre>

<h3>Output:</h3>
<pre>${
    testResult.status === "TIMEOUT"
      ? '<span class="failed-normal"><b>~ Error: Time Limit Exceeded</b></span>'
      : ""
  }${formattedOut}</pre>

<h3>Expected:</h3>
<pre>${formattedRef}</pre>

<hr>
`;
};

const getExecutionStatus = (testsResults: TestResult[]) => {
  const passedTestsCount = testsResults.filter(
    (result) => result.status === "PASSED"
  ).length;
  const totalTestsCount = testsResults.length;
  const accepted = totalTestsCount === passedTestsCount;

  // Possible states are PASSED, FAILED, RUNTIME_ERROR, TIMEOUT
  const timeLimitExceeded = testsResults.some(
    (result) => result.status === "TIMEOUT"
  );
  const wrongAnswer = testsResults.some((result) => result.status === "FAILED");
  const runtimeError = testsResults.some(
    (result) => result.status === "RUNTIME_ERROR"
  );

  const status = accepted
    ? "Accepted"
    : wrongAnswer
    ? "Wrong Answer"
    : timeLimitExceeded
    ? "Time Limit Exceeded"
    : runtimeError
    ? "Runtime Error"
    : "Internal Error";

  return status;
};

export const getExecutionResultHTML = (
  stylesUri: vscode.Uri,
  scriptsUri: vscode.Uri,
  testsResults: TestResult[],
  submissionDate: string,
  tests: ProblemTest[],
  ephemeralSubmission: boolean = false
) => {
  const executionStatus = getExecutionStatus(testsResults);
  const accepted = executionStatus === "Accepted";

  const passedTestsCount = testsResults.filter(
    (result) => result.status === "PASSED"
  ).length;
  const totalTestsCount = testsResults.length;

  const headerClass = accepted ? "accepted" : "failed";
  const testsResultsHTML = testsResults
    .map((testResult, idx) => getTestResultHTML(idx, testResult, tests[idx]))
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<html>

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Submission Result</title>

  ${styles}

  <link rel='stylesheet' type='text/css' href='${stylesUri}'>
  
</head>

<body>

${
  ephemeralSubmission
    ? ""
    : `
  <div>
    <span>${getAllSubmissionsButton()}</span>
    <span>${getBringCodeToEditorButton()}</span>
  </div>`
}

<h1> 
<div>
<span class="${headerClass}">
  ${executionStatus}
  </span>

  <span class="normal">${
    accepted
      ? ""
      : " | " + passedTestsCount + " / " + totalTestsCount + " testcases passed"
  }</span>
</div>

  <div class="meta">Submitted on ${stringifyDate(submissionDate)}</div>
  </h1>
  
  ${testsResultsHTML}

  <script>
    const vscode = acquireVsCodeApi();
    const testsIds = [${testsResults.map((_, idx) => `"test-${idx}"`)}];

    function send(cmd) {
      vscode.postMessage({
        action: cmd,
      });
    }

    window.addEventListener('message', event => {
      const message = event.data;

      switch (message.command) {
        case 'reset-cursor':
          window.scrollTo(0, 0);
          break;
      }
    });
  </script>
  <script src="${scriptsUri}"></script>
</body>
</html>`;
};

const getSubmissionsTableEntryHTML = (
  submissionResult: SubmissionResult,
  tests: ProblemTest[],
  submissionIdx: number
) => {
  const passedTestsCount = submissionResult.run_output.results?.filter(
    (result) => result.status === "PASSED"
  ).length;
  const totalTestsCount = submissionResult.run_output.results?.length;
  let accepted = totalTestsCount === passedTestsCount;

  let status = getExecutionStatus(submissionResult.run_output.results || []);

  if (submissionResult.run_output.compiled === false) {
    status = "Compilation Error";
    accepted = false;
  }

  const headerClass = accepted ? "accepted-normal" : "failed-normal";

  return `
<tr onclick='send("view-submission", ${submissionIdx})'>
  <td>Submission ${submissionIdx}</td>
  <td> <span class="${headerClass}"><b>${status}</b></span> <div class="meta">${stringifyDate(
    submissionResult.date
  )}</div></td>
  <td>${
    passedTestsCount !== undefined
      ? passedTestsCount + " / " + totalTestsCount
      : "-"
  }</td>
  <td>${
    submissionResult.grade +
    " / " +
    tests.map((x) => x?.grade || 0).reduce((acc, x) => acc + x)
  }</td>
</tr>`;
};

export const getSubmissionsTableHTML = (
  submissionResults: SubmissionResult[],
  tests: ProblemTest[]
) => {
  const submissionsData = submissionResults
    .map((submissionResult, idx) =>
      getSubmissionsTableEntryHTML(submissionResult, tests, idx)
    )
    .reverse()
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<html>
  ${head}
  <body>
  <h1>Submissions</h1>
    <table class="submissions-table">
      <thead>
          <tr>
              <th>Index</th>
              <th>Status</th>
              <th>Tests Passed</th>
              <th>Points</th>
          </tr>
      </thead>
      <tbody>
          ${submissionsData}
      </tbody>
    </table>

    <script>
      const vscode = acquireVsCodeApi();

      function send(cmd, submissionIdx) {
        vscode.postMessage({
          action: cmd,
          submissionIdx: submissionIdx
        });
      }
    </script>
  </body>
</html>
`;
};

const getDescriptionButton = () => {
  return `
<button id="description" class="btn" onclick="send('view-description')">
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M10.57 1.14L13.85 4.44L14 4.8V14.5L13.5 15H2.5L2 14.5V1.5L2.5 1H10.22L10.57 1.14ZM10 5H13L10 2V5ZM3 2V14H13V6H9.5L9 5.5V2H3ZM11 7H5V8H11V7ZM5 9H11V10H5V9ZM11 11H5V12H11V11Z" fill="#C5C5C5"/>
  </svg> Description
</button>`;
};

const getSubmissionsButton = () => {
  return `
<button id="submissions" title="View Submissions" class="btn all-submissions" onclick="send('view-submissions')">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.5 0H8.5L7 1.5V6H2.5L1 7.5V22.5699L2.5 24H14.5699L16 22.5699V18H20.7L22 16.5699V4.5L17.5 0ZM17.5 2.12L19.88 4.5H17.5V2.12ZM14.5 22.5H2.5V7.5H7V16.5699L8.5 18H14.5V22.5ZM20.5 16.5H8.5V1.5H16V6H20.5V16.5Z" fill="#C5C5C5"/>
  </svg> Submissions <span class="button-container-separator">|</span></buton>`;
};

const getDownloadTestsButton = () => {
  return `
<button id="download-tests" title="Download All Tests" class="btn download-tests" onclick="send('download-tests')">
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M11.9565 6H12.0064C12.8004 6 13.5618 6.31607 14.1232 6.87868C14.6846 7.44129 15 8.20435 15 9C15 9.79565 14.6846 10.5587 14.1232 11.1213C13.5618 11.6839 12.8004 12 12.0064 12V11C12.5357 11 13.0434 10.7893 13.4176 10.4142C13.7919 10.0391 14.0021 9.53044 14.0021 9C14.0021 8.46957 13.7919 7.96086 13.4176 7.58579C13.0434 7.21072 12.5357 7 12.0064 7H11.0924L10.9687 6.143C10.8938 5.60541 10.6456 5.10711 10.2618 4.72407C9.87801 4.34103 9.37977 4.09427 8.84303 4.02143C8.30629 3.94859 7.76051 4.05365 7.2889 4.3206C6.81729 4.58754 6.44573 5.00173 6.23087 5.5L5.89759 6.262L5.08933 6.073C4.90382 6.02699 4.71364 6.0025 4.52255 6C3.86093 6 3.22641 6.2634 2.75858 6.73224C2.29075 7.20108 2.02792 7.83696 2.02792 8.5C2.02792 9.16304 2.29075 9.79893 2.75858 10.2678C3.22641 10.7366 3.86093 11 4.52255 11H5.02148V12H4.52255C4.02745 12.0043 3.5371 11.903 3.08403 11.7029C2.63096 11.5028 2.22553 11.2084 1.89461 10.8394C1.5637 10.4703 1.31488 10.0349 1.16465 9.56211C1.01442 9.08932 0.966217 8.58992 1.02324 8.09704C1.08026 7.60416 1.24121 7.12906 1.4954 6.70326C1.74959 6.27745 2.09121 5.91068 2.49762 5.62727C2.90402 5.34385 3.36591 5.15027 3.85264 5.05937C4.33938 4.96847 4.83984 4.98232 5.32083 5.1C5.6241 4.40501 6.14511 3.82799 6.80496 3.45635C7.4648 3.08472 8.22753 2.9387 8.9776 3.04044C9.72768 3.14217 10.4242 3.4861 10.9618 4.02014C11.4993 4.55418 11.8485 5.24923 11.9565 6ZM6.70719 11.1214L8.0212 12.4354V7H9.01506V12.3992L10.2929 11.1214L11 11.8285L8.85356 13.9749H8.14645L6.00008 11.8285L6.70719 11.1214Z" fill="#C5C5C5"/>
  </svg> All Tests <span class="button-container-separator">|</span></button>`;
};

const getRestoreSkeletonButton = () => {
  return `
<button id="restore-skeleton" title="Restore Skeleton" class="btn restore-skeleton" onclick="send('restore-skeleton')">
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M5.56253 2.51577C3.46348 3.4501 2 5.55414 2 7.99999C2 11.3137 4.68629 14 8 14C11.3137 14 14 11.3137 14 7.99999C14 5.32519 12.2497 3.05919 9.83199 2.28482L9.52968 3.23832C11.5429 3.88454 13 5.7721 13 7.99999C13 10.7614 10.7614 13 8 13C5.23858 13 3 10.7614 3 7.99999C3 6.31104 3.83742 4.81767 5.11969 3.91245L5.56253 2.51577Z" fill="#C5C5C5"/>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M5 3H2V2H5.5L6 2.5V6H5V3Z" fill="#C5C5C5"/>
  </svg> Restore Skeleton <span id="restore-skeleton-separator" class="button-container-separator">|</span></button>`;
};

const getContestRankingsButton = () => {
  return `
<button id="contest-ranking" title="View Contest Ranking" class="btn contest-ranking" onclick="send('contest-ranking')">
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M1.5 14H15V13H2V0H1V13.5L1.5 14ZM3 11.5V3.5L3.5 3H5.5L6 3.5V11.5L5.5 12H3.5L3 11.5ZM5 11V4H4V11H5ZM11 1.5V11.5L11.5 12H13.5L14 11.5V1.5L13.5 1H11.5L11 1.5ZM13 2V11H12V2H13ZM7 11.5V5.5L7.5 5H9.5L10 5.5V11.5L9.5 12H7.5L7 11.5ZM9 11V6H8V11H9Z" fill="#C5C5C5"/>
  </svg> Contest Ranking <span class="button-container-separator" style="visibility: hidden;">|</span></button>`;
};

const getInitialTestsButtons = (countInitialTests: number) => {
  let buttonsStr = "";

  for (let i = 1; i <= countInitialTests; ++i) {
    buttonsStr += `
<span class="test-btn-wrapper" id="test-${i}-btn-wrapper">
  <span class="separator">|</span>

  <button id="test-${i}-btn" class="test-btn" onclick="revealTestById('test-${i}')"><span id="test-${i}-btn">Test ${i}</span></button>
  <button class="test-btn-remove" id="test-${i}-btn-remove" onclick="removeTestById('test-${i}')">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 8H1V7H15V8Z" fill="#C5C5C5"/>
    </svg>
  </button>
</span>
`;
  }

  return buttonsStr;
};

const getInitialTestsHTML = (tests: ProblemTest[]) => {
  return tests
    .map(
      (test, idx) => `
<div class="hidden" id="test-${idx + 1}-content">
  <h3>Input:</h3>
  <div class="upload-container">
    <textarea class="test-input" style="max-height: 300px; " id="test-${
      idx + 1
    }-input" rows=1>${test.input || ""}</textarea>
    <button type="button" class="upload" onclick="uploadTestFile('test-${
      idx + 1
    }-input')">
      <svg id="upload-button" width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M11.9564 6H12.0063C12.8003 6 13.5617 6.31607 14.1231 6.87868C14.6845 7.44129 14.9999 8.20435 14.9999 9C14.9999 9.79565 14.6845 10.5587 14.1231 11.1213C13.5617 11.6839 12.8003 12 12.0063 12H10.0106V11H12.0063C12.5356 11 13.0432 10.7893 13.4175 10.4142C13.7918 10.0391 14.002 9.53044 14.002 9C14.002 8.46957 13.7918 7.96086 13.4175 7.58579C13.0432 7.21072 12.5356 7 12.0063 7H11.0923L10.9686 6.143C10.8937 5.60541 10.6455 5.10711 10.2617 4.72407C9.87792 4.34103 9.37968 4.09427 8.84295 4.02143C8.30621 3.94859 7.76044 4.05365 7.28883 4.3206C6.81723 4.58754 6.44567 5.00173 6.23082 5.5L5.89754 6.262L5.08929 6.073C4.90378 6.02699 4.71361 6.0025 4.52251 6C3.8609 6 3.22639 6.2634 2.75856 6.73224C2.29073 7.20108 2.02791 7.83696 2.02791 8.5C2.02791 9.16304 2.29073 9.79893 2.75856 10.2678C3.22639 10.7366 3.8609 11 4.52251 11H7.01712V12H4.52251C4.02742 12.0043 3.53708 11.903 3.08401 11.7029C2.63095 11.5028 2.22551 11.2084 1.8946 10.8394C1.56369 10.4703 1.31487 10.0349 1.16465 9.56211C1.01442 9.08932 0.966218 8.58992 1.02324 8.09704C1.08026 7.60416 1.24121 7.12906 1.49539 6.70326C1.74958 6.27745 2.0912 5.91068 2.4976 5.62727C2.904 5.34385 3.36588 5.15027 3.85261 5.05937C4.33935 4.96847 4.8398 4.98232 5.32079 5.1C5.62405 4.40501 6.14506 3.82799 6.8049 3.45635C7.46474 3.08472 8.22745 2.9387 8.97752 3.04044C9.72759 3.14217 10.4241 3.4861 10.9617 4.02014C11.4992 4.55418 11.8484 5.24923 11.9564 6ZM10.2928 9.85348L8.97879 8.53944L8.97879 13.9749H7.98492L7.98493 8.57568L6.7071 9.85347L5.99999 9.14636L8.14643 6.99998H8.85354L10.9999 9.14637L10.2928 9.85348Z" fill="#C5C5C5"/>
      </svg>
    </button>
  </div>

  <h3>Output:</h3>
  <div class="upload-container">
    <textarea class="test-input" style="max-height: 300px; " id="test-${
      idx + 1
    }-output" rows=1>${test.output || ""}</textarea>
    <button type="button" class="upload" onclick="uploadTestFile('test-${
      idx + 1
    }-output')">
      <svg id="upload-button" width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M11.9564 6H12.0063C12.8003 6 13.5617 6.31607 14.1231 6.87868C14.6845 7.44129 14.9999 8.20435 14.9999 9C14.9999 9.79565 14.6845 10.5587 14.1231 11.1213C13.5617 11.6839 12.8003 12 12.0063 12H10.0106V11H12.0063C12.5356 11 13.0432 10.7893 13.4175 10.4142C13.7918 10.0391 14.002 9.53044 14.002 9C14.002 8.46957 13.7918 7.96086 13.4175 7.58579C13.0432 7.21072 12.5356 7 12.0063 7H11.0923L10.9686 6.143C10.8937 5.60541 10.6455 5.10711 10.2617 4.72407C9.87792 4.34103 9.37968 4.09427 8.84295 4.02143C8.30621 3.94859 7.76044 4.05365 7.28883 4.3206C6.81723 4.58754 6.44567 5.00173 6.23082 5.5L5.89754 6.262L5.08929 6.073C4.90378 6.02699 4.71361 6.0025 4.52251 6C3.8609 6 3.22639 6.2634 2.75856 6.73224C2.29073 7.20108 2.02791 7.83696 2.02791 8.5C2.02791 9.16304 2.29073 9.79893 2.75856 10.2678C3.22639 10.7366 3.8609 11 4.52251 11H7.01712V12H4.52251C4.02742 12.0043 3.53708 11.903 3.08401 11.7029C2.63095 11.5028 2.22551 11.2084 1.8946 10.8394C1.56369 10.4703 1.31487 10.0349 1.16465 9.56211C1.01442 9.08932 0.966218 8.58992 1.02324 8.09704C1.08026 7.60416 1.24121 7.12906 1.49539 6.70326C1.74958 6.27745 2.0912 5.91068 2.4976 5.62727C2.904 5.34385 3.36588 5.15027 3.85261 5.05937C4.33935 4.96847 4.8398 4.98232 5.32079 5.1C5.62405 4.40501 6.14506 3.82799 6.8049 3.45635C7.46474 3.08472 8.22745 2.9387 8.97752 3.04044C9.72759 3.14217 10.4241 3.4861 10.9617 4.02014C11.4992 4.55418 11.8484 5.24923 11.9564 6ZM10.2928 9.85348L8.97879 8.53944L8.97879 13.9749H7.98492L7.98493 8.57568L6.7071 9.85347L5.99999 9.14636L8.14643 6.99998H8.85354L10.9999 9.14637L10.2928 9.85348Z" fill="#C5C5C5"/>
      </svg>
    </button>
  </div>
</div>`
    )
    .join("");
};

const getCategoriesHTML = (categories: string) => {
  return categories
    .split(";")
    .map(
      (category) => `
<div class="difficulty-wrapper">
  <span class="label">${category}</span>
</div>`
    )
    .join("");
};

const getContestLabelHTML = (
  contestName: string | undefined,
  problemIndexWithinContest: number | undefined
) => {
  if (contestName === undefined) {
    return "";
  }

  return `
<div class="contest-name-wrapper">
  <span class="label">Contest ${contestName} - ${String.fromCharCode(
    "A".charCodeAt(0) + problemIndexWithinContest!
  )} </span>
</div>`;
};

export const getProblemHTML = (
  scriptsUri: vscode.Uri,
  stylesUri: vscode.Uri,
  problemData: SpecificProblem,
  contestMetadata?: Contest
) => {
  const title = `${problemData.id}. ${problemData.name}`;

  return `
<!DOCTYPE html>
<html lang="en">
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    ${styles}
    <style>
      body {
        border-left: 3px solid #8c30f5;
      }

      hr {
        border-color: black;
      }

      div.tests-container {
        padding-top: 0px;
        min-height: 0px !important;
      }
    </style>

    ${problemButtonsStyle}

    <link rel='stylesheet' type='text/css' href='${stylesUri}'>
  </head>
  <body>
    <div class="button-container-wrapper">
      <div class="button-container">
        ${getSubmissionsButton()}
        ${getDownloadTestsButton()}
        ${getRestoreSkeletonButton()}
        ${getContestRankingsButton()}
      </div>
    </div>

    <h1 class="problem-name">
      <div class="title-wrapper">
        <div>${title} ${
    !ProblemDataProvider.ownedProblems.includes(problemData.id)
      ? ""
      : `
        <button id="edit-problem" class="btn edit-problem" onclick="send('edit-problem')">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.23 1H11.77L3.52002 9.25L3.35999 9.46997L1 13.59L2.41003 15L6.53003 12.64L6.75 12.48L15 4.22998V2.77002L13.23 1ZM2.41003 13.59L3.92004 10.59L5.37 12.04L2.41003 13.59ZM6.23999 11.53L4.46997 9.76001L12.47 1.76001L14.24 3.53003L6.23999 11.53Z" fill="#C5C5C5"/>
          </svg>
        </button>`
  }     </div>
        <div class="labels-container-wrapper">
          <div class="difficulty-wrapper">
            <span class="${problemData.difficulty.toLowerCase()} label">${
    problemData.difficulty
  }</span>
          </div>
          ${getCategoriesHTML(problemData.categories)}
          ${getContestLabelHTML(
            contestMetadata?.name,
            contestMetadata?.problems.findIndex((x) => x.id === problemData.id)
          )}
        </div>
      </div>
      <div id="countdown" class="clock-wrapper" style="display: none;">
        <div id="countdown-text" class="countdown-inner">
          <div id="countdown-days-column" class="countdown-column">
            <span id="countdown-days" class="top-layer-countdown">00</span>
            <span id="countdown-days-text" class="bottom-layer-countdown">Days</span>
          </div>

          <div class="countdown-column">
            <span id="countdown-hours" class="top-layer-countdown">00</span>
            <span id="countdown-hours-text" class="bottom-layer-countdown">Hours</span>
          </div>

          <div class="countdown-column">
            <span id="countdown-minutes" class="top-layer-countdown">00</span>
            <span id="countdown-minutes-text" class="bottom-layer-countdown">Minutes</span>
          </div>

          <div class="countdown-column">
            <span id="countdown-seconds" class="top-layer-countdown">00</span>
            <span id="countdown-seconds-text" class="bottom-layer-countdown">Seconds</span>
          </div>
        </div>
      </div>
    </h1>
    <p>${problemData.description}</p>

    <div class="buttons">
      <span id="test-buttons-container">
        <button id="example" class="test-btn test-btn-example" onclick="revealTestById('example')"><span class="test-btn-active-text" id="example-btn">Example</span></button>
        ${getInitialTestsButtons(Math.min(3, problemData.tests.length - 1))}
      </span>
      <button class="test-btn-add test-btn" onclick="addTest()">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14.0001 7V8H8.00012V14H7.00012V8H1.00012V7H7.00012V1H8.00012V7H14.0001Z" fill="#C5C5C5"/>
        </svg>
      </button>
    </div>

    <div id="tests-container">
      <div id="example-content">
        <h3>Input:</h3>
        <div class="upload-container">
          <textarea class="test-input" style="max-height: 300px; " name="example-input" id="example-input" rows=1>${
            problemData.example?.input || ""
          }</textarea>
          <button type="button" class="upload" onclick="uploadTestFile('example-input')">
            <svg id="upload-button" width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M11.9564 6H12.0063C12.8003 6 13.5617 6.31607 14.1231 6.87868C14.6845 7.44129 14.9999 8.20435 14.9999 9C14.9999 9.79565 14.6845 10.5587 14.1231 11.1213C13.5617 11.6839 12.8003 12 12.0063 12H10.0106V11H12.0063C12.5356 11 13.0432 10.7893 13.4175 10.4142C13.7918 10.0391 14.002 9.53044 14.002 9C14.002 8.46957 13.7918 7.96086 13.4175 7.58579C13.0432 7.21072 12.5356 7 12.0063 7H11.0923L10.9686 6.143C10.8937 5.60541 10.6455 5.10711 10.2617 4.72407C9.87792 4.34103 9.37968 4.09427 8.84295 4.02143C8.30621 3.94859 7.76044 4.05365 7.28883 4.3206C6.81723 4.58754 6.44567 5.00173 6.23082 5.5L5.89754 6.262L5.08929 6.073C4.90378 6.02699 4.71361 6.0025 4.52251 6C3.8609 6 3.22639 6.2634 2.75856 6.73224C2.29073 7.20108 2.02791 7.83696 2.02791 8.5C2.02791 9.16304 2.29073 9.79893 2.75856 10.2678C3.22639 10.7366 3.8609 11 4.52251 11H7.01712V12H4.52251C4.02742 12.0043 3.53708 11.903 3.08401 11.7029C2.63095 11.5028 2.22551 11.2084 1.8946 10.8394C1.56369 10.4703 1.31487 10.0349 1.16465 9.56211C1.01442 9.08932 0.966218 8.58992 1.02324 8.09704C1.08026 7.60416 1.24121 7.12906 1.49539 6.70326C1.74958 6.27745 2.0912 5.91068 2.4976 5.62727C2.904 5.34385 3.36588 5.15027 3.85261 5.05937C4.33935 4.96847 4.8398 4.98232 5.32079 5.1C5.62405 4.40501 6.14506 3.82799 6.8049 3.45635C7.46474 3.08472 8.22745 2.9387 8.97752 3.04044C9.72759 3.14217 10.4241 3.4861 10.9617 4.02014C11.4992 4.55418 11.8484 5.24923 11.9564 6ZM10.2928 9.85348L8.97879 8.53944L8.97879 13.9749H7.98492L7.98493 8.57568L6.7071 9.85347L5.99999 9.14636L8.14643 6.99998H8.85354L10.9999 9.14637L10.2928 9.85348Z" fill="#C5C5C5"/>
            </svg>
          </button>
        </div>

        <h3>Output:</h3>
        <div class="upload-container">
          <textarea class="test-input" style="max-height: 300px; " name="example-output" id="example-output" rows=1>${
            problemData.example?.output || ""
          }</textarea>
          <button type="button" class="upload" onclick="uploadTestFile('example-output')">
            <svg id="upload-button" width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M11.9564 6H12.0063C12.8003 6 13.5617 6.31607 14.1231 6.87868C14.6845 7.44129 14.9999 8.20435 14.9999 9C14.9999 9.79565 14.6845 10.5587 14.1231 11.1213C13.5617 11.6839 12.8003 12 12.0063 12H10.0106V11H12.0063C12.5356 11 13.0432 10.7893 13.4175 10.4142C13.7918 10.0391 14.002 9.53044 14.002 9C14.002 8.46957 13.7918 7.96086 13.4175 7.58579C13.0432 7.21072 12.5356 7 12.0063 7H11.0923L10.9686 6.143C10.8937 5.60541 10.6455 5.10711 10.2617 4.72407C9.87792 4.34103 9.37968 4.09427 8.84295 4.02143C8.30621 3.94859 7.76044 4.05365 7.28883 4.3206C6.81723 4.58754 6.44567 5.00173 6.23082 5.5L5.89754 6.262L5.08929 6.073C4.90378 6.02699 4.71361 6.0025 4.52251 6C3.8609 6 3.22639 6.2634 2.75856 6.73224C2.29073 7.20108 2.02791 7.83696 2.02791 8.5C2.02791 9.16304 2.29073 9.79893 2.75856 10.2678C3.22639 10.7366 3.8609 11 4.52251 11H7.01712V12H4.52251C4.02742 12.0043 3.53708 11.903 3.08401 11.7029C2.63095 11.5028 2.22551 11.2084 1.8946 10.8394C1.56369 10.4703 1.31487 10.0349 1.16465 9.56211C1.01442 9.08932 0.966218 8.58992 1.02324 8.09704C1.08026 7.60416 1.24121 7.12906 1.49539 6.70326C1.74958 6.27745 2.0912 5.91068 2.4976 5.62727C2.904 5.34385 3.36588 5.15027 3.85261 5.05937C4.33935 4.96847 4.8398 4.98232 5.32079 5.1C5.62405 4.40501 6.14506 3.82799 6.8049 3.45635C7.46474 3.08472 8.22745 2.9387 8.97752 3.04044C9.72759 3.14217 10.4241 3.4861 10.9617 4.02014C11.4992 4.55418 11.8484 5.24923 11.9564 6ZM10.2928 9.85348L8.97879 8.53944L8.97879 13.9749H7.98492L7.98493 8.57568L6.7071 9.85347L5.99999 9.14636L8.14643 6.99998H8.85354L10.9999 9.14637L10.2928 9.85348Z" fill="#C5C5C5"/>
            </svg>
          </button>
        </div>
      </div>

      ${getInitialTestsHTML(problemData.tests.slice(1, 4))}
    </div>

    <div class="buttons">
      <button id="submit" class="bottom-btn submit" onclick="send('submit')">Submit</button>
      <button id="run" class="bottom-btn run" onclick="run()">Run</button>
      <button id="code" class="bottom-btn code" onclick="send('code')">Code</button>
    </div>

    <script>
      const vscode = acquireVsCodeApi();
      const contestEndDate = new Date("${contestMetadata?.end_date}");
      const contestId = ${contestMetadata?.id};

      vscode.setState(${JSON.stringify({
        problem: problemData,
        contestMetadata: contestMetadata,
      })});

      function send(cmd) {
        vscode.postMessage({
          action: cmd,
          contestId: ${contestMetadata?.id},
        });
      }

      function run() {
        vscode.postMessage({
          action: 'run',
          tests: getTestData(),
        });
      }
    </script>

    <script src="${scriptsUri}"></script>
  </body>
</html>
`;
};

const stringifyDateSlim = (date: Date) => {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear().toString();

  const hour = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minutes}`;
};

const getSubjectOptionsHTML = () => {
  return Object.values(ContestSubject).map(
    (subject) => `<option width=100px value='${subject}'>${subject}</option>`
  );
};

export const getContestCreationHTML = (
  stylesUri: vscode.Uri,
  scriptsPath: vscode.Uri,
  editMode: boolean = false
) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${editMode ? "Edit Contest" : "Create Contest"}</title>
    
    ${styles}

    ${problemButtonsStyle}
  
    <link rel='stylesheet' type='text/css' href='${stylesUri}'>
  </head>
  <body>
    <h1>${editMode ? "Edit Contest" : "Create Contest"}</h1>
    <form id="contest-form">
      <label for="name-input">Contest Name</label>

      <input class="name-input purple-border" type="text" id="name-input" name="name-input" placeholder="Contest Name*" required>

      <div class="date-input-container">
        <label for="start-date">Start Date</label>
        <label for="end-date">End Date</label>
      </div>

      <div class="date-input-container">
        <input class="purple-border" type="datetime-local" id="start-date" name="start-date" value="${stringifyDateSlim(
          new Date()
        )}" required>
        <input class="purple-border" type="datetime-local" id="end-date" name="end-date" value="${stringifyDateSlim(
          new Date(new Date().getTime() + 60 * 60 * 1000)
        )}" required>
      </div>
  
      <label for="collab-input">Collaborator</label>
      <div class="autocomplete-container">
        <input class="collab-input purple-border" type="text" id="collab-input" name="collab-input" placeholder="Username, name or email address">
        <ul class="suggestions" id="suggestions"></ul>
      </div>
  
      <label for="subject-input">Subject</label>
      <div class="autocomplete-container">
          <input class="subject-input purple-border" type="text" id="subject-input" name="subject-input" placeholder="Subject*" required>
          <ul class="suggestions" id="subject-suggestions"></ul>
      </div>
  
      <label for="description-input">Description</label>
      <textarea class="purple-border" id="description-input" name="description-input" rows="2" placeholder="Description*" required></textarea>
  
      <label for="password-input">Password</label>

      <div class="password-container">
        <input class="password-input purple-border" type="password" id="password-input" name="password-input" placeholder="Optional Password">
        <button type="button" class="toggle-password" onclick="revealPassword()">
          <svg id="eye-icon" width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'>
            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"></path>
          </svg>
        </button>
      </div>
  
      <label for="problems">Problems</label>
      <div class="autocomplete-container">
        <div id="input-wrapper" class="problems-input-wrapper input-wrapper"></div>
        <input class="problems-input purple-border" type="text" id="problems-input" name="problems" placeholder="1. Hello ...">
        <ul class="suggestions problems-suggestions" id="problems-suggestions"></ul>
      </div>
  
      <label for="quotas-input">Quotas (comma-separated values)</label>
      <input class="purple-border" type="text" id="quotas-input" name="quotas-input" placeholder="Quotas">

      <button type="submit" id="code" class="btn code">${
        editMode ? "Edit Contest" : "Create Contest"
      }</button>
    </form>
  
    <script>
      const subjects = [${Object.values(ContestSubject).map(
        (subject) => `"${subject}"`
      )}];
    </script>
    <script src="${scriptsPath}"></script>
  </body>
  </html>
`;
};

export const getProblemCreationHTML = (
  stylesUri: vscode.Uri,
  scriptsUri: vscode.Uri,
  editMode: boolean = false
) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${editMode ? "Edit Problem" : "Create Problem"}</title>
    
    ${styles}

    ${problemButtonsStyle}
  
    <link rel='stylesheet' type='text/css' href='${stylesUri}'>
  </head>
  <body>
    <h1>${editMode ? "Edit Problem" : "Create Problem"}</h1>
    <form id="problem-form">
      <label for="name-input">Problem Name</label>
      <input class="name-input purple-border" type="text" id="name-input" name="name-input" placeholder="Problem Name" required>

      <label for="language-input">Language</label>
      <div class="autocomplete-container">
          <input class="language-input purple-border" type="text" id="language-input" name="language-input" placeholder="C" required>
          <ul class="suggestions" id="language-suggestions"></ul>
      </div>

      <label for="difficulty-input">Difficulty</label>
      <div class="autocomplete-container">
          <input class="difficulty-input purple-border" type="text" id="difficulty-input" name="difficulty-input" placeholder="Medium" required>
          <ul class="suggestions" id="difficulty-suggestions"></ul>
      </div>

      <label for="categories">Categories</label>
      <div class="autocomplete-container">
        <div id="input-wrapper" class="categories-input-wrapper input-wrapper"></div>
        <input class="categories-input purple-border" type="text" id="categories-input" name="categories" placeholder="SDA">
      </div>

      <label for="description-input">Description</label>
      <textarea class="purple-border" id="description-input" name="description-input" style="max-height: 300px; " rows=2 placeholder="Description" required></textarea>

      <label for="visibility-input">Visibility</label>
      <div class="centered">
        <div class="hidden-toggles">
          <input name="visibility-level" type="radio" id="visibility-public" class="hidden-toggles__input" checked>
          <label for="visibility-public" class="hidden-toggles__label">Public</label>
          
          <input name="visibility-level" type="radio" id="visibility-private" class="hidden-toggles__input">
          <label for="visibility-private" class="hidden-toggles__label">Private</label>	
        </div>
      </div>

      <label for="skeleton-input">Skeleton</label>
      <div class="buttons skeleton-buttons">
        <span id="skeleton-buttons-container">
          <button type="button" id="write-skel-btn" class="test-btn test-btn-example test-btn-active-text" onclick="writeSkeleton()">Write Here</button>
          <span class="separator">|</span>
          <button type="button" id="open-skel-btn" class="test-btn test-btn-example" onclick="openSkeletonFile()">Open in Editor</button>
          <span class="separator">|</span>
          <button type="button" id="upload-skel-btn" class="test-btn test-btn-example" onclick="uploadSkeletonFile()">Upload</button>
        </span>
      </div>
      <textarea class="purple-border skeleton-input" id="skeleton-input" style="max-height: 300px; " rows=2 placeholder="Skeleton"></textarea>

      <label for="tests-input">Tests</label>
      <div class="buttons">
        <span id="test-buttons-container">
          <button type="button" id="example" class="test-btn test-btn-example" onclick="revealTestById('example')"><span class="test-btn-active-text" id="example-btn">Example</span></button>
        </span>
        <button type="button" class="test-btn-add test-btn" onclick="addTest()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14.0001 7V8H8.00012V14H7.00012V8H1.00012V7H7.00012V1H8.00012V7H14.0001Z" fill="#C5C5C5"/>
          </svg>
        </button>
      </div>

      <div class="tests-container" id="tests-container">
        <div id="example-content">
          <h3>Input:</h3>
          <div class="upload-container">
            <textarea class="test-input" style="max-height: 300px; " name="example-input" id="example-input" rows=1></textarea>
            <button type="button" class="upload" onclick="uploadTestFile('example-input')">
              <svg id="upload-button" width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M11.9564 6H12.0063C12.8003 6 13.5617 6.31607 14.1231 6.87868C14.6845 7.44129 14.9999 8.20435 14.9999 9C14.9999 9.79565 14.6845 10.5587 14.1231 11.1213C13.5617 11.6839 12.8003 12 12.0063 12H10.0106V11H12.0063C12.5356 11 13.0432 10.7893 13.4175 10.4142C13.7918 10.0391 14.002 9.53044 14.002 9C14.002 8.46957 13.7918 7.96086 13.4175 7.58579C13.0432 7.21072 12.5356 7 12.0063 7H11.0923L10.9686 6.143C10.8937 5.60541 10.6455 5.10711 10.2617 4.72407C9.87792 4.34103 9.37968 4.09427 8.84295 4.02143C8.30621 3.94859 7.76044 4.05365 7.28883 4.3206C6.81723 4.58754 6.44567 5.00173 6.23082 5.5L5.89754 6.262L5.08929 6.073C4.90378 6.02699 4.71361 6.0025 4.52251 6C3.8609 6 3.22639 6.2634 2.75856 6.73224C2.29073 7.20108 2.02791 7.83696 2.02791 8.5C2.02791 9.16304 2.29073 9.79893 2.75856 10.2678C3.22639 10.7366 3.8609 11 4.52251 11H7.01712V12H4.52251C4.02742 12.0043 3.53708 11.903 3.08401 11.7029C2.63095 11.5028 2.22551 11.2084 1.8946 10.8394C1.56369 10.4703 1.31487 10.0349 1.16465 9.56211C1.01442 9.08932 0.966218 8.58992 1.02324 8.09704C1.08026 7.60416 1.24121 7.12906 1.49539 6.70326C1.74958 6.27745 2.0912 5.91068 2.4976 5.62727C2.904 5.34385 3.36588 5.15027 3.85261 5.05937C4.33935 4.96847 4.8398 4.98232 5.32079 5.1C5.62405 4.40501 6.14506 3.82799 6.8049 3.45635C7.46474 3.08472 8.22745 2.9387 8.97752 3.04044C9.72759 3.14217 10.4241 3.4861 10.9617 4.02014C11.4992 4.55418 11.8484 5.24923 11.9564 6ZM10.2928 9.85348L8.97879 8.53944L8.97879 13.9749H7.98492L7.98493 8.57568L6.7071 9.85347L5.99999 9.14636L8.14643 6.99998H8.85354L10.9999 9.14637L10.2928 9.85348Z" fill="#C5C5C5"/>
              </svg>
            </button>
          </div>

          <h3>Output:</h3>
          <div class="upload-container">
            <textarea class="test-input" style="max-height: 300px; " name="example-output" id="example-output" rows=1></textarea>
            <button type="button" class="upload" onclick="uploadTestFile('example-output')">
              <svg id="upload-button" width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M11.9564 6H12.0063C12.8003 6 13.5617 6.31607 14.1231 6.87868C14.6845 7.44129 14.9999 8.20435 14.9999 9C14.9999 9.79565 14.6845 10.5587 14.1231 11.1213C13.5617 11.6839 12.8003 12 12.0063 12H10.0106V11H12.0063C12.5356 11 13.0432 10.7893 13.4175 10.4142C13.7918 10.0391 14.002 9.53044 14.002 9C14.002 8.46957 13.7918 7.96086 13.4175 7.58579C13.0432 7.21072 12.5356 7 12.0063 7H11.0923L10.9686 6.143C10.8937 5.60541 10.6455 5.10711 10.2617 4.72407C9.87792 4.34103 9.37968 4.09427 8.84295 4.02143C8.30621 3.94859 7.76044 4.05365 7.28883 4.3206C6.81723 4.58754 6.44567 5.00173 6.23082 5.5L5.89754 6.262L5.08929 6.073C4.90378 6.02699 4.71361 6.0025 4.52251 6C3.8609 6 3.22639 6.2634 2.75856 6.73224C2.29073 7.20108 2.02791 7.83696 2.02791 8.5C2.02791 9.16304 2.29073 9.79893 2.75856 10.2678C3.22639 10.7366 3.8609 11 4.52251 11H7.01712V12H4.52251C4.02742 12.0043 3.53708 11.903 3.08401 11.7029C2.63095 11.5028 2.22551 11.2084 1.8946 10.8394C1.56369 10.4703 1.31487 10.0349 1.16465 9.56211C1.01442 9.08932 0.966218 8.58992 1.02324 8.09704C1.08026 7.60416 1.24121 7.12906 1.49539 6.70326C1.74958 6.27745 2.0912 5.91068 2.4976 5.62727C2.904 5.34385 3.36588 5.15027 3.85261 5.05937C4.33935 4.96847 4.8398 4.98232 5.32079 5.1C5.62405 4.40501 6.14506 3.82799 6.8049 3.45635C7.46474 3.08472 8.22745 2.9387 8.97752 3.04044C9.72759 3.14217 10.4241 3.4861 10.9617 4.02014C11.4992 4.55418 11.8484 5.24923 11.9564 6ZM10.2928 9.85348L8.97879 8.53944L8.97879 13.9749H7.98492L7.98493 8.57568L6.7071 9.85347L5.99999 9.14636L8.14643 6.99998H8.85354L10.9999 9.14637L10.2928 9.85348Z" fill="#C5C5C5"/>
              </svg>
            </button>
          </div>

          <h3>Grade:</h3>
          <textarea class="test-input" name="example-grade" id="example-grade" rows=1></textarea>
        </div>
      </div>

      <button type="submit" class="btn code">${
        editMode ? "Edit Problem" : "Create Problem"
      }</button>
    </form>
  
    <script>
      const languages = [${Object.values(Language).map(
        (language) => `"${language}"`
      )}];

      const difficulties = [${Object.values(Difficulty).map(
        (language) => `"${language}"`
      )}];
    </script>
    <script src="${scriptsUri}"></script>
  </body>
  </html>
`;
};
