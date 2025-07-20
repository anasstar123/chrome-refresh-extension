const timeSelect = document.getElementById("refresh-timer");
const normalBtn = document.getElementById("normal-btn");
const advancedBtn = document.getElementById("advanced-btn");
const stopBtn = document.getElementById("stop-btn");
const countdownDisplay = document.getElementById("countdown-display");

let port = null;
let normalCountdownInterval = null;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function updateCountdown(seconds) {
  if (seconds > 0) {
    countdownDisplay.textContent = `Refreshing in: ${formatTime(seconds)}`;
  } else {
    countdownDisplay.textContent = "";
  }
}

function connectPort() {
  port = chrome.runtime.connect({ name: "popup-connection" });

  port.onMessage.addListener((msg) => {
    if (msg.command === "countdown") {
      updateCountdown(msg.remaining);
    } else if (msg.command === "status") {
      if (msg.running) {
        updateCountdown(msg.remainingSeconds);
      } else {
        updateCountdown(0);
      }
    }
  });

  port.postMessage({ command: "getStatus" });
}

normalBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return alert("No active tab found!");

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
  if (!tab) return alert("No active tab found!");

  const interval = parseInt(timeSelect.value);
  clearInterval(normalCountdownInterval);
  updateCountdown(interval);

  port.postMessage({ command: "start", tabId: tab.id, interval });
});

stopBtn.addEventListener("click", () => {
  clearInterval(normalCountdownInterval);
  if (port) port.postMessage({ command: "stop" });
  updateCountdown(0);
});

window.addEventListener("load", () => {
  connectPort();
});

window.addEventListener("unload", () => {
  if (port) {
    port.disconnect();
    port = null;
  }
});
