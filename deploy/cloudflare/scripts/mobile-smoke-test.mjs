// HTTP smoke test for the mobile identity/admin access fix and group-creation speed.
// Run against a local `wrangler dev` after the journey/store suite has created the admin:
//   npx wrangler@4 dev --port 8788 --var BOOTSTRAP_SECRET:test-bootstrap-secret-1234
//   node scripts/mobile-smoke-test.mjs
// The script only writes inside the local D1 state and deactivates the group it creates.

import { readFile } from "node:fs/promises";

const BASE = process.env.MOBILE_TEST_BASE || "http://127.0.0.1:8788";
const ADMIN = {
  identity: process.env.MOBILE_TEST_ADMIN || "admin@test.local",
  password: process.env.MOBILE_TEST_PASSWORD || "TestPassword#2026Strong",
};

const checks = [];
function check(name, ok, detail = "") {
  checks.push({ name, ok: Boolean(ok), detail: ok ? "" : String(detail).slice(0, 400) });
  console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : " :: " + String(detail).slice(0, 300)));
}

const siteIndex = await readFile(new URL("../site/index.html", import.meta.url), "utf8");
const expectedVersion = (siteIndex.match(/app\.js\?v=([^"']+)/) || [])[1] || "";
check("site declares an asset version", Boolean(expectedVersion), expectedVersion);

const index = await (await fetch(BASE + "/")).text();
check("index serves the current asset version", index.includes("app.js?v=" + expectedVersion) && index.includes("style.css?v=" + expectedVersion), expectedVersion);
check("index still loads the app shell", index.includes('id="app"') && index.includes("academy-app-script"));

const app = await (await fetch(BASE + "/app.js?v=" + expectedVersion)).text();
check("served app.js has the identity chip", app.includes('id="identity-open"'));
check("served app.js has the identity sheet", app.includes("function identitySheet()"));
check("served app.js switches module from the sheet", app.includes('id="identity-switch-module"'));
check("served app.js exposes admin focus in the sheet", app.includes('id="identity-admin-focus"'));
check("admin tools default to full view", app.includes('function adminFocusIsFull(){return safeStore.get("ihsan_admin_focus")!=="daily"}'));
check("hub states the signed-in identity", app.includes('class="module-user-line"'));
check("group creation updates local state", app.includes("S.groups=[...S.groups,{...created"));

const css = await (await fetch(BASE + "/style.css?v=" + expectedVersion)).text();
check("mobile CSS keeps the identity visible", /\.workspace-user\{display:flex;margin-inline-start:auto/.test(css));
check("identity sheet has dedicated styling", css.includes(".identity-sheet{"));
check("mobile CSS no longer hides workspace-user", !/\.workspace-heading>p,\.workspace-search,\.workspace-user\{display:none\}/.test(css));

const sw = await (await fetch(BASE + "/service-worker.js")).text();
check("service worker cache is bumped", sw.includes("ihsan-academy-pwa-") && sw.includes(expectedVersion));

const loginResponse = await fetch(BASE + "/api/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(ADMIN),
});
const loginData = await loginResponse.json().catch(() => ({}));
const cookies = typeof loginResponse.headers.getSetCookie === "function" ? loginResponse.headers.getSetCookie() : [];
const sessionCookie = cookies.map(cookie => String(cookie).split(";")[0]).filter(Boolean).join("; ");
const csrfToken = (cookies.map(cookie => String(cookie).split(";")[0]).find(cookie => cookie.startsWith("__Host-ihsan_csrf=")) || "").split("=")[1] || "";
check("admin can still log in", loginResponse.ok && sessionCookie.length > 0, JSON.stringify(loginData).slice(0, 200));
check("login returns identity and role", Boolean(loginData?.user?.name) && loginData?.user?.role === "admin", JSON.stringify(loginData?.user || {}).slice(0, 200));

const auth = { cookie: sessionCookie, "x-csrf-token": csrfToken };
const listStart = Date.now();
const list = await (await fetch(BASE + "/api/groups", { headers: auth })).json().catch(() => null);
const listMs = Date.now() - listStart;
check("admin can list groups", Array.isArray(list), JSON.stringify(list).slice(0, 200));

const groupName = "فوج اختبار الهاتف " + Date.now().toString(36).slice(-4);
const createStart = Date.now();
const createdResponse = await fetch(BASE + "/api/groups", {
  method: "POST",
  headers: { ...auth, "content-type": "application/json" },
  body: JSON.stringify({ name: groupName, teacher_id: null }),
});
const createMs = Date.now() - createStart;
const created = await createdResponse.json().catch(() => ({}));
check("group creation succeeds", createdResponse.ok && Boolean(created.id), JSON.stringify(created).slice(0, 200));
check("group creation returns the row the UI needs", Boolean(created.id && created.name && "teacher_id" in created && "active" in created), JSON.stringify(created).slice(0, 200));
check("group creation stays fast (<3000ms)", createMs < 3000, createMs + "ms");

const after = await (await fetch(BASE + "/api/groups", { headers: auth })).json().catch(() => []);
check("created group is readable back", Array.isArray(after) && after.some(group => group.id === created.id));

if (created.id) {
  await fetch(BASE + "/api/groups/" + encodeURIComponent(created.id), { method: "DELETE", headers: auth }).catch(() => {});
}

const failures = checks.filter(item => !item.ok).length;
console.log("TIMING " + JSON.stringify({ listMs, createMs }));
console.log("RESULT " + JSON.stringify({ total: checks.length, passed: checks.length - failures, failures }));
process.exit(failures ? 1 : 0);
