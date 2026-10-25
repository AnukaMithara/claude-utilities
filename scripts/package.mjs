// Checks the manifest and builds the Chrome Web Store upload:
//   dist/claude-utilities-<version>.zip  (manifest.json, icons/, src/ only)
//
//   node scripts/package.mjs
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));

// Every file the manifest points at must exist.
const referenced = [
  ...Object.values(manifest.icons ?? {}),
  ...Object.values(manifest.action?.default_icon ?? {}),
  manifest.action?.default_popup,
  manifest.background?.service_worker,
  ...(manifest.content_scripts ?? []).flatMap((c) => [...(c.js ?? []), ...(c.css ?? [])]),
].filter(Boolean);
const missing = referenced.filter((p) => !existsSync(join(root, p)));
if (missing.length) {
  console.error(`Missing files referenced by manifest.json:\n  ${missing.join("\n  ")}`);
  process.exit(1);
}
if (manifest.description.length > 132) {
  console.error(`Description is ${manifest.description.length} characters; the store allows 132.`);
  process.exit(1);
}

const dist = join(root, "dist");
const zip = join(dist, `claude-utilities-${manifest.version}.zip`);
mkdirSync(dist, { recursive: true });
rmSync(zip, { force: true });

const entries = ["manifest.json", "icons", "src"];
const zipRelative = relative(root, zip);
// Windows 10+ ships bsdtar (System32\tar.exe), which writes zip files with
// forward-slash paths. Call it by full path so Git Bash's GNU tar isn't used.
const r =
  process.platform === "win32"
    ? spawnSync(join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe"), ["-a", "-c", "-f", zipRelative, ...entries], {
        cwd: root,
        stdio: "inherit",
      })
    : spawnSync("zip", ["-r", "-q", zipRelative, ...entries, "-x", "*.DS_Store"], { cwd: root, stdio: "inherit" });
if (r.status !== 0) process.exit(r.status ?? 1);

console.log(`Built ${zip.replace(root, ".")} (${(statSync(zip).size / 1024).toFixed(1)} KB)`);
