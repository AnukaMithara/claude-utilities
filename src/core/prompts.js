// Saved prompts in chrome.storage.local: [{ id, title, text, updated }], newest first.
// Local (not sync) storage because prompts can be long.
(() => {
  const KEY = "prompts";
  const load = async () => (await chrome.storage.local.get(KEY))[KEY] ?? [];
  const save = (list) => chrome.storage.local.set({ [KEY]: list });

  ClaudeUtilities.prompts = {
    load,
    save,

    async add(title, text) {
      const list = await load();
      const prompt = { id: crypto.randomUUID(), title, text, updated: Date.now() };
      await save([prompt, ...list]);
      return prompt;
    },

    async update(id, patch) {
      const list = await load();
      const i = list.findIndex((p) => p.id === id);
      if (i < 0) return;
      list[i] = { ...list[i], ...patch, updated: Date.now() };
      await save(list);
    },

    async remove(id) {
      await save((await load()).filter((p) => p.id !== id));
    },

    // Returns an unsubscribe function.
    onChange(callback) {
      const listener = (changes, area) => {
        if (area === "local" && changes[KEY]) callback(changes[KEY].newValue ?? []);
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    },
  };
})();
