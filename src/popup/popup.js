// Builds the tabbed popup: one tab per registered utility (settings card plus its
// activity) and one per registered section (custom UI, e.g. Prompts, Settings).
const { all, sections, storage } = ClaudeUtilities;
const LOG = "activityLog";
const DAY_MS = 24 * 60 * 60 * 1000;
const LAST_TAB = "claudeUtilities.popupTab";

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

// Claude-style toggle switch. Returns { root, input }.
function toggleSwitch(checked, label) {
  const input = el("input", { type: "checkbox", checked, role: "switch" });
  input.setAttribute("aria-label", label);
  const root = el("label", { className: "switch" }, input, el("span", { className: "track" }));
  return { root, input };
}
ClaudeUtilities.ui = { el, toggleSwitch };

function optionField(def, option, cfg) {
  const input = el("input", { type: option.type ?? "text" });
  if (input.type === "checkbox") input.checked = !!cfg[option.key];
  else {
    input.value = cfg[option.key] ?? "";
    input.placeholder = option.placeholder ?? "";
  }
  if (input.type === "number") {
    if (option.min != null) input.min = option.min;
    if (option.max != null) input.max = option.max;
    input.step = option.step ?? 1;
  }
  if (option.help) input.title = option.help;
  input.addEventListener("input", () => {
    let value = input.value;
    if (input.type === "checkbox") value = input.checked;
    else if (input.type === "number") {
      if (input.value === "" || Number.isNaN(input.valueAsNumber)) return;
      value = Math.min(option.max ?? Infinity, Math.max(option.min ?? -Infinity, input.valueAsNumber));
    }
    storage.update(def.id, { [option.key]: value });
  });

  const control = option.suffix
    ? el("span", { className: "with-suffix" }, input, el("small", { textContent: option.suffix }))
    : input;
  return el("label", { className: "field" }, el("span", { textContent: option.label }), control);
}

// `tab` describes the active browser tab: { id, isClaude, running, enabled }.
function utilityCard(def, cfg, tab) {
  const perTab = def.scope === "tab";
  const on = perTab ? !!tab.enabled[def.id] : cfg.enabled;

  const { root: switchRoot, input: toggle } = toggleSwitch(on, def.name);
  toggle.disabled = perTab && !tab.isClaude;
  toggle.addEventListener("change", () => {
    if (perTab) storage.setTab(tab.id, def.id, toggle.checked);
    else storage.update(def.id, { enabled: toggle.checked });
  });

  const head = el(
    "div",
    { className: "card-head" },
    el("span", { className: "title", textContent: def.name }),
    perTab ? el("span", { className: "chip", textContent: "This tab" }) : "",
    el("span", { className: "spacer" }),
    switchRoot
  );

  const status = el("p", { className: "note warn" });
  if (perTab && !tab.isClaude) status.textContent = "Open from a claude.ai tab.";
  else if (perTab && !tab.running) status.textContent = "Refresh this tab once to start.";

  const fields = el("div", { className: "fields" });
  for (const option of def.options ?? []) fields.append(optionField(def, option, cfg));

  const card = el("section", { className: "card" }, head);
  if (def.description) card.append(el("p", { className: "note", textContent: def.description }));
  card.append(status, fields);
  return card;
}

// Activity entries for one utility from the last 24 h, newest first.
function activityBlock(utilityId) {
  const list = el("ul", { className: "log" });
  const empty = el("p", { className: "log-empty", textContent: "No activity yet." });
  const count = el("span", { className: "chip", textContent: "0" });
  const clear = el("button", { type: "button", className: "btn ghost small", textContent: "Clear" });

  async function render() {
    const stored = (await chrome.storage.local.get(LOG))[LOG] ?? [];
    const entries = stored
      .filter((e) => e.utility === utilityId && e.time >= Date.now() - DAY_MS)
      .reverse();
    count.textContent = entries.filter((e) => e.message.startsWith("Allowed")).length;
    list.replaceChildren(
      ...entries.map((e) =>
        el(
          "li",
          {},
          el("time", {
            textContent: new Date(e.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          }),
          el("span", { textContent: e.message.replace(/^Allowed (use )?/, "") })
        )
      )
    );
    empty.hidden = entries.length > 0;
    clear.hidden = entries.length === 0;
  }

  clear.addEventListener("click", async () => {
    const stored = (await chrome.storage.local.get(LOG))[LOG] ?? [];
    await chrome.storage.local.set({ [LOG]: stored.filter((e) => e.utility !== utilityId) });
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[LOG]) render();
  });
  render();

  return el(
    "section",
    { className: "card" },
    el(
      "div",
      { className: "activity-head" },
      el("p", { className: "section-label", textContent: "Allowed · last 24 h" }),
      count,
      clear
    ),
    list,
    empty
  );
}

function showTab(id) {
  for (const button of document.querySelectorAll("#tabs button")) {
    button.setAttribute("aria-selected", String(button.dataset.id === id));
  }
  for (const panel of document.querySelectorAll(".panel")) panel.hidden = panel.dataset.id !== id;
  try {
    localStorage.setItem(LAST_TAB, id);
  } catch {}
}

(async () => {
  const settings = await storage.load();

  // Per-tab switches and prompt insertion act on the tab the popup was opened
  // from. The URL is visible thanks to the claude.ai host permission.
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isClaude = /^https:\/\/claude\.ai\//.test(active?.url ?? "");
  let running = false;
  if (isClaude) {
    try {
      await chrome.tabs.sendMessage(active.id, { type: "ping" });
      running = true;
    } catch {}
  }
  const tabs = await storage.loadTabs();
  const tab = { id: active?.id, isClaude, running, enabled: tabs[active?.id] ?? {} };

  const entries = [
    ...all().map((def) => ({
      id: def.id,
      label: def.tabLabel ?? def.name,
      order: def.order ?? 0,
      render: (panel) => {
        panel.append(utilityCard(def, storage.resolve(def, settings), tab), activityBlock(def.id));
      },
    })),
    ...sections().map((s) => ({ ...s, order: s.order ?? 0 })),
  ].sort((a, b) => a.order - b.order);

  const nav = document.getElementById("tabs");
  const main = document.getElementById("panels");
  for (const entry of entries) {
    const button = el("button", { type: "button", role: "tab", textContent: entry.label });
    button.dataset.id = entry.id;
    button.addEventListener("click", () => showTab(entry.id));
    nav.append(button);

    const panel = el("div", { className: "panel", role: "tabpanel" });
    panel.dataset.id = entry.id;
    entry.render(panel, { tab });
    main.append(panel);
  }

  let last = null;
  try {
    last = localStorage.getItem(LAST_TAB);
  } catch {}
  showTab(entries.some((e) => e.id === last) ? last : entries[0]?.id);
})();
