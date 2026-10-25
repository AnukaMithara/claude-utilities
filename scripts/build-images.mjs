// Renders the extension icons and Chrome Web Store images from the HTML sources
// in store/src using a headless Chromium browser (Chrome, Edge or Brave).
//
//   node scripts/build-images.mjs
//
// Set CHROME_PATH to pick a specific browser binary.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "store", "src");
const out = join(root, "store", "images");

const candidates = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);
const browser = candidates.find((p) => existsSync(p));
if (!browser) {
  console.error("No Chromium browser found. Set CHROME_PATH.");
  process.exit(1);
}

function render(page, file, width, height, { transparent = false, query = "" } = {}) {
  const url = pathToFileURL(join(src, page)).href + query;
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--allow-file-access-from-files",
    "--force-device-scale-factor=1",
    "--force-color-profile=srgb",
    "--virtual-time-budget=4000",
    `--window-size=${width},${height}`,
    `--screenshot=${file}`,
  ];
  if (transparent) args.push("--default-background-color=00000000");
  const r = spawnSync(browser, [...args, url], { stdio: "pipe" });
  if (r.status !== 0 || !existsSync(file)) {
    console.error(`Failed: ${page} -> ${file}\n${r.stderr}`);
    process.exit(1);
  }
  console.log(`  ${file.replace(root, ".")}  ${width}x${height}`);
}

mkdirSync(out, { recursive: true });
console.log(`Using ${browser}`);

// Icons first: the other images use icons/icon128.png.
for (const size of [16, 32, 48, 128]) {
  render("icon.html", join(root, "icons", `icon${size}.png`), size, size, { transparent: true, query: `?size=${size}` });
}
render("icon.html", join(out, "icon-store-128.png"), 128, 128, { transparent: true, query: "?size=128" });

render("screenshot-permissions.html", join(out, "screenshot-1-permissions.png"), 1280, 800);
render("screenshot-prompts.html", join(out, "screenshot-2-prompts.png"), 1280, 800);
render("screenshot-countdown.html", join(out, "screenshot-3-countdown.png"), 1280, 800);
render("promo-small.html", join(out, "promo-small-440x280.png"), 440, 280);
render("promo-marquee.html", join(out, "promo-marquee-1400x560.png"), 1400, 560);
