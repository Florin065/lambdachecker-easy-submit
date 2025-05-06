import { SpecificProblem } from "../api";

export const getProblemWebviewContent = (
  problemData: SpecificProblem,
  contestId?: number
) => {
  const title = `${problemData.id}. ${problemData.name}`;

  console.log("Registered contest id", contestId);

  return `
<!DOCTYPE html>
<html lang="en">
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      body {
        border-left: 3px solid #8c30f5;
      }
      h1 {
        font-size: 26px;
      }
      code, svg, li, .highlight, p, pre {
        font-size: 14px;
      }
      li {
        margin: 5px 0;
      }
      pre {
        background-color: rgba(0, 0, 0, 0.4);
        padding: 10px;
        border-radius: 10px;
      }
      h1, h2, h3, h4, h5, h6, p, code, svg, li, .highlight, pre {
        color: white;
      }
      p, li {
        line-height: 1.7;
      }
      .btn {
        font-size: 15px;
        padding: 10px 25px;
        border: none;
        cursor: pointer;
        font-weight: 500;
        border-radius: 3px;
      }
      .buttons::after {
        content: "";
        display: table;
        clear: both;
      }
      .code {
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
        background-color: #b680f3;
      }
      .submit:hover {
        background-color: #8c30f5;
        transition: 0.1s;
      }
      .submit:active {
        transform: translateY(4px); 
      }
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    <p>${problemData.description}</p>

    <h2>Exemplu:</h2>
    <h3>Input:</h3>
    <pre>${problemData.example.input}</pre>

    <h3>Output:</h3>
    <pre>${problemData.example.output}</pre>

    <div class="buttons">
      <button id="submit" class="btn submit" onclick="send('submit')">Submit</button>
      <button id="run" class="btn run" onclick="send('run')">Run</button>
      <button id="code" class="btn code" onclick="send('code')">Code</button>
    </div>

    <script>
      const vscode = acquireVsCodeApi();

      vscode.setState(${JSON.stringify(problemData)});

      function send(cmd) {
        vscode.postMessage({
          action: cmd,
          contestId: ${contestId},
        });
      }
    </script>
  </body>
</html>
`;
};
