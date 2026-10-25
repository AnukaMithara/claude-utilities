# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

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
