# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-11-24

### Fixed

- **Auto-accept in background tabs and windows.** Prompts are now accepted while you work in another tab or window. Before, the browser's background throttling stretched the countdown to minutes, and the page never noticed clicks and scrolls while hidden.
  - Countdown and rescans keep time in hidden tabs (timed by the background worker instead of the tab's throttled timers).
  - A page-world helper reports the tab as visible and focused to claude.ai and runs the page's pending animation-frame and visibility checks that a hidden or covered tab skips.
  - The tab is kept from being discarded by the browser while auto-accept is on.
  - New "Away" option (on by default) to turn the visibility and keep-loaded behaviour off.
- **Long inputs that stayed locked.** Scroll-locked inputs are now read from the top down in steps, then back up and down again until "Allow once" turns on, instead of jumping to the end. Also handles buttons disabled only with `aria-disabled`, retries locked prompts every few seconds and when the tab is shown again.

### Added

- **MCP input requests (optional, off by default).** "Input" clicks Submit on "&lt;server&gt; requests your input" forms (never Decline), unless a required field is empty or a never-allow word appears in the server name or message.

## [1.0.0] - 2026-10-25

First public release.

### Added

- **Auto-accept tool permissions**: clicks "Allow once" on claude.ai permission prompts.
  - Off by default and switched on per tab; the switch is cleared when the tab closes.
  - Configurable delay with an on-page countdown and Cancel button.
  - Allow and never-allow lists of tool names.
  - Scrolls long tool inputs so a scroll-locked "Allow once" becomes clickable.
  - Toolbar badge shows ON for tabs where it is active.
  - 24-hour activity log in the popup with automatic cleanup.
- **Saved prompts**: save, edit, search and delete prompts in the popup; Insert appends a prompt to the chat box; From chat saves what you've typed.
- **Settings**: export all data (settings, prompts, activity) as JSON.
- Tabbed popup styled after claude.ai, in light and dark mode.
- Store images, privacy policy and packaging scripts.
