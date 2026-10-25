// Settings live under one key: { [utilityId]: { enabled, ...options } } (sync storage).
// Per-tab switches live in session storage: { [tabId]: { [utilityId]: true } }, which is
// wiped when the browser closes, so every tab starts with tab-scoped utilities off.
// Content scripts can't read session storage, so they ask the background worker.
(() => {
  const KEY = "settings";
  const TABS = "tabs";

  const load = async () => (await chrome.storage.sync.get(KEY))[KEY] ?? {};
  const loadTabs = async () => (await chrome.storage.session.get(TABS))[TABS] ?? {};

  ClaudeUtilities.storage = {
    load,
    loadTabs,

    // Stored values layered over the utility's defaults.
    resolve: (def, all) => ({ ...def.defaults, ...all[def.id] }),

    async update(id, patch) {
      const all = await load();
      all[id] = { ...all[id], ...patch };
      await chrome.storage.sync.set({ [KEY]: all });
    },

    // Content scripts: this tab's switches, e.g. { "auto-accept-permissions": true }.
    thisTab: () =>
      chrome.runtime
        .sendMessage({ type: "tab-state" })
        .then((r) => r?.state ?? {})
        .catch(() => ({})),

    async setTab(tabId, utilityId, on) {
      const tabs = await loadTabs();
      const state = { ...tabs[tabId] };
      if (on) state[utilityId] = true;
      else delete state[utilityId];
      if (Object.keys(state).length) tabs[tabId] = state;
      else delete tabs[tabId];
      await chrome.storage.session.set({ [TABS]: tabs });
    },

    // Fires on settings changes, and (in content scripts) when the background
    // worker reports that this tab's switches changed.
    onChange(callback) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "sync" && changes[KEY]) callback();
      });
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg?.type === "tab-state-changed") callback();
      });
    },
  };
})();
