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
check("second platform is preview-only", app.includes("const IHSAN_PREVIEW_ONLY=true") && app.includes("function openIhsanTeaser()"));
check("direct second-platform access is blocked", app.includes('if(S.mode==="ihsan"){S.mode="hub";moduleChooser(false);return}'));
check("teacher deactivation is exposed", app.includes("data-delete-teacher=") && app.includes("تعطيل الحساب"));
check("global chief appointment is exposed", app.includes('id="chief-appoint-form"') && app.includes("data-chief-revoke="));
check("duas and adhkar tabs are exposed", app.includes('duas:"الأدعية المأثورة",adhkar:"الأذكار"'));

const css = await (await fetch(BASE + "/style.css?v=" + expectedVersion)).text();
check("mobile CSS keeps the identity visible", /\.workspace-user\{display:flex;margin-inline-start:auto/.test(css));
check("identity sheet has dedicated styling", css.includes(".identity-sheet{"));
check("second platform teaser has styling", css.includes(".ihsan-teaser{"));
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

const suffix = Date.now().toString(36).slice(-6);
const jsonHeaders = { ...auth, "content-type": "application/json" };

// Teacher accounts are deactivated, not hard-deleted.
const teacherUsername = "teacher-test-" + suffix;
const teacherRes = await fetch(BASE + "/api/teachers", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ name: "معلم اختبار " + suffix, username: teacherUsername, password: "TestPassword#2026Strong" }) });
const teacher = await teacherRes.json().catch(() => ({}));
check("admin can create a teacher for the deactivation test", teacherRes.ok && Boolean(teacher.id), JSON.stringify(teacher).slice(0, 200));
const teacherList = await (await fetch(BASE + "/api/teachers", { headers: auth })).json().catch(() => []);
check("created teacher is listed", Array.isArray(teacherList) && teacherList.some(item => item.id === teacher.id));
const teacherDelete = await fetch(BASE + "/api/teachers/" + encodeURIComponent(teacher.id), { method: "DELETE", headers: auth });
check("teacher deactivation succeeds", teacherDelete.ok, teacherDelete.status);
const teacherListAfter = await (await fetch(BASE + "/api/teachers", { headers: auth })).json().catch(() => []);
check("deactivated teacher is hidden from the list", Array.isArray(teacherListAfter) && !teacherListAfter.some(item => item.id === teacher.id));

// Documented duas/adhkar drafts wait for sheikh review.
const seedRes = await fetch(BASE + "/api/admin/content/seed-duas", { method: "POST", headers: jsonHeaders, body: "{}" });
const seed = await seedRes.json().catch(() => ({}));
check("admin can seed duas drafts", seedRes.ok && Number(seed.created) + Number(seed.skipped) > 0, JSON.stringify(seed).slice(0, 200));
for (const kind of ["duas", "adhkar"]) {
  const rows = await (await fetch(BASE + "/api/content?kind=" + kind, { headers: auth })).json().catch(() => []);
  check(kind + " drafts are pending review with sources", Array.isArray(rows) && rows.length > 0 && rows.every(row => row.status === "pending_review" && row.source && row.reference), JSON.stringify(rows.slice(0, 1)).slice(0, 200));
}
const anonChiefs = await fetch(BASE + "/api/admin/chief-supervisors");
check("global chief management is admin-only", [401, 403].includes(anonChiefs.status), anonChiefs.status);

// Global chief appointment reuses a real active student and can be revoked.
if (created.id) {
  const studentUsername = "chief-test-" + suffix;
  const studentRes = await fetch(BASE + "/api/students", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ name: "طالب اختبار كبير المشرفين " + suffix, username: studentUsername, password: "TestPassword#2026Strong", group_id: created.id }) });
  const student = await studentRes.json().catch(() => ({}));
  check("admin can create a student for the global-chief test", studentRes.ok && Boolean(student.id), JSON.stringify(student).slice(0, 200));
  const appointRes = await fetch(BASE + "/api/admin/chief-supervisors", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ student_id: student.id }) });
  const appointed = await appointRes.json().catch(() => ({}));
  check("admin can appoint a global chief", appointRes.ok && Boolean(appointed.chief?.student_id), JSON.stringify(appointed).slice(0, 200));
  const chiefs = await (await fetch(BASE + "/api/admin/chief-supervisors", { headers: auth })).json().catch(() => []);
  check("global chief is listed", Array.isArray(chiefs) && chiefs.some(item => item.student_id === student.id && item.active));
  const chiefLogin = await fetch(BASE + "/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identity: studentUsername, password: "TestPassword#2026Strong" }) });
  const chiefCookies = typeof chiefLogin.headers.getSetCookie === "function" ? chiefLogin.headers.getSetCookie() : [];
  const chiefSession = chiefCookies.map(cookie => String(cookie).split(";")[0]).filter(Boolean).join("; ");
  const chiefCsrf = (chiefCookies.map(cookie => String(cookie).split(";")[0]).find(cookie => cookie.startsWith("__Host-ihsan_csrf=")) || "").split("=")[1] || "";
  check("appointed global chief can log in", chiefLogin.ok && chiefSession.length > 0, chiefLogin.status);
  const chiefPass = await fetch(BASE + "/api/me/password", { method: "POST", headers: { cookie: chiefSession, "x-csrf-token": chiefCsrf, "content-type": "application/json" }, body: JSON.stringify({ current_password: "TestPassword#2026Strong", new_password: "ChiefTest#2026Strong" }) });
  check("global chief clears the temporary password", chiefPass.ok, chiefPass.status);
  const chiefTeams = await (await fetch(BASE + "/api/student-teams", { headers: { cookie: chiefSession, "x-csrf-token": chiefCsrf } })).json().catch(() => ({}));
  check("global chief sees cross-group scope", chiefTeams?.is_global_chief === true && Array.isArray(chiefTeams?.chief_groups) && chiefTeams.chief_groups.length >= 1, JSON.stringify(chiefTeams).slice(0, 200));
  const otherGroup = (Array.isArray(after) ? after.find(group => group.id !== created.id) : null) || created;
  const chiefOtherGroup = await fetch(BASE + "/api/student-teams?group_id=" + encodeURIComponent(otherGroup.id), { headers: { cookie: chiefSession, "x-csrf-token": chiefCsrf } });
  check("global chief can open another group's teams", chiefOtherGroup.ok, chiefOtherGroup.status + " " + otherGroup.id);
  const revokeRes = await fetch(BASE + "/api/admin/chief-supervisors/" + encodeURIComponent(student.id), { method: "DELETE", headers: auth });
  check("admin can revoke a global chief", revokeRes.ok, revokeRes.status);
  const chiefAfterRevoke = await (await fetch(BASE + "/api/student-teams", { headers: { cookie: chiefSession, "x-csrf-token": chiefCsrf } })).json().catch(() => ({}));
  check("revoked chief loses cross-group scope", chiefAfterRevoke?.is_global_chief !== true, JSON.stringify(chiefAfterRevoke).slice(0, 120));
}

if (created.id) {
  await fetch(BASE + "/api/groups/" + encodeURIComponent(created.id), { method: "DELETE", headers: auth }).catch(() => {});
}

const failures = checks.filter(item => !item.ok).length;
console.log("TIMING " + JSON.stringify({ listMs, createMs }));
console.log("RESULT " + JSON.stringify({ total: checks.length, passed: checks.length - failures, failures }));
process.exit(failures ? 1 : 0);
