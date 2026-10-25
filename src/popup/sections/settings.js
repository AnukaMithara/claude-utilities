// Settings tab: export everything the extension stores (settings, prompts,
// activity) as one JSON file.
ClaudeUtilities.registerSection({
  id: "settings",
  label: "Settings",
  order: 100,

  render(panel) {
    const { el } = ClaudeUtilities.ui;
    const version = chrome.runtime.getManifest().version;

    const summary = el("span", { textContent: "…" });
    const exportButton = el("button", { type: "button", className: "btn primary", textContent: "Export" });
    const note = el("p", { className: "note" });

    async function collect() {
      const [sync, local] = await Promise.all([chrome.storage.sync.get(null), chrome.storage.local.get(null)]);
      return {
        app: "claude-utilities",
        version,
        exportedAt: new Date().toISOString(),
        settings: sync.settings ?? {},
        prompts: local.prompts ?? [],
        activityLog: local.activityLog ?? [],
      };
    }

    async function refreshSummary() {
      const data = await collect();
      const n = data.prompts.length;
      summary.textContent = `${n} prompt${n === 1 ? "" : "s"}, settings and activity`;
    }

    exportButton.addEventListener("click", async () => {
      const data = await collect();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = el("a", {
        href: URL.createObjectURL(blob),
        download: `claude-utilities-${data.exportedAt.slice(0, 10)}.json`,
      });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      note.textContent = "Exported.";
    });

    refreshSummary();

    panel.append(
      el(
        "section",
        { className: "card" },
        el(
          "div",
          { className: "setting-row" },
          el("div", { className: "text" }, el("b", { textContent: "Export data" }), summary),
          exportButton
        ),
        note
      ),
      el("p", { className: "note", textContent: `Claude Utilities ${version}` })
    );
  },
});
