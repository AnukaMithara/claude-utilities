// Starts, updates and stops each registered utility as its settings change.
(() => {
  const { all, storage } = ClaudeUtilities;
  const running = new Map();

  function stopAll() {
    for (const instance of running.values()) instance.stop?.();
    running.clear();
  }

  // After the extension is reloaded or removed, this copy of the script is orphaned
  // but would keep running until the page is refreshed. Utilities call this before
  // acting; it shuts everything down once the extension is gone.
  ClaudeUtilities.alive = () => {
    if (chrome.runtime?.id) return true;
    stopAll();
    return false;
  };

  async function sync() {
    if (!ClaudeUtilities.alive()) return;
    const [settings, thisTab] = await Promise.all([storage.load(), storage.thisTab()]);

    for (const def of all()) {
      const cfg = storage.resolve(def, settings);
      const active = def.scope === "tab" ? !!thisTab[def.id] : !!cfg.enabled;
      const instance = running.get(def.id);

      if (active && !instance) {
        running.set(def.id, def.start(cfg) ?? {});
      } else if (active) {
        instance.update?.(cfg);
      } else if (instance) {
        instance.stop?.();
        running.delete(def.id);
      }
    }
  }

  // The popup pings to learn whether the extension is running in a tab.
  chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
    if (msg?.type === "ping") respond({ ok: true });
  });

  storage.onChange(sync);
  sync();
})();
