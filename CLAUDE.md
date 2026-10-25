# CLAUDE.md

Guidance for AI coding assistants working in this repository.

## Git and attribution

- Commits are authored by the repository owner only (AnukaMithara <anukamithara@gmail.com>).
- Do not add `Co-Authored-By` trailers, "Generated with" lines or any other AI/assistant attribution to commit messages, pull request descriptions, code comments or docs.
- Do not name the company that makes Claude anywhere in the repository (files, commit messages, PRs). Where a disclaimer is needed (README, PRIVACY.md, store listing, store images), use: "Unofficial, independent project. Not affiliated with the makers of Claude."
- Commit or push only when asked.

## Project

Claude Utilities is a Manifest V3 browser extension for claude.ai (Chrome, Edge, Brave). Plain JavaScript, no build step: files in `src/` load directly.

- `src/utilities/*.js`: page utilities registered with `ClaudeUtilities.register(...)` (shape in `src/core/registry.js`); `scope: "tab"` makes one opt-in per tab.
- `src/popup/`: tabbed popup built from the registry; popup-only tabs live in `src/popup/sections/`.
- `src/background.js`: badge, per-tab state, activity log and its 24-hour cleanup.
- Popup styling uses claude.ai's theme tokens in `src/popup/popup.css` (light and dark).

## Commands

```sh
npm run check     # syntax-check scripts, compare manifest/package versions
npm run images    # re-render icons and store images from store/src
npm run package   # validate manifest and build dist/claude-utilities-<version>.zip
```

When adding a utility, add it to `content_scripts.js` in `manifest.json` (before `runner.js`) and to `src/popup/popup.html`. Bump the version in both `manifest.json` and `package.json` for each store upload, and add a `CHANGELOG.md` entry.
