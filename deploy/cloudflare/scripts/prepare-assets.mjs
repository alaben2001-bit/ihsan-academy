import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const deployDir = path.resolve(here, "..");
const siteDir = path.join(deployDir, "site");
const out = path.join(deployDir, "public");

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const file of ["index.html", "app.js", "startup.js", "style.css", "manifest.json", "service-worker.js", "icon.svg", "icon-192.svg", "icon-512.svg", "robots.txt", "sitemap.xml", "about.html", "privacy.html", "_headers", "google86f17ad8ed1c8ef6.html"]) {
  await cp(path.join(siteDir, file), path.join(out, file));
}
console.log("Prepared the simplified Cloudflare daily-use app. Static site assets and security headers prepared for Cloudflare Pages.");
