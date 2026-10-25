// Auto-accepts "Allow Claude to use <tool>?" prompts after a configurable delay,
// with an on-screen countdown you can cancel. It only ever clicks "Allow once",
// never "Deny" or an "always" variant.
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

  function permitted(tool, cfg) {
    const name = tool.toLowerCase();
    if (parseList(cfg.block).some((b) => name.includes(b))) return false;
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

  // Long tool inputs show "Scroll to the end to allow this." and keep "Allow once"
  // disabled until the prompt's content box is scrolled to the bottom.
  function scrollToEnd(button) {
    const prompt = button.closest('[aria-label^="Permission request"]');
    if (!prompt) return;
    for (const el of prompt.querySelectorAll("*")) {
      if (el.scrollHeight <= el.clientHeight + 2) continue;
      if (!/(auto|scroll)/.test(getComputedStyle(el).overflowY)) continue;
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event("scroll"));
    }
  }

  // The button also holds a "Ctrl ⏎" hint, so its text is "Allow onceCtrl…".
  const isAllowOnce = (b) => /^Allow once/i.test(b.textContent.trim());

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
               font:500 13px "anthropic-sans", system-ui, "Segoe UI", sans-serif;
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

  ClaudeUtilities.register({
    id: ID,
    name: "Auto-accept",
    tabLabel: "Permissions",
    order: 0,
    scope: "tab",
    defaults: { delay: 3, allow: "", block: "" },
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
    ],

    start(initial) {
      let cfg = initial;
      const handled = new WeakSet();
      const pending = new Map(); // button -> { tool, remaining, timer }
      const banner = createBanner();

      function renderPending() {
        const first = pending.entries().next().value;
        if (!first) return banner.hide();
        const [button, { tool, remaining }] = first;
        banner.countdown(`Allowing ${tool} in ${remaining}s`, () => cancel(button, tool));
      }

      function cancel(button, tool) {
        clearInterval(pending.get(button)?.timer);
        pending.delete(button);
        try {
          ClaudeUtilities.log(ID, `Cancelled ${tool}`);
        } catch {}
        renderPending();
      }

      function accept(button, tool, attempt = 1) {
        if (!ClaudeUtilities.alive() || !button.isConnected) return;
        if (button.disabled) {
          // Became disabled again (e.g. the content grew): let the next scan scroll and retry.
          handled.delete(button);
          scrollToEnd(button);
          return;
        }
        press(button);

        if (attempt === 1) {
          try {
            ClaudeUtilities.log(ID, `Allowed ${tool}`);
          } catch {}
          // Give the background worker a moment to store the entry, then show the total.
          setTimeout(async () => {
            try {
              banner.notice(`Allowed ${tool} · ${await allowedCount()} in 24 h`);
            } catch {}
          }, 400);
        }

        // If the prompt is still there a moment later, the click didn't take: try again.
        if (attempt < MAX_ATTEMPTS) {
          setTimeout(() => accept(button, tool, attempt + 1), 1500);
        }
      }

      function schedule(button, tool) {
        const delay = Math.max(0, Number(cfg.delay) || 0);
        if (delay === 0) return accept(button, tool);

        const entry = { tool, remaining: delay, timer: null };
        entry.timer = setInterval(() => {
          if (!button.isConnected) return cancelSilently(button);
          entry.remaining -= 1;
          if (entry.remaining > 0) return renderPending();

          clearInterval(entry.timer);
          pending.delete(button);
          renderPending();
          // Settings may have changed during the countdown.
          if (permitted(tool, cfg)) accept(button, tool);
        }, 1000);
        pending.set(button, entry);
        renderPending();
      }

      function cancelSilently(button) {
        clearInterval(pending.get(button)?.timer);
        pending.delete(button);
        renderPending();
      }

      const scan = () => {
        if (!ClaudeUtilities.alive()) return;
        for (const button of document.querySelectorAll("button")) {
          if (handled.has(button) || !isAllowOnce(button)) continue;
          const tool = toolNameFor(button);
          if (!tool || !permitted(tool, cfg)) continue;
          if (button.disabled) {
            // The observer below sees the button become enabled and rescans.
            scrollToEnd(button);
            continue;
          }
          handled.add(button);
          schedule(button, tool);
        }
      };

      let timer;
      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(scan, 150);
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["disabled"], // "Allow once" turning on after the scroll
      });
      scan();

      return {
        update(next) {
          cfg = next;
          scan();
        },
        stop() {
          clearTimeout(timer);
          observer.disconnect();
          for (const { timer: t } of pending.values()) clearInterval(t);
          pending.clear();
          banner.hide();
        },
      };
    },
  });
})();
