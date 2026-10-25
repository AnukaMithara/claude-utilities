# Chrome Web Store: listing and publishing guide

Everything needed to submit Claude Utilities to the Chrome Web Store. Copy the text blocks into the [Developer Dashboard](https://chrome.google.com/webstore/devconsole).

## 1. Before you submit

1. Register a Chrome Web Store developer account (one-time USD 5 fee) and verify your contact email.
2. Bump the version in **both** `manifest.json` and `package.json` for every new upload (the store rejects a version it has already seen).
3. Build and check:

   ```sh
   npm run check
   npm run images     # only if icons or store images changed
   npm run package    # -> dist/claude-utilities-<version>.zip
   ```

4. Load `dist/` contents unpacked once more (or the repo folder) and smoke-test:
   - Permissions tab: switch on for one tab, confirm a tool prompt is accepted after the countdown and that Cancel works; confirm another tab is not affected.
   - Prompts tab: New, Edit, Delete, Insert, From chat.
   - Settings tab: Export downloads a JSON file.

## 2. Store listing

### Name

```
Claude Utilities
```

> **Trademark note.** "Claude" is Anthropic's trademark. The listing, screenshots and README all state that the extension is unofficial and not affiliated with Anthropic, and the icon does not use Anthropic's logo. If a reviewer flags the name for impersonation, resubmit as **Utilities for Claude** (change `name`, `short_name` and `action.default_title` in `manifest.json`).

### Summary (manifest `description`, max 132 characters)

```
Unofficial tools for claude.ai: auto-accept tool permissions in the tabs you choose, and insert saved prompts in one click.
```

### Description

```
Claude Utilities adds small, focused tools to claude.ai and Claude Code on the web.

AUTO-ACCEPT TOOL PERMISSIONS, PER TAB
When Claude asks "Allow Claude to use <tool>?", the extension can click "Allow once" for you.
• Off by default. Switch it on from the popup only for the tab you are working in; every other tab stays manual. The switch is forgotten when the tab closes.
• A countdown with a Cancel button appears on the page before each accept (delay is configurable, 0 for immediate).
• Allow and never-allow lists let you limit it to certain tools, or keep risky ones for yourself.
• It only ever clicks "Allow once". It never clicks Deny or "always allow".
• The toolbar badge shows ON for tabs where it is active, and the popup lists the last 24 hours of activity.

SAVED PROMPTS
• Save, edit, search and delete prompts in the popup.
• Insert appends a prompt to the chat box of the current tab, without sending.
• "From chat" saves what you have already typed.

SETTINGS
• Export all your data (settings, prompts, activity) as a JSON file.

PRIVACY
Everything stays in your browser. No servers, no analytics, no tracking, no remote code.

Open source: https://github.com/AnukaMithara/claude-utilities

Claude Utilities is an independent, unofficial project. It is not affiliated with, endorsed by, or sponsored by Anthropic. "Claude" is a trademark of Anthropic, PBC.
```

### Category and language

- **Category:** Productivity → Tools (or "Developer Tools")
- **Language:** English

### Graphic assets (in `store/images/`)

| Asset | File | Size |
|---|---|---|
| Store icon | `store/images/icon-store-128.png` | 128×128 |
| Screenshot 1 | `store/images/screenshot-1-permissions.png` | 1280×800 |
| Screenshot 2 | `store/images/screenshot-2-prompts.png` | 1280×800 |
| Screenshot 3 | `store/images/screenshot-3-countdown.png` | 1280×800 |
| Small promo tile | `store/images/promo-small-440x280.png` | 440×280 |
| Marquee promo tile (optional) | `store/images/promo-marquee-1400x560.png` | 1400×560 |

All are regenerated from the HTML in `store/src/` with `npm run images`.

### Additional fields

- **Official URL:** none (leave empty, unless you own a verified site for it).
- **Homepage URL:** `https://github.com/AnukaMithara/claude-utilities`
- **Support URL:** `https://github.com/AnukaMithara/claude-utilities/issues`

## 3. Privacy practices tab

### Single purpose

```
Adds productivity tools to claude.ai: optionally auto-accepting tool permission prompts in tabs the user chooses, and inserting the user's saved prompts into the chat box.
```

### Permission justifications

**storage**
```
Saves the user's settings (delay, allow and never-allow tool lists), saved prompts, per-tab on/off switches and a 24-hour activity log in the browser. Nothing is sent off the device.
```

**alarms**
```
Runs an hourly cleanup that deletes activity log entries older than 24 hours.
```

**scripting**
```
When the user clicks "Insert" or "From chat" in the popup, the extension runs a small function in the current claude.ai tab to append the saved prompt to the chat box, or to read the text the user typed so it can be saved as a prompt.
```

**Host permission: https://claude.ai/***
```
The extension only works on claude.ai. Its content script detects tool permission prompts and, only in tabs where the user switched auto-accept on, clicks "Allow once" after a visible countdown. The host permission also lets the popup check that the current tab is claude.ai before inserting a prompt.
```

### Remote code

```
No, I am not using remote code.
```

All JavaScript ships inside the package; nothing is fetched or evaluated at runtime.

### Data usage

Tick **Website content** only. The extension reads text on claude.ai (the tool name in permission prompts, and the chat box text when the user clicks "From chat") and keeps it only in the browser; declaring it avoids a disclosure mismatch in review. Leave every other type unticked. Then certify all three statements:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

### Privacy policy URL

```
https://github.com/AnukaMithara/claude-utilities/blob/main/PRIVACY.md
```

## 4. Distribution

- **Visibility:** Public (or Unlisted for a soft launch).
- **Regions:** All regions.
- **Pricing:** Free.

## 5. Submit

1. **Package** tab → upload `dist/claude-utilities-<version>.zip`.
2. Fill in **Store listing**, **Privacy practices** and **Distribution** from the sections above.
3. Click **Submit for review**. Reviews usually take from a few days to a few weeks; extensions with host permissions can take longer.

## 6. Updating

1. Make changes, add a `CHANGELOG.md` entry.
2. Bump the version in `manifest.json` and `package.json`.
3. `npm run check && npm run package`.
4. Dashboard → **Package** → **Upload new package** → submit.
