/* ---------- Helpers ---------- */

const STORAGE_PREFIX = "refresh-";
const ALARM_PREFIX = "refresh-";

const stateInMemory = new Map(); // tabId -> { port }

function storageKey(tabId) { return `${STORAGE_PREFIX}${tabId}`; }
function alarmName(tabId) { return `${ALARM_PREFIX}${tabId}`; }

/* ---------- Port / Popup ---------- */
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "popup-connection") return;

  port.onMessage.addListener(async (msg) => {
    const tabId = msg.tabId;

    switch (msg.command) {
      case "start": // périodique (autostop facultatif)
        await startRefresh(tabId, msg.interval, msg.maxRefreshes, port);
        break;

      case "startOneTime": // une seule fois
        await startRefresh(tabId, msg.interval, 1, port);
        break;

      case "stop":
        await stopRefresh(tabId);
        break;

      case "getStatus":

        const status = await getStatus(tabId);
        port.postMessage({ command: "status", ...status });
        if (status.running) {
          startLocalCountdownToPopup(
            port,
            status.remainingSeconds,
            status.refreshCount,
            status.maxRefreshes
          );
        }
        break;
    }
  });

  port.onDisconnect.addListener(() => {
    // On ne garde pas les ports morts
    for (const [tabId, info] of stateInMemory) {
      if (info.port === port) stateInMemory.set(tabId, { port: null });
    }
  });
});

/* ---------- Lancer / Arrêter ---------- */
async function startRefresh(tabId, intervalSec, maxRefreshes, port) {
  await stopRefresh(tabId); // nettoie si déjà présent

  // état persistant
  const data = {
    intervalSec,
    refreshCount: 0,
    maxRefreshes: maxRefreshes ?? null,
    // moment du prochain déclenchement → utile pour le compte à rebours
    nextTrigger: Date.now() + intervalSec * 1000
  };
  await chrome.storage.local.set({ [storageKey(tabId)]: data });

  // alarme périodique (survit à l’endormissement du SW)
  chrome.alarms.create(alarmName(tabId), {
    delayInMinutes: intervalSec / 60,
    periodInMinutes: intervalSec / 60
  });

  // port en mémoire pour dialogues temps réel avec le popup
  stateInMemory.set(tabId, { port });
}

async function stopRefresh(tabId) {
  chrome.alarms.clear(alarmName(tabId));
  await chrome.storage.local.remove(storageKey(tabId));
  stateInMemory.delete(tabId);

  // avertit éventuellement le popup encore ouvert
  try {
    const port = stateInMemory.get(tabId)?.port;
    port?.postMessage({ command: "countdown", remaining: 0, refreshCount: 0 });
  } catch (_) {/* rien */}
}

/* ---------- Sur déclenchement d’alarme ---------- */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;
  const tabId = Number(alarm.name.slice(ALARM_PREFIX.length));

  // lit l’état persistant
  const key = storageKey(tabId);
  const data = (await chrome.storage.local.get(key))[key];
  if (!data) return; // rien à gérer

  // recharge l’onglet
  try { await chrome.tabs.reload(tabId); } catch (_) {/* onglet fermé */}
  data.refreshCount += 1;

  // calcule la prochaine échéance
  data.nextTrigger = Date.now() + data.intervalSec * 1000;

  // envoie la mise à jour au popup actif (si présent)
  const port = stateInMemory.get(tabId)?.port;
  port?.postMessage({
    command: "countdown",
    remaining: data.intervalSec,
    refreshCount: data.refreshCount,
    maxRefreshes: data.maxRefreshes
  });

  // condition d’arrêt
  if (data.maxRefreshes !== null && data.refreshCount >= data.maxRefreshes) {
    await stopRefresh(tabId);
  } else {
    // sauvegarde l’incrément
    await chrome.storage.local.set({ [key]: data });
  }
});

/* ---------- API de statut ---------- */
async function getStatus(tabId) {
  const key = storageKey(tabId);
  const data = (await chrome.storage.local.get(key))[key];

  if (!data) {
    return { running: false, remainingSeconds: 0, refreshCount: 0, maxRefreshes: null };
  }

  const remaining = Math.max(0, Math.ceil((data.nextTrigger - Date.now()) / 1000));
  return {
    running: true,
    remainingSeconds: remaining,
    refreshCount: data.refreshCount,
    maxRefreshes: data.maxRefreshes
  };
}

/* ---------- Compte à rebours local (optionnel) ---------- */
function startLocalCountdownToPopup(port, seconds, count, max) {
  let remaining = seconds;
  port.postMessage({ command: "countdown", remaining, refreshCount: count, maxRefreshes: max });

  const id = setInterval(() => {
    remaining--;

    port.postMessage({ command: "countdown", remaining, refreshCount: count, maxRefreshes: max });
    if (remaining <= 0) clearInterval(id);
  }, 1000);

  // stoppe le timer si le popup se ferme
  port.onDisconnect.addListener(() => clearInterval(id));
}

/* ---------- Nettoyage quand l’onglet est fermé ---------- */
chrome.tabs.onRemoved.addListener((tabId) => stopRefresh(tabId));
