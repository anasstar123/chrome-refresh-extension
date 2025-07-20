const tabRefreshState = {};

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "popup-connection") {
    port.onMessage.addListener((msg) => {
      const tabId = msg.tabId;

      if (msg.command === "start") {
        startAutoRefresh(tabId, msg.interval, port);
      } else if (msg.command === "stop") {
        stopAutoRefresh(tabId);
      } else if (msg.command === "getStatus") {
        const state = tabRefreshState[tabId];
        port.postMessage({
          command: "status",
          running: !!state,
          remainingSeconds: state ? state.remainingSeconds : 0,
        });
      }
    });

    port.onDisconnect.addListener(() => {
      // Cleanup port reference (but not the refresh timer)
      for (const tabId in tabRefreshState) {
        if (tabRefreshState[tabId].port === port) {
          tabRefreshState[tabId].port = null;
        }
      }
    });
  }
});

function startAutoRefresh(tabId, intervalSeconds, port) {
  stopAutoRefresh(tabId);

  const state = {
    remainingSeconds: intervalSeconds,
    intervalValue: intervalSeconds,
    port: port,
  };

  state.countdownId = setInterval(() => {
    state.remainingSeconds--;
    if (state.remainingSeconds < 0) state.remainingSeconds = state.intervalValue;

    if (state.port) {
      state.port.postMessage({
        command: "countdown",
        remaining: state.remainingSeconds,
      });
    }
  }, 1000);

  state.intervalId = setInterval(() => {
    chrome.tabs.reload(Number(tabId));
    state.remainingSeconds = state.intervalValue;
  }, intervalSeconds * 1000);

  tabRefreshState[tabId] = state;
}

function stopAutoRefresh(tabId) {
  const state = tabRefreshState[tabId];
  if (!state) return;

  clearInterval(state.countdownId);
  clearInterval(state.intervalId);

  if (state.port) {
    state.port.postMessage({ command: "countdown", remaining: 0 });
  }

  delete tabRefreshState[tabId];
}
