let refreshIntervalId = null;
let countdownIntervalId = null;
let remainingSeconds = 0;
let popupPort = null;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "popup-connection") {
    popupPort = port;

    port.onDisconnect.addListener(() => {
      popupPort = null;
    });

    port.onMessage.addListener((msg) => {
      if (msg.command === "start") {
        startAutoRefresh(msg.tabId, msg.interval);
      } else if (msg.command === "stop") {
        stopAutoRefresh();
      } else if (msg.command === "getStatus") {
        port.postMessage({
          command: "status",
          running: refreshIntervalId !== null,
          remainingSeconds,
        });
      }
    });
  }
});

function startAutoRefresh(tabId, intervalSeconds) {
  stopAutoRefresh();
  remainingSeconds = intervalSeconds;

  countdownIntervalId = setInterval(() => {
    remainingSeconds--;
    if (remainingSeconds < 0) remainingSeconds = intervalSeconds;
    if (popupPort) {
      popupPort.postMessage({ command: "countdown", remaining: remainingSeconds });
    }
  }, 1000);

  refreshIntervalId = setInterval(() => {
    chrome.tabs.reload(tabId);
    remainingSeconds = intervalSeconds;
  }, intervalSeconds * 1000);
}

function stopAutoRefresh() {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
  if (countdownIntervalId) {
    clearInterval(countdownIntervalId);
    countdownIntervalId = null;
  }
  remainingSeconds = 0;
  if (popupPort) {
    popupPort.postMessage({ command: "countdown", remaining: 0 });
  }
}
