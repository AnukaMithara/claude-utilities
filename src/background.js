// Toolbar badge, per-tab bookkeeping and the activity log (entries are deleted after a day).
const TABS = "tabs";
const LOG = "activityLog";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500;

const loadTabs = async () => (await chrome.storage.session.get(TABS))[TABS] ?? {};

// A tab with a utility switched on shows a green ON badge; other tabs show nothing.
async function renderBadge(previousTabs = {}) {
  const tabs = await loadTabs();
  const ids = new Set([...Object.keys(previousTabs), ...Object.keys(tabs)]);
  for (const id of ids) {
    const active = Object.keys(tabs[id] ?? {}).length > 0;
    try {
      await chrome.action.setBadgeText({ tabId: Number(id), text: active ? "ON" : "" });
      await chrome.action.setBadgeBackgroundColor({ tabId: Number(id), color: "#2e9e5b" });
    } catch {} // the tab may already be closed
  }
}

// Writes are chained so two entries arriving together can't overwrite each other.
let queue = Promise.resolve();
const withLog = (change) =>
  (queue = queue.then(async () => {
    const cutoff = Date.now() - MAX_AGE_MS;
    const stored = (await chrome.storage.local.get(LOG))[LOG] ?? [];
    const entries = change(stored.filter((e) => e.time >= cutoff)).slice(-MAX_ENTRIES);
    await chrome.storage.local.set({ [LOG]: entries });
  }));

function setup() {
  renderBadge();
  chrome.alarms.create("prune-log", { periodInMinutes: 60 });
  withLog((entries) => entries);
}

chrome.runtime.onInstalled.addListener(setup);
chrome.runtime.onStartup.addListener(setup);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "prune-log") withLog((entries) => entries);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes[TABS]) {
    const before = changes[TABS].oldValue ?? {};
    renderBadge(before);
    // Tell each affected tab to re-read its switches.
    const after = changes[TABS].newValue ?? {};
    for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
      chrome.tabs.sendMessage(Number(id), { type: "tab-state-changed" }).catch(() => {});
    }
  }
});

// A closed tab loses its switches.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const tabs = await loadTabs();
  if (tabs[tabId]) {
    delete tabs[tabId];
    await chrome.storage.session.set({ [TABS]: tabs });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg?.type === "tab-state") {
    const tabId = sender.tab?.id;
    loadTabs().then((tabs) => respond({ state: tabs[tabId] ?? {} }));
    return true; // respond asynchronously
  } else if (msg?.type === "log") {
    withLog((entries) => [
      ...entries,
      { time: Date.now(), utility: msg.utility, message: msg.message },
    ]);
  }
});
