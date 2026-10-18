import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const deployDir = path.resolve(here, "..");
const repoRoot = path.resolve(deployDir, "../..");
const out = path.join(deployDir, "public");

await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, "assets"), { recursive: true });

for (const file of ["index.html", "manifest.json", "offline.html"]) {
  await cp(path.join(repoRoot, file), path.join(out, file));
}
for (const file of ["app.js", "app.css", "admin-mobile.css", "ui-organize.css", "login-redesign.css", "icon.svg", "ihsan-emblem.svg"]) {
  await cp(path.join(repoRoot, "assets", file), path.join(out, "assets", file));
}
console.log("Prepared an explicit static-asset allowlist. Server code and data files are not copied.");
