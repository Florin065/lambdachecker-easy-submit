const vscode = acquireVsCodeApi();

function showProblem(problemId) {
  vscode.postMessage({
    action: 'show-problem',
    problemId: problemId,
  });
}

function updateUI(targetPage) {
  if (targetPage === currentSlidingWindow[0] && targetPage !== 1) {
    document.getElementById(`page-${currentSlidingWindow[0] - 1}-btn`).style.display = "flex";
    document.getElementById(`page-${currentSlidingWindow[1]}-btn`).style.display = "none";
    currentSlidingWindow[0]--;
    currentSlidingWindow[1]--;

    if (currentSlidingWindow[1] - currentSlidingWindow[0] > 9) {
      document.getElementById(`page-${totalPages - 2}-btn`).style.display = "none";
      document.getElementById(`page-${totalPages - 1}-btn`).style.display = "none";
      document.getElementById(`page-${totalPages}-btn`).style.display = "none";
      document.getElementById('points').style.display = "flex";
      document.getElementById('dummy-btn').style.display = "flex";

      currentSlidingWindow[1] = currentSlidingWindow[0] + 9;
    }
  } else if (targetPage === currentSlidingWindow[1] && targetPage !== totalPages) {
    document.getElementById(`page-${currentSlidingWindow[1] + 1}-btn`).style.display = "flex";
    document.getElementById(`page-${currentSlidingWindow[0]}-btn`).style.display = "none";
    currentSlidingWindow[0]++;
    currentSlidingWindow[1]++;
  }

  if (totalPages - targetPage <= 3) {
    document.getElementById(`page-${totalPages - 1}-btn`).style.display = "flex";
    document.getElementById(`page-${totalPages}-btn`).style.display = "flex";
    document.getElementById('points').style.display = "none";
    document.getElementById('dummy-btn').style.display = "none";

    currentSlidingWindow[1] = totalPages;
  }

  document.getElementById(`page-${currentPage}-btn`).classList.remove("pagination-button-active");
  currentPage = targetPage;
  document.getElementById(`page-${currentPage}-btn`).classList.add("pagination-button-active");
}

function updateRankingPage(targetPage) {
  // Do the visual update, and then send the state to the extension
  if (targetPage === "-1") {
    targetPage = Math.max(currentPage - 1, 1);
  } else if (targetPage === "+1") {
    targetPage = Math.min(currentPage + 1, totalPages);
  }

  updateUI(targetPage);

  // Always send the change page request to the
  // extension, which will further decide what to do
  vscode.postMessage({
    action: 'get-ranking-page',
    page: currentPage,
    slidingWindow: currentSlidingWindow
  });
}
