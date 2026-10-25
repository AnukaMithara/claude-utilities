// Syntax-checks every extension script and confirms package.json and
// manifest.json agree on the version.
//
//   node scripts/check.mjs
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function jsFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return jsFiles(path);
    return /\.m?js$/.test(name) ? [path] : [];
  });
}

let failed = false;
for (const file of [...jsFiles(join(root, "src")), ...jsFiles(join(root, "scripts")), ...jsFiles(join(root, "store"))]) {
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (r.status !== 0) {
    failed = true;
    console.error(r.stderr);
  }
}

const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (manifest.version !== pkg.version) {
  failed = true;
  console.error(`Version mismatch: manifest.json ${manifest.version}, package.json ${pkg.version}`);
}

if (failed) process.exit(1);
console.log("All checks passed.");
