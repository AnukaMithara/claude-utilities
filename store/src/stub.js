// Minimal chrome.* stub with sample data so the real popup code can be rendered
// outside the extension for store screenshots. Query params:
//   ?tab=<popup tab id>   which tab to show (auto-accept-permissions | prompts | settings)
//   ?theme=light|dark     force a theme
(() => {
  const params = new URLSearchParams(location.search);
  const now = Date.now();
  const min = 60 * 1000;

  const store = {
    sync: { settings: { "auto-accept-permissions": { delay: 3, allow: "", block: "delete, apply_migration" } } },
    local: {
      prompts: [
        {
          id: "1",
          title: "Code review",
          text: "Review this diff for correctness bugs, edge cases and missing tests. Keep the findings short and ranked by severity.",
          updated: now,
        },
        { id: "2", title: "Explain this module", text: "Explain how this module works, step by step, with the key data flow.", updated: now },
        { id: "3", title: "Write tests", text: "Write focused unit tests for the function above. Cover the happy path and the failure cases.", updated: now },
      ],
      activityLog: [
        { time: now - 42 * min, utility: "auto-accept-permissions", message: "Allowed Read file" },
        { time: now - 31 * min, utility: "auto-accept-permissions", message: "Allowed Execute SQL (Supabase)" },
        { time: now - 18 * min, utility: "auto-accept-permissions", message: "Allowed Bash" },
        { time: now - 6 * min, utility: "auto-accept-permissions", message: "Allowed Edit file" },
      ],
    },
    session: { tabs: { 7: { "auto-accept-permissions": true } } },
  };

  const area = (name) => ({
    get: async (key) => (key == null ? store[name] : typeof key === "string" ? { [key]: store[name][key] } : {}),
    set: async (obj) => Object.assign(store[name], obj),
  });
  const noop = { addListener() {}, removeListener() {} };

  window.chrome = {
    storage: { sync: area("sync"), local: area("local"), session: area("session"), onChanged: noop },
    tabs: { query: async () => [{ id: 7, url: "https://claude.ai/new" }], sendMessage: async () => ({ ok: true }), create() {} },
    runtime: { getManifest: () => ({ version: "1.0.0" }), onMessage: noop },
  };

  try {
    localStorage.setItem("claudeUtilities.popupTab", params.get("tab") || "auto-accept-permissions");
  } catch {}
  if (params.get("theme")) document.documentElement.dataset.theme = params.get("theme");
})();
