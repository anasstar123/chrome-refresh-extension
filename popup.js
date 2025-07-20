const timeSelect = document.getElementById("refresh-timer");
const normalBtn = document.getElementById("normal-btn");
const advancedBtn = document.getElementById("advanced-btn");
const stopBtn = document.getElementById("stop-btn");
const countdownDisplay = document.getElementById("countdown-display");

let port = null;
let normalCountdownInterval = null;
let currentTabId = null;

function startLocalCountdown(seconds) {
  clearInterval(normalCountdownInterval);
  let remaining = seconds;
  updateCountdown(remaining);

  normalCountdownInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(normalCountdownInterval);
      updateCountdown(0);
    } else {
      updateCountdown(remaining);
    }
  }, 1000);
}


function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function updateCountdown(seconds) {
  countdownDisplay.textContent = seconds > 0 ? `Refreshing in: ${formatTime(seconds)}` : "";
}

function connectPort(tabId) {
  port = chrome.runtime.connect({ name: "popup-connection" });
  currentTabId = tabId;

  port.onMessage.addListener((msg) => {
  if (msg.command === "countdown") {
    updateCountdown(msg.remaining);
  } else if (msg.command === "status") {
    if (msg.running) {
      // start local countdown UI based on background time
      startLocalCountdown(msg.remainingSeconds);
    } else {
      updateCountdown(0);
    }
  }
});


  port.postMessage({ command: "getStatus", tabId });
}

normalBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  currentTabId = tab.id;
  let remaining = parseInt(timeSelect.value);
  clearInterval(normalCountdownInterval);
  updateCountdown(remaining);

  normalCountdownInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(normalCountdownInterval);
      updateCountdown(0);
    } else {
      updateCountdown(remaining);
    }
  }, 1000);

  setTimeout(() => {
    chrome.tabs.reload(tab.id);
    clearInterval(normalCountdownInterval);
    updateCountdown(0);
  }, remaining * 1000);
});

advancedBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const interval = parseInt(timeSelect.value);
  clearInterval(normalCountdownInterval);
  connectPort(tab.id);

  port.postMessage({ command: "start", tabId: tab.id, interval });
});

stopBtn.addEventListener("click", () => {
  clearInterval(normalCountdownInterval);
  if (port && currentTabId !== null) {
    port.postMessage({ command: "stop", tabId: currentTabId });
  }
  updateCountdown(0);
});

window.addEventListener("load", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) connectPort(tab.id);
});

window.addEventListener("unload", () => {
  if (port) {
    port.disconnect();
    port = null;
  }
});
