/* ---------- Raccourcis DOM ---------- */
const timeSelect = document.getElementById("refresh-timer");
const normalBtn = document.getElementById("normal-btn");
const advancedBtn = document.getElementById("advanced-btn");
const stopBtn = document.getElementById("stop-btn");
const countdownDisplay = document.getElementById("countdown-display");
const limitToggle = document.getElementById("limit-toggle");
const maxRefreshSelect = document.getElementById("max-refreshes");

let port = null;
let localCountdownId = null;
let currentTabId = null;

/* ---------- UI helpers ---------- */
limitToggle.addEventListener("change", () => {
  maxRefreshSelect.disabled = !limitToggle.checked;
});

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function showCountdown(sec, count = null, max = null) {
  let text = sec > 0 ? `Refreshing in : ${formatTime(sec)}` : "";
  if (max !== null && max > 1) text += ` | Count : ${count}/${max}`;
  countdownDisplay.textContent = text;
}

function startLocalCountdown(sec, count, max) {
  clearInterval(localCountdownId);
  let remaining = sec;
  showCountdown(remaining, count, max);

  localCountdownId = setInterval(() => {
    remaining--;
    if (remaining <= 0) clearInterval(localCountdownId);
    showCountdown(Math.max(0, remaining), count, max);
  }, 1000);
}

/* ---------- Port Logic ---------- */
function connect(tabId) {
  if (port) port.disconnect();
  port = chrome.runtime.connect({ name: "popup-connection" });
  currentTabId = tabId;

  port.onMessage.addListener((msg) => {
    if (msg.command === "countdown") {
      showCountdown(msg.remaining, msg.refreshCount, msg.maxRefreshes);
    } else if (msg.command === "status" && msg.running) {
      startLocalCountdown(msg.remainingSeconds, msg.refreshCount, msg.maxRefreshes);
    }
  });

  port.postMessage({ command: "getStatus", tabId });
}

/* ---------- Boutons ---------- */
// 1) Une seule fois
normalBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  connect(tab.id);
  port.postMessage({
    command: "startOneTime",
    tabId: tab.id,
    interval: parseInt(timeSelect.value)
  });
});

// 2) Périodique (option autostop)
advancedBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  connect(tab.id);
  port.postMessage({
    command: "start",
    tabId: tab.id,
    interval: parseInt(timeSelect.value),
    maxRefreshes: limitToggle.checked ? parseInt(maxRefreshSelect.value) : null
  });
});

// 3) Stop
stopBtn.addEventListener("dblclick", () => {
  if (port && currentTabId !== null) {
    port.postMessage({ command: "stop", tabId: currentTabId });
    showCountdown(0);
  }
  clearInterval(localCountdownId);
});

/* ---------- Initialisation ---------- */
window.addEventListener("load", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) connect(tab.id);
});

window.addEventListener("unload", () => {
  port?.disconnect();
});
