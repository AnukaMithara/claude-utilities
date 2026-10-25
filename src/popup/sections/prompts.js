// Prompts tab: save, edit and delete prompts, and append one to the chat input
// of the claude.ai tab the popup was opened from.

// The two functions below run inside the claude.ai tab via
// chrome.scripting.executeScript, so each must be self-contained.

// Returns the text typed in the chat input, one line per paragraph.
function pageReadInput() {
  const editors = [...document.querySelectorAll('.ProseMirror[contenteditable="true"]')].filter(
    (el) => el.offsetParent !== null
  );
  editors.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
  const editor = editors[0];
  if (!editor) return { ok: false, error: "No chat input found on this page." };
  const text = [...editor.children].map((c) => c.innerText.replace(/\n$/, "")).join("\n").trim();
  return { ok: true, text };
}

// Appends text to the chat input as a new paragraph. ProseMirror ignores direct
// DOM edits, so it goes in through a synthetic paste.
async function pageAppend(text) {
  const editors = [...document.querySelectorAll('.ProseMirror[contenteditable="true"]')].filter(
    (el) => el.offsetParent !== null
  );
  editors.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
  const editor = editors[0];
  if (!editor) return { ok: false, error: "No chat input found on this page." };

  const existing = [...editor.children].map((c) => c.innerText.trim()).join("").length > 0;
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor.lastElementChild ?? editor);
  range.collapse(false);
  const selection = getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  // Let the editor pick up the new caret position before pasting.
  await new Promise((r) => setTimeout(r, 30));

  const data = new DataTransfer();
  data.setData("text/plain", existing ? `\n${text}` : text);
  editor.dispatchEvent(
    new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true })
  );
  return { ok: true };
}

async function runInTab(tabId, func, args = []) {
  // Missing until the extension is reloaded after the "scripting" permission was added.
  if (!chrome.scripting) {
    throw new Error("reload the extension at brave://extensions (↻ on the Claude Utilities card).");
  }
  const [result] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return result?.result;
}

ClaudeUtilities.registerSection({
  id: "prompts",
  label: "Prompts",
  order: 10,

  render(panel, { tab }) {
    const { prompts } = ClaudeUtilities;
    const h = (tag, props = {}, ...children) => {
      const node = Object.assign(document.createElement(tag), props);
      node.append(...children);
      return node;
    };
    const button = (text, className = "") =>
      h("button", { type: "button", className: `btn ${className}`.trim(), textContent: text });

    let all = [];
    let editingId = null; // null = adding a new prompt

    // --- toolbar ---
    const search = h("input", { type: "search", placeholder: "Search" });
    const newButton = button("New", "primary");
    const bar = h("div", { className: "prompts-bar" }, search, newButton);

    // --- add / edit form ---
    const titleInput = h("input", { type: "text", placeholder: "Title" });
    const textInput = h("textarea", { rows: 6, placeholder: "Prompt" });
    const fromChat = button("From chat", "ghost left");
    fromChat.title = "Use the text currently typed in the chat box";
    fromChat.disabled = !tab.isClaude;
    const cancel = button("Cancel", "ghost");
    const save = button("Save", "primary");
    const form = h(
      "div",
      { className: "card prompt-form", hidden: true },
      titleInput,
      textInput,
      h("div", { className: "row" }, fromChat, cancel, save)
    );

    const note = h("p", { className: "note warn" });
    const list = h("div", { className: "prompt-list" });
    const empty = h("p", { className: "prompts-empty" });

    if (!tab.isClaude) note.textContent = "Open from a claude.ai tab to insert.";
    const baseNote = note.textContent;
    const flash = (text) => {
      note.textContent = text;
      setTimeout(() => (note.textContent = baseNote), 2500);
    };

    panel.append(bar, form, note, list, empty);

    function openForm(prompt = null) {
      editingId = prompt?.id ?? null;
      titleInput.value = prompt?.title ?? "";
      textInput.value = prompt?.text ?? "";
      save.textContent = "Save";
      form.hidden = false;
      (prompt ? textInput : titleInput).focus();
    }

    function closeForm() {
      form.hidden = true;
      editingId = null;
    }

    async function insert(prompt) {
      try {
        const r = await runInTab(tab.id, pageAppend, [prompt.text]);
        if (r?.ok) window.close(); // back to the page, text appended
        else flash(r?.error ?? "Couldn't insert the prompt.");
      } catch (err) {
        flash(`Couldn't insert the prompt: ${err.message}`);
      }
    }

    function item(p) {
      const insertButton = button("Insert", "brand small");
      insertButton.disabled = !tab.isClaude;
      insertButton.title = "Append to the chat input";
      insertButton.addEventListener("click", () => insert(p));

      const edit = button("Edit", "ghost small");
      edit.addEventListener("click", () => openForm(p));

      const remove = button("Delete", "ghost danger small");
      remove.addEventListener("click", async () => {
        if (remove.dataset.armed) {
          await prompts.remove(p.id);
          return;
        }
        // Two-step delete instead of a confirm() dialog.
        remove.dataset.armed = "1";
        remove.textContent = "Confirm";
        setTimeout(() => {
          delete remove.dataset.armed;
          remove.textContent = "Delete";
        }, 3000);
      });

      return h(
        "div",
        { className: "card prompt" },
        h("b", { textContent: p.title || "Untitled" }),
        h("p", { textContent: p.text }),
        h("div", { className: "actions" }, insertButton, edit, remove)
      );
    }

    function render() {
      const q = search.value.trim().toLowerCase();
      const shown = all.filter((p) => !q || `${p.title}\n${p.text}`.toLowerCase().includes(q));
      list.replaceChildren(...shown.map(item));
      empty.textContent = all.length
        ? shown.length
          ? ""
          : "No prompts match."
        : "No prompts yet.";
      empty.hidden = !empty.textContent;
    }

    newButton.addEventListener("click", () => openForm());
    cancel.addEventListener("click", closeForm);
    search.addEventListener("input", render);

    fromChat.addEventListener("click", async () => {
      try {
        const r = await runInTab(tab.id, pageReadInput);
        if (!r?.ok) flash(r?.error ?? "Couldn't read the chat box.");
        else if (!r.text) flash("The chat box is empty.");
        else {
          textInput.value = r.text;
          if (!titleInput.value) titleInput.value = r.text.split("\n")[0].slice(0, 50);
        }
      } catch (err) {
        flash(`Couldn't read the chat box: ${err.message}`);
      }
    });

    save.addEventListener("click", async () => {
      const text = textInput.value;
      if (!text.trim()) {
        flash("Prompt is empty.");
        return;
      }
      const title = titleInput.value.trim() || text.trim().split("\n")[0].slice(0, 50);
      if (editingId) await prompts.update(editingId, { title, text });
      else await prompts.add(title, text);
      closeForm();
      flash("Saved.");
    });

    prompts.onChange((next) => {
      all = next;
      render();
    });
    prompts.load().then((list) => {
      all = list;
      render();
    });
  },
});
