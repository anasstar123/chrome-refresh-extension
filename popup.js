const timeSelect = document.getElementById("refresh-timer");
const normalBtn = document.getElementById("normal-btn");
const advancedBtn = document.getElementById("advanced-btn");
const stopBtn = document.getElementById("stop-btn");
const countdownDisplay = document.getElementById("countdown-display");
const limitToggle = document.getElementById("limit-toggle");
const maxRefreshSelect = document.getElementById("max-refreshes");

let port = null;
let normalCountdownInterval = null;
let currentTabId = null;

// Enable/disable max refresh selector based on checkbox
limitToggle.addEventListener("change", () => {
  maxRefreshSelect.disabled = !limitToggle.checked;
});

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function updateCountdown(seconds, count = null, max = null) {
  let display = seconds > 0 ? `Refreshing in: ${formatTime(seconds)}` : "";
  
  if (max !== null && max > 1) {
    display += ` | Count: ${count}/${max}`;
  }
  
  countdownDisplay.textContent = display;
}


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

function connectPort(tabId) {
  if (port) {
    port.disconnect();
    port = null;
  }

  port = chrome.runtime.connect({ name: "popup-connection" });
  currentTabId = tabId;

  port.onMessage.addListener((msg) => {
    if (msg.command === "countdown") {
      updateCountdown(msg.remaining, msg.refreshCount, msg.maxRefreshes);
    } else if (msg.command === "status") {
      if (msg.running) {
        startLocalCountdown(msg.remainingSeconds);
        updateCountdown(msg.remainingSeconds, msg.refreshCount, msg.maxRefreshes);
      } else {
        updateCountdown(0);
      }
    }
  });

  port.postMessage({ command: "getStatus", tabId });
}

// Normal Refresh (one-time, persistent)
normalBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  currentTabId = tab.id;
  const interval = parseInt(timeSelect.value);

  clearInterval(normalCountdownInterval);
  updateCountdown(interval);

  connectPort(tab.id);

  port.postMessage({
    command: "startOneTime",
    tabId: tab.id,
    interval,
  });

  
});

// Advanced Refresh (persistent with optional limit)
advancedBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  currentTabId = tab.id;
  const interval = parseInt(timeSelect.value);
  const useLimit = limitToggle.checked;
  const maxRefreshes = useLimit ? parseInt(maxRefreshSelect.value) : null;

  clearInterval(normalCountdownInterval);
  connectPort(tab.id);

  port.postMessage({
    command: "start",
    tabId: tab.id,
    interval,
    maxRefreshes,
  });
});

// Stop any running refresh for current tab
stopBtn.addEventListener("dblclick", () => {
  clearInterval(normalCountdownInterval);
  if (port && currentTabId !== null) {
    port.postMessage({ command: "stop", tabId: currentTabId });
  }
  updateCountdown(0);
});

// Connect on popup load for active tab
window.addEventListener("load", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) connectPort(tab.id);
});

// Disconnect port on unload
window.addEventListener("unload", () => {
  if (port) {
    port.disconnect();
    port = null;
  }
});
