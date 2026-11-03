import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const deployDir = path.resolve(here, "..");
const siteDir = path.join(deployDir, "site");
const out = path.join(deployDir, "public");

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

// Copy the whole static site so new assets (fonts, og-image, _redirects, ...)
// can never be forgotten by a hand-maintained whitelist again.
await cp(siteDir, out, { recursive: true });

console.log("Prepared the simplified Cloudflare daily-use app: static site, self-hosted fonts, security headers and redirects copied to public/.");
