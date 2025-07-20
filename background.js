const tabRefreshState = {};

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "popup-connection") {
    port.onMessage.addListener((msg) => {
      const tabId = msg.tabId;

      if (msg.command === "start") {
        startAutoRefresh(tabId, msg.interval, msg.maxRefreshes || null, port);
      } else if (msg.command === "startOneTime") {
        startOneTimeRefresh(tabId, msg.interval, port);
      } else if (msg.command === "stop") {
        stopAutoRefresh(tabId);
      } else if (msg.command === "getStatus") {
        const state = tabRefreshState[tabId];
        port.postMessage({
          command: "status",
          running: !!state,
          remainingSeconds: state ? state.remainingSeconds : 0,
          refreshCount: state ? state.refreshCount : 0,
          maxRefreshes: state ? state.maxRefreshes : null,
        });
      }
    });

    port.onDisconnect.addListener(() => {
      for (const tabId in tabRefreshState) {
        if (tabRefreshState[tabId].port === port) {
          tabRefreshState[tabId].port = null;
        }
      }
    });
  }
});

function startAutoRefresh(tabId, intervalSeconds, maxRefreshes, port) {
  stopAutoRefresh(tabId);

  const state = {
    remainingSeconds: intervalSeconds,
    intervalValue: intervalSeconds,
    port,
    refreshCount: 0,
    maxRefreshes,
  };

  state.countdownId = setInterval(() => {
    state.remainingSeconds--;
    if (state.remainingSeconds < 0) state.remainingSeconds = state.intervalValue;

    if (state.port) {
      state.port.postMessage({
        command: "countdown",
        remaining: state.remainingSeconds,
        refreshCount: state.refreshCount,
        maxRefreshes: state.maxRefreshes,
      });
    }
  }, 1000);

  state.intervalId = setInterval(() => {
    chrome.tabs.reload(Number(tabId));
    state.remainingSeconds = state.intervalValue;
    state.refreshCount++;

    if (state.maxRefreshes !== null && state.refreshCount >= state.maxRefreshes) {
      stopAutoRefresh(tabId);
    }
  }, intervalSeconds * 1000);

  tabRefreshState[tabId] = state;
}

function startOneTimeRefresh(tabId, intervalSeconds, port) {
  stopAutoRefresh(tabId);

  const state = {
    remainingSeconds: intervalSeconds,
    intervalValue: intervalSeconds,
    port,
    refreshCount: 0,
    maxRefreshes: 1,
    oneTime: true,
  };

  state.countdownId = setInterval(() => {
    state.remainingSeconds--;
    if (state.remainingSeconds <= 0) {
      clearInterval(state.countdownId);
      chrome.tabs.reload(Number(tabId));
      stopAutoRefresh(tabId);
    }

    if (state.port) {
      state.port.postMessage({
        command: "countdown",
        remaining: state.remainingSeconds,
        refreshCount: state.refreshCount,
        maxRefreshes: state.maxRefreshes,
      });
    }
  }, 1000);

  tabRefreshState[tabId] = state;
}

function stopAutoRefresh(tabId) {
  const state = tabRefreshState[tabId];
  if (!state) return;

  clearInterval(state.countdownId);
  clearInterval(state.intervalId);

  if (state.port) {
    state.port.postMessage({ command: "countdown", remaining: 0, refreshCount: 0 });
  }

  delete tabRefreshState[tabId];
}

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabRefreshState[tabId]) {
    stopAutoRefresh(tabId);
  }
});
