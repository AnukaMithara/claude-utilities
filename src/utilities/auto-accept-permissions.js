// Auto-accepts "Allow Claude to use <tool>?" prompts after a configurable delay,
// with an on-screen countdown you can cancel. It only ever clicks "Allow once",
// never "Deny" or an "always" variant. Optionally it also clicks "Submit" on MCP
// "<server> requests your input" forms (never "Decline").
(() => {
  const ID = "auto-accept-permissions";
  const MAX_ATTEMPTS = 3;

  const parseList = (s) =>
    (s ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);

  // Prefer the prompt's aria-label ("Permission request: use Execute SQL (Supabase)"),
  // falling back to the "Allow Claude to use …?" heading text.
  function toolNameFor(button) {
    const group = button.closest('[aria-label^="Permission request"]');
    const label = group
      ?.getAttribute("aria-label")
      ?.replace(/^Permission request:\s*/i, "")
      .replace(/^use\s+/i, "")
      .trim();
    if (label) return label;

    let el = button;
    for (let i = 0; i < 8 && el.parentElement; i++) {
      el = el.parentElement;
      const m = /Allow Claude to (?:use|run|read|edit|write)\s+([^?\n]+)\?/i.exec(el.textContent ?? "");
      if (m) return m[1].trim();
    }
    return null;
  }

  // `details` is extra text the never-list is also checked against (an input
  // request's message, e.g. "This SQL includes destructive operations (DROP…").
  function permitted(tool, cfg, details = "") {
    const name = tool.toLowerCase();
    const text = `${name} ${details.toLowerCase()}`;
    if (parseList(cfg.block).some((b) => text.includes(b))) return false;
    const allow = parseList(cfg.allow);
    return allow.length === 0 || allow.some((a) => name.includes(a));
  }

  // Full pointer sequence, in case the button reacts to more than "click".
  function press(button) {
    button.focus();
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      const Ctor = type.startsWith("pointer") ? PointerEvent : MouseEvent;
      button.dispatchEvent(
        new Ctor(type, { bubbles: true, cancelable: true, composed: true, view: window, button: 0 })
      );
    }
  }

  const promptOf = (button) => button.closest('[aria-label^="Permission request"]');

  // claude.ai may disable the button with the attribute or only mark it with ARIA.
  const isDisabled = (b) => b.disabled || b.getAttribute("aria-disabled") === "true";

  // Ask the page bridge (src/content/page-bridge.js) to run, in a hidden tab, the
  // animation frames and visibility checks the browser skips there.
  function flush(target = document) {
    target.dispatchEvent(new CustomEvent("claude-utilities:flush", { bubbles: true }));
  }

  // Boxes inside the prompt whose content scrolls.
  function scrollBoxes(prompt) {
    return [prompt, ...prompt.querySelectorAll("*")].filter(
      (el) =>
        el.scrollHeight > el.clientHeight + 2 && /(auto|scroll|overlay)/.test(getComputedStyle(el).overflowY)
    );
  }

  const STEP_MS = 60;
  const MAX_PASSES = 3;

  // Long tool inputs show "Scroll to the end to allow this." and keep "Allow once"
  // disabled until the content box has been read to the bottom. Jumping straight to
  // the end isn't always counted, and in a hidden tab the page never sees the
  // scroll at all, so this reads it like a person would: from the top down, one
  // step at a time, letting the page see each step. If the button is still off at
  // the end it goes back up step by step, then down again, checking after every step.
  async function unlock(button) {
    const prompt = promptOf(button);
    if (!prompt) return;
    const unlocked = () => !button.isConnected || !isDisabled(button);
    const settle = async () => {
      flush(prompt);
      await ClaudeUtilities.wait(STEP_MS);
      return unlocked();
    };

    async function moveTo(box, top) {
      box.scrollTop = top;
      // A hidden tab only sends scroll events once it is shown again.
      box.dispatchEvent(new Event("scroll"));
      return settle();
    }

    async function sweep(box, down) {
      for (let i = 0; i < 400; i++) {
        const end = Math.max(0, box.scrollHeight - box.clientHeight);
        const step = Math.max(40, Math.floor(box.clientHeight * 0.6));
        const next = down ? Math.min(end, box.scrollTop + step) : Math.max(0, box.scrollTop - step);
        if (await moveTo(box, next)) return true;
        if (next === (down ? end : 0)) break;
      }
      box.dispatchEvent(new Event("scrollend"));
      return settle();
    }

    for (let pass = 0; pass < MAX_PASSES; pass++) {
      if (!ClaudeUtilities.alive() || unlocked()) return;
      const boxes = scrollBoxes(prompt);
      if (!boxes.length) {
        if (await settle()) return;
        await ClaudeUtilities.wait(500);
        continue;
      }
      for (const box of boxes) {
        if (pass === 0 && (await moveTo(box, 0))) return; // start from the beginning
        if (await sweep(box, true)) return;
      }
      await ClaudeUtilities.wait(250);
      if (await settle()) return;
      for (const box of boxes) if (await sweep(box, false)) return;
    }
  }

  // The button also holds a "Ctrl ⏎" hint, so its text is "Allow onceCtrl…".
  const isAllowOnce = (b) => /^Allow once/i.test(b.textContent.trim());

  // MCP servers can ask for input ("Supabase requests your input", Decline / Submit).
  const INPUT_HEADING = /^(.{1,80}?) requests your input$/i;
  const isSubmit = (b) => /^Submit$/i.test(b.textContent.trim());

  // The form around a "Submit" button: the nearest ancestor holding the
  // "<server> requests your input" heading and a "Decline" button.
  function inputRequestFor(button) {
    let el = button;
    for (let i = 0; i < 10 && el.parentElement; i++) {
      el = el.parentElement;
      if (!/requests your input/i.test(el.textContent ?? "")) continue;
      const heading = [...el.querySelectorAll("*")].find(
        (h) => h.children.length === 0 && INPUT_HEADING.test(h.textContent.trim())
      );
      const decline = [...el.querySelectorAll("button")].some((b) => /^Decline$/i.test(b.textContent.trim()));
      if (!heading || !decline) return null;
      return { form: el, server: INPUT_HEADING.exec(heading.textContent.trim())[1].trim() };
    }
    return null;
  }

  // A required field left empty needs a person.
  const needsAnswer = (form) =>
    [...form.querySelectorAll("input, textarea, select")].some(
      (f) =>
        (f.required || f.getAttribute("aria-required") === "true") &&
        (f.type === "checkbox" || f.type === "radio" ? !form.querySelector(`[name="${CSS.escape(f.name)}"]:checked`) : !f.value)
    );

  // Prompts on the page this utility may answer: [{ button, tool, verb, details }].
  function findRequests(cfg) {
    const found = [];
    for (const button of document.querySelectorAll("button")) {
      if (isAllowOnce(button)) {
        const tool = toolNameFor(button);
        if (tool) found.push({ button, tool, verb: "Allowing", details: "" });
      } else if (cfg.inputs && isSubmit(button)) {
        const request = inputRequestFor(button);
        if (!request || needsAnswer(request.form)) continue;
        found.push({
          button,
          tool: `${request.server} input`,
          verb: "Submitting",
          details: request.form.textContent ?? "",
        });
      }
    }
    return found;
  }

  // Still the button we scheduled (React can reuse or relabel nodes).
  const stillAnswerable = (b) => b.isConnected && (isAllowOnce(b) || (isSubmit(b) && !!inputRequestFor(b)));

  // Number of auto-allowed prompts in the (24 h) activity log.
  async function allowedCount() {
    const log = (await chrome.storage.local.get("activityLog")).activityLog ?? [];
    return log.filter((e) => e.utility === ID && e.message.startsWith("Allowed")).length;
  }

  // Small on-screen notice in claude.ai's style. Shadow DOM keeps the page's CSS out of it.
  function createBanner() {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        .box { display:flex; align-items:center; gap:10px; padding:8px 8px 8px 12px; border-radius:12px;
               font:500 13px system-ui, "Segoe UI", sans-serif;
               color:hsl(0 0% 97.6%); background:hsl(0 0% 12.5%);
               border:0.5px solid hsl(0 0% 87.8% / 0.15); box-shadow:0 4px 20px hsl(0 0% 0% / 0.35); }
        .dot { width:8px; height:8px; border-radius:50%; background:hsl(14.8 63.1% 59.6%); flex:none; }
        button { font:inherit; color:hsl(0 0% 12.5%); background:hsl(0 0% 97.6%); border:0;
                 border-radius:8px; height:26px; padding:0 10px; cursor:pointer; }
        button:hover { background:hsl(0 0% 76.1%); }
        button[hidden] { display:none; }
      </style>
      <div class="box"><span class="dot"></span><span id="text"></span><button id="cancel" type="button">Cancel</button></div>`;
    const text = root.getElementById("text");
    const cancel = root.getElementById("cancel");
    let hideTimer;
    let onCancel = () => {};
    cancel.addEventListener("click", () => onCancel());

    return {
      countdown(message, cancelFn) {
        clearTimeout(hideTimer);
        text.textContent = message;
        cancel.hidden = false;
        onCancel = cancelFn;
        if (!host.isConnected) document.documentElement.append(host);
      },
      notice(message, ms = 3000) {
        clearTimeout(hideTimer);
        text.textContent = message;
        cancel.hidden = true;
        if (!host.isConnected) document.documentElement.append(host);
        hideTimer = setTimeout(() => host.remove(), ms);
      },
      hide() {
        clearTimeout(hideTimer);
        host.remove();
      },
    };
  }

  // Report the tab as visible and focused to claude.ai, and keep the browser from
  // discarding it, so it keeps working while you are in another tab or window.
  function setAwake(on) {
    document.dispatchEvent(new CustomEvent(on ? "claude-utilities:awake" : "claude-utilities:asleep"));
    try {
      chrome.runtime.sendMessage({ type: "keep-alive", on: !!on }).catch(() => {});
    } catch {} // extension reloaded
  }

  ClaudeUtilities.register({
    id: ID,
    name: "Auto-accept",
    tabLabel: "Permissions",
    order: 0,
    scope: "tab",
    defaults: { delay: 3, allow: "", block: "", awake: true, inputs: false },
    options: [
      {
        key: "delay",
        label: "Delay",
        type: "number",
        min: 0,
        max: 60,
        suffix: "seconds",
        help: "0 accepts immediately. A countdown with Cancel shows on the page.",
      },
      {
        key: "allow",
        label: "Only",
        type: "text",
        placeholder: "All tools",
        help: "Comma-separated tool names to auto-accept. Empty = all.",
      },
      {
        key: "block",
        label: "Never",
        type: "text",
        placeholder: "e.g. delete, apply_migration",
        help: "Comma-separated tool names to always leave for you.",
      },
      {
        key: "inputs",
        label: "Input",
        type: "checkbox",
        text: "Also submit MCP input requests",
        help:
          'Clicks Submit on "<server> requests your input" forms (never Decline), ' +
          "unless a required field is empty. The Never list is also checked against " +
          "the request's message, e.g. drop, delete, truncate.",
      },
      {
        key: "awake",
        label: "Away",
        type: "checkbox",
        text: "Keep working in the background",
        help:
          "Tells claude.ai the tab is visible and focused, and stops the browser unloading it, " +
          "while you are in another tab or window.",
      },
    ],

    start(initial) {
      let cfg = initial;
      let stopped = false;
      const handled = new WeakMap(); // button -> tool it was scheduled for
      const unlocking = new WeakMap(); // button -> time the last unlock attempt ended
      const pending = new Map(); // button -> { tool, verb, remaining, cancelled }
      const banner = createBanner();
      const live = () => !stopped && ClaudeUtilities.alive();

      function renderPending() {
        const first = [...pending.entries()].find(([, e]) => !e.cancelled);
        if (!first) return banner.hide();
        const [button, { tool, verb, remaining }] = first;
        banner.countdown(`${verb} ${tool} in ${remaining}s`, () => cancel(button, tool));
      }

      function cancel(button, tool) {
        const entry = pending.get(button);
        if (entry) entry.cancelled = true;
        pending.delete(button);
        try {
          ClaudeUtilities.log(ID, `Cancelled ${tool}`);
        } catch {}
        renderPending();
      }

      async function accept(button, tool) {
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          if (!live() || !stillAnswerable(button)) return;
          if (isDisabled(button)) {
            // Locked again (e.g. the content grew): the next scan scrolls and retries.
            handled.delete(button);
            return;
          }
          press(button);
          // In a hidden tab, let the page finish what it does after the click.
          flush();

          if (attempt === 1) {
            try {
              ClaudeUtilities.log(ID, `Allowed ${tool}`);
            } catch {}
            // Give the background worker a moment to store the entry, then show the total.
            ClaudeUtilities.wait(400).then(async () => {
              try {
                if (live()) banner.notice(`Allowed ${tool} · ${await allowedCount()} in 24 h`);
              } catch {}
            });
          }

          // If the prompt is still there a moment later, the click didn't take: try again.
          for (let i = 0; i < 5; i++) {
            await ClaudeUtilities.wait(300);
            flush();
          }
        }
      }

      async function schedule({ button, tool, verb, details }) {
        const delay = Math.max(0, Number(cfg.delay) || 0);
        if (delay === 0) return accept(button, tool);

        // Count down against the clock, so a late tick can't make it run long.
        const end = Date.now() + delay * 1000;
        const entry = { tool, verb, remaining: delay, cancelled: false };
        pending.set(button, entry);
        while (true) {
          if (entry.cancelled || !live()) return;
          if (!button.isConnected) {
            pending.delete(button);
            return renderPending();
          }
          const left = end - Date.now();
          if (left <= 0) break;
          entry.remaining = Math.ceil(left / 1000);
          renderPending();
          await ClaudeUtilities.wait(left % 1000 || 1000);
        }
        pending.delete(button);
        renderPending();
        // Settings may have changed during the countdown.
        const stillOn = verb === "Allowing" || cfg.inputs;
        if (stillOn && permitted(tool, cfg, details)) accept(button, tool);
      }

      async function startUnlock(button) {
        unlocking.set(button, Infinity); // running
        try {
          await unlock(button);
        } finally {
          unlocking.set(button, Date.now());
        }
        if (live()) scan();
      }

      const scan = () => {
        if (!live()) return;
        for (const request of findRequests(cfg)) {
          const { button, tool, details } = request;
          if (handled.get(button) === tool || !permitted(tool, cfg, details)) continue;
          if (isDisabled(button)) {
            // Retry a locked prompt every few seconds; the observer below also sees
            // it turn on and rescans.
            if (Date.now() - (unlocking.get(button) ?? 0) > 5000) startUnlock(button);
            continue;
          }
          handled.set(button, tool);
          schedule(request);
        }
      };

      let queued = false;
      const queueScan = () => {
        if (queued) return;
        queued = true;
        ClaudeUtilities.wait(150).then(() => {
          queued = false;
          scan();
        });
      };
      const observer = new MutationObserver(queueScan);
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["disabled", "aria-disabled"], // "Allow once" turning on after the scroll
      });

      // Back in view: whatever was skipped while hidden can be retried straight away.
      const onVisibility = () => {
        for (const button of document.querySelectorAll("button")) {
          if (unlocking.get(button) !== Infinity) unlocking.delete(button);
        }
        queueScan();
      };
      document.addEventListener("claude-utilities:visibility", onVisibility);
      document.addEventListener("visibilitychange", onVisibility);

      // Safety net for prompts the observer missed; while the tab isn't rendering it
      // also keeps the page's animation frames moving.
      (async () => {
        while (live()) {
          await ClaudeUtilities.wait(1000);
          if (!live()) break;
          flush(); // does nothing while the page is rendering normally
          scan();
        }
      })();

      setAwake(cfg.awake);
      scan();

      return {
        update(next) {
          if (next.awake !== cfg.awake) setAwake(next.awake);
          cfg = next;
          scan();
        },
        stop() {
          stopped = true;
          observer.disconnect();
          document.removeEventListener("claude-utilities:visibility", onVisibility);
          document.removeEventListener("visibilitychange", onVisibility);
          for (const entry of pending.values()) entry.cancelled = true;
          pending.clear();
          banner.hide();
          setAwake(false);
        },
      };
    },
  });
})();
