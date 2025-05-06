let testsDisplayed = ['example', 'test-1', 'test-2', 'test-3'];
let totalNumberOfShownTests = 0;

// Use a mapping as a link to the original name
// for a test, since they have to be reindexed
// after each deletion
let testsNamesMapping = [];

// Initial resize for all the text areas, for example and also
// for the input and output content of the shown tests
testsDisplayed.forEach((element) => {
    const inputTextbox = document.getElementById(`${element}-input`);
    const outputTextbox = document.getElementById(`${element}-output`);

    if (inputTextbox === null || outputTextbox === null) {
        testsDisplayed = testsDisplayed.filter((e) => e !== element);
        return;
    }

    resizeTextArea(inputTextbox);
    resizeTextArea(outputTextbox);

    inputTextbox.addEventListener('input', () => {
        resizeTextArea(inputTextbox);
    });
    
    outputTextbox.addEventListener('input', () => {
        resizeTextArea(outputTextbox);
    });

    testsNamesMapping.push(element);
    totalNumberOfShownTests++;
});

// Reveal the Ranking button
if (contestId === undefined) {
    document.getElementById('restore-skeleton-separator').style.display = 'none';
    document.getElementById('contest-ranking').style.display = 'none';
}

// Countdown timer used when the problem is opened
// in an active contest context
if (contestEndDate !== undefined && contestEndDate.getTime() - Date.now() > 0) {
    document.getElementById('countdown').style.display = 'flex';

    function countdown() {
        const distance = contestEndDate.getTime() - Date.now();

        if (distance < 0) {
            clearInterval(countdown);
            document.getElementById('countdown-text').style.display = 'none';

            const expirationText = document.createElement('div');
            expirationText.classList.add('countdown-column');
            expirationText.style.fontWeight = '400';
            expirationText.innerHTML = '<span>Contest has ended<span>';
            document.getElementById('countdown').appendChild(expirationText);

            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        document.getElementById('countdown-days').innerHTML = days.toString().padStart(2, '0');
        document.getElementById('countdown-hours').innerHTML = hours.toString().padStart(2, '0');
        document.getElementById('countdown-minutes').innerHTML = minutes.toString().padStart(2, '0');
        document.getElementById('countdown-seconds').innerHTML = seconds.toString().padStart(2, '0');

        if (days === 1) {
            document.getElementById('countdown-days-text').innerText = "Day";
        } else if (days === 0) {
            document.getElementById('countdown-days-column').style.display = 'none';
        }

        if (hours === 1) {
            document.getElementById('countdown-hours-text').innerText = "Hour";
        } else if (hours === 0) {
            document.getElementById('countdown-hours-text').innerText = "Hours";
        }

        if (minutes === 1) {
            document.getElementById('countdown-minutes-text').innerText = "Minute";
        } else if (minutes === 0) {
            document.getElementById('countdown-minutes-text').innerText = "Minutes";
        }

        if (seconds === 1) {
            document.getElementById('countdown-seconds-text').innerText = "Second";
        } else if (seconds === 0) {
            document.getElementById('countdown-seconds-text').innerText = "Seconds";
        }

        if (distance < 15 * 1000 * 60) {
            document.getElementById('countdown-text').classList.add('hard');
            document.getElementById('countdown-text').style.fontWeight = '500';
        }

        setTimeout(countdown, 900);
    }

    countdown();
}

function activateTestDisplay(testDiv, testBtn, removeTestBtn) {
    testDiv.classList.remove('hidden');
    testBtn.classList.add('test-btn-active-text');

    if (removeTestBtn !== undefined) {
        removeTestBtn.style.visibility = 'visible';
    } 
}

function deactivateTestDisplay(testDiv, testBtn, removeTestBtn) {
    testDiv.classList.add('hidden');
    testBtn.classList.remove('test-btn-active-text');

    if (removeTestBtn !== undefined) {
        removeTestBtn.style.visibility = 'hidden';
    }
}

function revealTestById(testIdPrefix) {
    const exampleDiv = document.getElementById('example-content');
    const exampleBtn = document.getElementById('example-btn');

    // Hide all the tests and the example
    deactivateTestDisplay(exampleDiv, exampleBtn);

    for (let i = 1; i < testsNamesMapping.length; ++i) {        
        const testDiv = document.getElementById(`${testsNamesMapping[i]}-content`);
        const testBtn = document.getElementById(`${testsNamesMapping[i]}-btn`);
        const removeTestBtn = document.getElementById(`${testsNamesMapping[i]}-btn-remove`);

        if (testDiv !== null) {
            deactivateTestDisplay(testDiv, testBtn, removeTestBtn);
        }
    }

    if (testIdPrefix !== 'example') {
        const testDiv = document.getElementById(`${testIdPrefix}-content`);
        const testBtn = document.getElementById(`${testIdPrefix}-btn`);
        const removeTestBtn = document.getElementById(`${testIdPrefix}-btn-remove`);
        
        activateTestDisplay(testDiv, testBtn, removeTestBtn);

        const inputTextbox = document.getElementById(`${testIdPrefix}-input`);
        const outputTextbox = document.getElementById(`${testIdPrefix}-output`);

        resizeTextArea(inputTextbox);
        resizeTextArea(outputTextbox);
    } else {
        activateTestDisplay(exampleDiv, exampleBtn);
    }
}

function resizeTextArea(textarea) {
    const { style, value } = textarea;

    style.height = style.minHeight = 'auto';
    style.minHeight = `${ Math.min(textarea.scrollHeight + 1, parseInt(textarea.style.maxHeight)) }px`;
}

function getTestData() {
    const testData = [];

    testsNamesMapping.forEach((element) => {
        const inputTextbox = document.getElementById(`${element}-input`);
        const outputTextbox = document.getElementById(`${element}-output`);
    
        if (inputTextbox === null || outputTextbox === null) {
            return;
        }
    
        testData.push({
            input: inputTextbox.value,
            output: outputTextbox.value
        });
    });

    return testData;
}

function addTest() {
    const testIndex = totalNumberOfShownTests;
    totalNumberOfShownTests++;

    testsNamesMapping.push(`test-${testIndex}`);

    createTestButton(testIndex);
    createTestContent(testIndex);

    revealTestById(`test-${testIndex}`);
}

function createTestButton(testIndex) {
    const testButtonsContainer = document.getElementById('test-buttons-container');

    const newTestButton = document.createElement('span');
    newTestButton.id = `test-${testIndex}-btn-wrapper`;
    newTestButton.classList.add('test-btn-wrapper');
    newTestButton.innerHTML = `
<span class="test-btn-wrapper" id="test-${testIndex}-btn-wrapper">
  <span class="separator">|</span>

  <button id="test-${testIndex}-btn" class="test-btn" onclick="revealTestById('test-${testIndex}')">Test ${testsNamesMapping.length - 1}</button>
  <button class="test-btn-remove" id="test-${testIndex}-btn-remove" onclick="removeTestById('test-${testIndex}')">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 8H1V7H15V8Z" fill="#C5C5C5"/>
    </svg>
  </button>
</span>`;

    testButtonsContainer.appendChild(newTestButton);
}

function createTestContent(testIndex, input, output) {
    const inputId = `test-${testIndex}-input`;
    const outputId = `test-${testIndex}-output`;

    const testContent = `
  <h3>Input:</h3>
  <div class="upload-container">
    <textarea class="test-input" style="max-height: 300px; " id="${inputId}" rows=1></textarea>
    <button type="button" class="upload" onclick="uploadTestFile('${inputId}')">
      <svg id="upload-button" width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M11.9564 6H12.0063C12.8003 6 13.5617 6.31607 14.1231 6.87868C14.6845 7.44129 14.9999 8.20435 14.9999 9C14.9999 9.79565 14.6845 10.5587 14.1231 11.1213C13.5617 11.6839 12.8003 12 12.0063 12H10.0106V11H12.0063C12.5356 11 13.0432 10.7893 13.4175 10.4142C13.7918 10.0391 14.002 9.53044 14.002 9C14.002 8.46957 13.7918 7.96086 13.4175 7.58579C13.0432 7.21072 12.5356 7 12.0063 7H11.0923L10.9686 6.143C10.8937 5.60541 10.6455 5.10711 10.2617 4.72407C9.87792 4.34103 9.37968 4.09427 8.84295 4.02143C8.30621 3.94859 7.76044 4.05365 7.28883 4.3206C6.81723 4.58754 6.44567 5.00173 6.23082 5.5L5.89754 6.262L5.08929 6.073C4.90378 6.02699 4.71361 6.0025 4.52251 6C3.8609 6 3.22639 6.2634 2.75856 6.73224C2.29073 7.20108 2.02791 7.83696 2.02791 8.5C2.02791 9.16304 2.29073 9.79893 2.75856 10.2678C3.22639 10.7366 3.8609 11 4.52251 11H7.01712V12H4.52251C4.02742 12.0043 3.53708 11.903 3.08401 11.7029C2.63095 11.5028 2.22551 11.2084 1.8946 10.8394C1.56369 10.4703 1.31487 10.0349 1.16465 9.56211C1.01442 9.08932 0.966218 8.58992 1.02324 8.09704C1.08026 7.60416 1.24121 7.12906 1.49539 6.70326C1.74958 6.27745 2.0912 5.91068 2.4976 5.62727C2.904 5.34385 3.36588 5.15027 3.85261 5.05937C4.33935 4.96847 4.8398 4.98232 5.32079 5.1C5.62405 4.40501 6.14506 3.82799 6.8049 3.45635C7.46474 3.08472 8.22745 2.9387 8.97752 3.04044C9.72759 3.14217 10.4241 3.4861 10.9617 4.02014C11.4992 4.55418 11.8484 5.24923 11.9564 6ZM10.2928 9.85348L8.97879 8.53944L8.97879 13.9749H7.98492L7.98493 8.57568L6.7071 9.85347L5.99999 9.14636L8.14643 6.99998H8.85354L10.9999 9.14637L10.2928 9.85348Z" fill="#C5C5C5"/>
      </svg>
    </button>
  </div>

  <h3>Output:</h3>
  <div class="upload-container">
    <textarea class="test-input" style="max-height: 300px; " id="${outputId}" rows=1></textarea>
    <button type="button" class="upload" onclick="uploadTestFile('${outputId}')">
      <svg id="upload-button" width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M11.9564 6H12.0063C12.8003 6 13.5617 6.31607 14.1231 6.87868C14.6845 7.44129 14.9999 8.20435 14.9999 9C14.9999 9.79565 14.6845 10.5587 14.1231 11.1213C13.5617 11.6839 12.8003 12 12.0063 12H10.0106V11H12.0063C12.5356 11 13.0432 10.7893 13.4175 10.4142C13.7918 10.0391 14.002 9.53044 14.002 9C14.002 8.46957 13.7918 7.96086 13.4175 7.58579C13.0432 7.21072 12.5356 7 12.0063 7H11.0923L10.9686 6.143C10.8937 5.60541 10.6455 5.10711 10.2617 4.72407C9.87792 4.34103 9.37968 4.09427 8.84295 4.02143C8.30621 3.94859 7.76044 4.05365 7.28883 4.3206C6.81723 4.58754 6.44567 5.00173 6.23082 5.5L5.89754 6.262L5.08929 6.073C4.90378 6.02699 4.71361 6.0025 4.52251 6C3.8609 6 3.22639 6.2634 2.75856 6.73224C2.29073 7.20108 2.02791 7.83696 2.02791 8.5C2.02791 9.16304 2.29073 9.79893 2.75856 10.2678C3.22639 10.7366 3.8609 11 4.52251 11H7.01712V12H4.52251C4.02742 12.0043 3.53708 11.903 3.08401 11.7029C2.63095 11.5028 2.22551 11.2084 1.8946 10.8394C1.56369 10.4703 1.31487 10.0349 1.16465 9.56211C1.01442 9.08932 0.966218 8.58992 1.02324 8.09704C1.08026 7.60416 1.24121 7.12906 1.49539 6.70326C1.74958 6.27745 2.0912 5.91068 2.4976 5.62727C2.904 5.34385 3.36588 5.15027 3.85261 5.05937C4.33935 4.96847 4.8398 4.98232 5.32079 5.1C5.62405 4.40501 6.14506 3.82799 6.8049 3.45635C7.46474 3.08472 8.22745 2.9387 8.97752 3.04044C9.72759 3.14217 10.4241 3.4861 10.9617 4.02014C11.4992 4.55418 11.8484 5.24923 11.9564 6ZM10.2928 9.85348L8.97879 8.53944L8.97879 13.9749H7.98492L7.98493 8.57568L6.7071 9.85347L5.99999 9.14636L8.14643 6.99998H8.85354L10.9999 9.14637L10.2928 9.85348Z" fill="#C5C5C5"/>
      </svg>
    </button>
  </div>
  `;

    const testsContainer = document.getElementById('tests-container');

    const newTestContent = document.createElement('div');
    newTestContent.id = `test-${testIndex}-content`;
    newTestContent.classList.add('hidden');
    newTestContent.innerHTML = testContent;

    testsContainer.appendChild(newTestContent);

    const inputTextbox = document.getElementById(`test-${testIndex}-input`);
    const outputTextbox = document.getElementById(`test-${testIndex}-output`);

    inputTextbox.addEventListener('input', () => {
        resizeTextArea(inputTextbox);
    });
    outputTextbox.addEventListener('input', () => {
        resizeTextArea(outputTextbox);
    });
}

function removeTestById(testIdPrefix) {
    const currentIndex = testsNamesMapping.indexOf(testIdPrefix);

    const testButton = document.getElementById(`${testIdPrefix}-btn-wrapper`);
    testButton.remove();
    const testContent = document.getElementById(`${testIdPrefix}-content`);
    testContent.remove();

    // Activate the previous button
    const prevId = currentIndex === 1 ? 'example' : testsNamesMapping[currentIndex - 1];
    
    // Display the previous test
    const newTestContent = document.getElementById(`${prevId}-content`);
    const newTestBtn = document.getElementById(`${prevId}-btn`);
    const newRemoveTestBtn = document.getElementById(`${prevId}-btn-remove`) || undefined;
    activateTestDisplay(newTestContent, newTestBtn, newRemoveTestBtn);

    // Rename the remaining tests
    for (let i = currentIndex + 1; i < testsNamesMapping.length; ++i) {        
        const testBtn = document.getElementById(`${testsNamesMapping[i]}-btn`);

        testBtn.textContent = `Test ${i - 1}`;
        testsNamesMapping[i - 1] = testsNamesMapping[i];
    }

    testsNamesMapping.pop();
}


// Logic to initiate the uploading of a test input/output
function uploadTestFile(textareaId) {
  vscode.postMessage({
    action: "uploadTestFile",
    testId: textareaId
  });
}
  
window.addEventListener('message', event => {
  const message = event.data;

  switch (message.action) {
    case 'uploadTestFileResponse':
        const textarea = document.getElementById(message.testId);
        textarea.value = message.data;
        resizeTextArea(textarea);
        break;
    }
});
