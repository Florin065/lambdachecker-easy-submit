import * as vscode from "vscode";
import { LambdaChecker } from "../../commands";
import {
  Contest,
  MaxSubmissionMeta,
  ProblemMetadataContestContext,
  ProblemTotalGrade,
  RankListEntry,
  User,
} from "../api";

const getProblemsHeaderHTML = (
  problems: ProblemMetadataContestContext[],
  problemsGrades: ProblemTotalGrade[]
) => {
  return problems
    .map(
      (problem, idx) =>
        `<th><div class="header-cell-wrapper" onclick="showProblem(${
          problem.id
        })">
            <span class="top-layer-countdown">${String.fromCharCode(
              "A".charCodeAt(0) + idx
            )}</span>
            <span class="bottom-layer-countdown">${
              problemsGrades.filter((x) => x.id === problem.id)[0]?.total || 0
            } points</span>
          </div>
        </th>`
    )
    .join("");
};

const formatDeltaT = (contestStart: string, submissionDate: string) => {
  const distance =
    new Date(submissionDate).getTime() - new Date(contestStart).getTime();

  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor((distance % (1000 * 60)) / 1000)
    .toString()
    .padStart(2, "0");

  if (days > 0) {
    return `${days}:${hours.toString().padStart(2, "0")}:${minutes}:${seconds}`;
  }

  return `${hours}:${minutes}:${seconds}`;
};

const getRankingTableEntryHTML = (
  rankListEntry: RankListEntry,
  rank: number,
  problems: ProblemMetadataContestContext[],
  contestStart: string,
  problemsGrades: ProblemTotalGrade[]
) => {
  const orderedMaxSubmissions: (MaxSubmissionMeta | undefined)[] = [];
  const orderedProblemsGrades: (ProblemTotalGrade | undefined)[] = [];

  // Use the same ordering for contest problems,
  // max submissions and problems grades
  for (let i = 0; i < problems.length; i++) {
    orderedMaxSubmissions.push(
      rankListEntry.max_submissions.filter(
        (x) => x.problem_id === problems[i].id
      )[0]
    );

    orderedProblemsGrades.push(
      problemsGrades.filter((x) => x.id === problems[i].id)[0]
    );
  }

  let maxSubmissionsData = "";
  for (let i = 0; i < problems.length; ++i) {
    if (orderedMaxSubmissions[i] === undefined) {
      maxSubmissionsData += `<td></td>`;

      continue;
    }

    maxSubmissionsData += `
<td>
  <div class="grade-cell-wrapper">
    <span class="${
      orderedProblemsGrades[i]!.total === orderedMaxSubmissions[i]!.grade
        ? "accepted"
        : "failed"
    }">${orderedMaxSubmissions[i]!.grade || "0"}</span>
    <span class="bottom-layer-countdown">${formatDeltaT(
      contestStart,
      orderedMaxSubmissions[i]!.date
    )}</span>
    <span class="bottom-layer-countdown" ${
      orderedMaxSubmissions[i]!.all_subs_count <= 1
        ? `style="visibility: hidden;"`
        : ""
    }>(-${orderedMaxSubmissions[i]!.all_subs_count - 1})</span>
  </div>
</td>`;
  }

  return `
  <tr>
    <td>${rank}</td>
    <td>${rankListEntry.username}</td>
    <td>${rankListEntry.points}</td>
    ${maxSubmissionsData}
  </tr>
  `;
};

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

const getPaginationElement = (
  currentPage: number,
  totalPages: number,
  currentSlidingWindow: number[]
) => {
  let paginationItems = "";

  for (let i = currentSlidingWindow[0]; i <= currentSlidingWindow[1]; ++i) {
    if (currentPage === i) {
      paginationItems += `<button class="pagination-button pagination-button-active" id="page-${i}-btn" onclick="updateRankingPage(${i})">${i}</button>`;
    } else {
      paginationItems += `<button class="pagination-button" id="page-${i}-btn" onclick="updateRankingPage(${i})">${i}</button>`;
    }
  }

  for (let i = 1; i <= totalPages; ++i) {
    if (i >= currentSlidingWindow[0] && i <= currentSlidingWindow[1]) {
      continue;
    }

    paginationItems += `<span class="pagination-button" id="page-${i}-btn" onclick="updateRankingPage(${i})" style="display: none;">${i}</span>`;
  }

  if (totalPages - currentSlidingWindow[1] <= 1) {
    paginationItems += `<button id="points" class="sentinel-button" disabled style="display: none;">...</button>`;
    paginationItems += `<button id="dummy-btn" class="sentinel-button" disabled style="display: none;">${totalPages}</button>`;
  } else {
    paginationItems += `<button id="points" class="sentinel-button" disabled>...</button>`;
    paginationItems += `<button id="dummy-btn" class="sentinel-button" disabled>${totalPages}</button>`;
  }

  return `
<div class="pagination-wrapper">
  <button class="pagination-button sentinel-button" onclick="updateRankingPage('-1')">
    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="12" viewBox="0 0 8 12">
      <path d="M5.874.35a1.28 1.28 0 011.761 0 1.165 1.165 0 010 1.695L3.522 6l4.113 3.955a1.165 1.165 0 010 1.694 1.28 1.28 0 01-1.76 0L0 6 5.874.35z" />
    </svg>
  </button>
  ${paginationItems}
  <button class="pagination-button sentinel-button" onclick="updateRankingPage('+1')">
    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="12" viewBox="0 0 8 12">
      <path d="M2.126.35a1.28 1.28 0 00-1.761 0 1.165 1.165 0 000 1.695L4.478 6 .365 9.955a1.165 1.165 0 000 1.694 1.28 1.28 0 001.76 0L8 6 2.126.35z" />
    </svg>
  </button>
</div>`;
};

export const getContestRankingHTML = (
  stylesUri: vscode.Uri,
  scriptsUri: vscode.Uri,
  contestMetadata: Contest,
  problemsGrades: ProblemTotalGrade[],
  oldRankingData: RankListEntry[],
  currentPage: number,
  totalPages: number,
  currentSlidingWindow: number[] = [1, Math.min(10, totalPages)]
) => {
  const rankingData = oldRankingData
    .map((entry, idx) =>
      getRankingTableEntryHTML(
        entry,
        (currentPage - 1) * LambdaChecker.rankingsPageSize + idx + 1,
        contestMetadata.problems,
        contestMetadata.start_date,
        problemsGrades
      )
    )
    .join("");

  const paginationElement = getPaginationElement(
    currentPage,
    totalPages,
    currentSlidingWindow
  );

  return `
<!DOCTYPE html>
<html lang="en">
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ranking ${contestMetadata.name}</title>
    <link rel='stylesheet' type='text/css' href='${stylesUri}'>
  </head>
    <body>
    <h1 class="contest-name">Ranking ${contestMetadata.name}
    <div class="clock-wrapper">
      <div class="countdown-inner">
        <div class="countdown-column">
          <span class="meta">Start date: </span>
          <span class="meta">End date: </span>
        </div>

        <div class="countdown-column">
          <span class="meta">${stringifyDate(contestMetadata.start_date)}</span>
          <span class="meta">${stringifyDate(contestMetadata.end_date)}</span>
        </div>
      </div>
    </div>
    </h1>

    <table class="ranking-table">
        <thead>
            <tr>
                <th>Rank</th>
                <th>Username</th>
                <th>Score</th>
                ${getProblemsHeaderHTML(
                  contestMetadata.problems,
                  problemsGrades
                )}
            </tr>
        </thead>
        <tbody id="ranking-data">
            ${rankingData}
        </tbody>
      </table>

      ${paginationElement}

      <script>
        let currentPage = ${currentPage};
        let currentSlidingWindow = [${currentSlidingWindow[0]}, ${
    currentSlidingWindow[1]
  }];
        let totalPages = ${totalPages};
      </script>
      <script src="${scriptsUri}"></script>
      
    </body>
  </html>
  `;
};
