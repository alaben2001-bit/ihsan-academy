import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const deployDir = path.resolve(here, "..");
const siteDir = path.join(deployDir, "site");
const out = path.join(deployDir, "public");

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const file of ["index.html", "app.js", "style.css"]) {
  await cp(path.join(siteDir, file), path.join(out, file));
}
console.log("Prepared the simplified Cloudflare daily-use app. Only the three public site assets are published.");
