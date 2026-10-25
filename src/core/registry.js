// Central registry. Utility files call ClaudeUtilities.register({...}); popup-only
// tabs call ClaudeUtilities.registerSection({...}).
//
// A utility definition (runs on claude.ai pages):
//   id          unique kebab-case id (also the storage key)
//   name        label shown in the popup card
//   tabLabel    popup tab title (defaults to name)
//   order       popup tab order (lower first, default 0)
//   description one-line help text shown in the popup
//   scope       "tab"    switched on per browser tab, off in every tab by default
//               "global" (default) switched on for all tabs via defaults.enabled
//   defaults    default settings; global utilities must include `enabled`
//   options     optional popup fields: [{ key, label, type: "text"|"number"|"checkbox", placeholder?, help?, min?, max? }]
//   start(cfg)  runs on claude.ai when active; returns { stop(), update?(cfg) }
//
// A popup section (a popup tab with its own UI, no page script):
//   id, label, order
//   render(container, ctx)   ctx = { tab: { id, isClaude, running } }
(() => {
  const utilities = new Map();
  const sections = new Map();

  globalThis.ClaudeUtilities = {
    register(def) {
      const needsEnabled = def.scope !== "tab";
      if (!def.id || !def.defaults || (needsEnabled && !("enabled" in def.defaults))) {
        throw new Error(`Invalid utility definition: ${def.id}`);
      }
      utilities.set(def.id, def);
    },
    all: () => [...utilities.values()],

    registerSection(section) {
      sections.set(section.id, section);
    },
    sections: () => [...sections.values()],
  };
})();
