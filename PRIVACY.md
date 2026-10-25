# Privacy Policy

_Last updated: 25 October 2026_

Claude Utilities ("the extension") is an unofficial browser extension for claude.ai. This policy explains what data the extension handles.

## Summary

The extension does not collect, transmit, sell or share any personal data. Everything it stores stays in your browser.

## What the extension stores, and where

All data is kept with the browser's extension storage APIs on your device:

| Data | Storage | Purpose | Retention |
|---|---|---|---|
| Settings (delay, allow and never-allow lists) | `chrome.storage.sync` | Remember your preferences. If you have browser sync turned on, your browser may sync these settings between your own devices through your browser account. | Until you change them or remove the extension. |
| Saved prompts (title and text you enter) | `chrome.storage.local` | Show and insert your prompts. | Until you delete them or remove the extension. |
| Activity log (time and tool name of each auto-accepted or cancelled permission prompt) | `chrome.storage.local` | Show recent activity in the popup. | Deleted automatically after 24 hours, or when you click Clear. |
| Per-tab on/off switches | `chrome.storage.session` | Remember which tabs have auto-accept switched on. | Cleared when the tab closes or the browser restarts. |

## What the extension reads on claude.ai

- To auto-accept tool permissions in tabs where you switched it on, it reads the permission prompt on the page (the tool name and the "Allow once" button). It does not read or store your conversations.
- When you click **Insert** or **From chat** in the popup, it reads or appends to the chat input of the current claude.ai tab. The text is only placed into the page or into your saved prompts in local storage.

## What the extension does not do

- It has no server and makes no network requests of its own.
- It does not use analytics, tracking, advertising or third-party services.
- It does not sell or transfer data to anyone.
- It does not use data for creditworthiness or lending decisions.
- It does not load or run remote code.

## Your control

- Export everything at any time from **Settings → Export data**.
- Delete prompts and clear activity from the popup.
- Removing the extension deletes all of its stored data from your browser.

## Changes

Changes to this policy will be published in this file in the project repository: https://github.com/AnukaMithara/claude-utilities

## Contact

Questions or concerns: open an issue at https://github.com/AnukaMithara/claude-utilities/issues

Claude Utilities is not affiliated with, endorsed by, or sponsored by Anthropic.
