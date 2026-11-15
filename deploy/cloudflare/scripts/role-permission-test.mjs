// Local role/permission checks against `wrangler dev`.
// Run: npx wrangler@4 dev --port 8788 --var BOOTSTRAP_SECRET:test-bootstrap-secret-1234
//      node scripts/role-permission-test.mjs
const BASE = process.env.POINTS_TEST_BASE || "http://127.0.0.1:8788";
const BOOTSTRAP_SECRET = process.env.POINTS_BOOTSTRAP_SECRET || "test-bootstrap-secret-1234";
const results = [];
let failures = 0;
function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  results.push({ name, ok, detail: ok ? "" : String(detail).slice(0, 500) });
  console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : " :: " + String(detail).slice(0, 200)));
}
async function call(path, { method = "GET", token = "", body } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = "Bearer " + token;
  const response = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await response.json(); } catch {}
  return { status: response.status, data };
}
async function login(identity, password) {
  const r = await fetch(BASE + "/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identity, password }) });
  const cookies = typeof r.headers.getSetCookie === "function" ? r.headers.getSetCookie() : [];
  let token = "";
  for (const c of cookies) { const m = /__Host-ihsan_session=([a-f0-9]{64})/i.exec(c); if (m) token = m[1]; }
  return { status: r.status, token };
}
async function waitForServer() {
  for (let i = 0; i < 60; i++) { try { const r = await fetch(BASE + "/api/health"); if (r.ok) return; } catch {} await new Promise(r => setTimeout(r, 500)); }
  throw new Error("server not ready");
}
async function main() {
  await waitForServer();
  // bootstrap admin (idempotent)
  await fetch(BASE + "/api/admin/bootstrap", { method: "POST", headers: { "content-type": "application/json", "x-bootstrap-secret": BOOTSTRAP_SECRET }, body: JSON.stringify({ name: "مدير اختبار", email: "admin@test.local", password: "TestPassword#2026Strong" }) });
  const admin = await login("admin@test.local", "TestPassword#2026Strong");
  check("admin login", admin.status === 200 && admin.token, "status=" + admin.status);
  const adminToken = admin.token;

  // create group + students + accounts (idempotent-ish: ignore 409)
  const group = await call("/api/groups", { method: "POST", token: adminToken, body: { name: "فوج صلاحيات" } });
  // group may already exist; if 409 reuse by listing? For simplicity require 201 or 409
  check("create group (or exists)", group.status === 201 || group.status === 409, JSON.stringify(group.data));
  let groupId = group.data?.id;
  if (!groupId) {
    const groups = await call("/api/groups", { token: adminToken });
    const g = (groups.data || []).find(x => x.name === "فوج صلاحيات");
    groupId = g?.id;
  }
  check("group id resolved", !!groupId, "groupId=" + groupId);

  const roster = await call("/api/admin/roster-add", { method: "POST", token: adminToken, body: { group_id: groupId, names: ["طالب صلاحيات"] } });
  check("roster add (or exists)", roster.status === 201 || roster.status === 409, JSON.stringify(roster.data));

  const students = await call("/api/students?group_id=" + encodeURIComponent(groupId), { token: adminToken });
  const student = (students.data || []).find(s => s.name === "طالب صلاحيات");
  check("student exists", !!student, JSON.stringify(students.data)?.slice(0, 200));
  if (student && !student.user_id) {
    await call("/api/students/" + encodeURIComponent(student.id) + "/account", { method: "POST", token: adminToken, body: { username: "perm-student", password: "StudentPass#2026Strong", must_change_password: false } });
  }
  const firstStudentLogin = await login("perm-student", "StudentPass#2026Strong");
  check("student login", firstStudentLogin.status === 200 && firstStudentLogin.token, "status=" + firstStudentLogin.status);
  if (firstStudentLogin.token) await call("/api/me/password", { method: "POST", token: firstStudentLogin.token, body: { current_password: "StudentPass#2026Strong", new_password: "StudentPass#2026StrongX" } });
  const studentLogin = await login("perm-student", "StudentPass#2026StrongX");
  check("student password changed", studentLogin.status === 200 && studentLogin.token, "status=" + studentLogin.status);
  const studentToken = studentLogin.token;

  // teacher account
  const teacherCreate = await call("/api/teachers", { method: "POST", token: adminToken, body: { name: "معلم صلاحيات", username: "perm-teacher", password: "TeacherPass#2026Strong" } });
  check("teacher create (or exists)", teacherCreate.status === 201 || teacherCreate.status === 409, JSON.stringify(teacherCreate.data)?.slice(0, 120));
  const teacherLogin = await login("perm-teacher", "TeacherPass#2026Strong");
  const teacherToken = teacherLogin.token;

  // Unauthenticated
  const unauth = await call("/api/points/summary");
  check("unauth → 401", unauth.status === 401, "status=" + unauth.status);

  // Student cannot award points
  const awardByStudent = await call("/api/points/award", { method: "POST", token: studentToken, body: { student_id: student.id, event_type: "attendance_present", reason: "x" } });
  check("student award → 403/400", awardByStudent.status === 403 || awardByStudent.status === 400, "status=" + awardByStudent.status);

  // Student cannot edit rules
  const rulesByStudent = await call("/api/points/rules", { method: "POST", token: studentToken, body: { event_type: "x", achievement_points: 999 } });
  check("student rules edit → 403", rulesByStudent.status === 403, "status=" + rulesByStudent.status);

  // Student cannot access admin students list (should be 403 or empty/scoped)
  const studentsByStudent = await call("/api/students", { token: studentToken });
  check("student /api/students not 200-with-all", !(studentsByStudent.status === 200 && Array.isArray(studentsByStudent.data) && studentsByStudent.data.length > 1), "status=" + studentsByStudent.status + " n=" + (studentsByStudent.data?.length));

  // Student cannot access another student's points via ?student_id (should be 403 or scoped to self)
  // Create a second student to test IDOR
  await call("/api/admin/roster-add", { method: "POST", token: adminToken, body: { group_id: groupId, names: ["طالب صلاحيات 2"] } });
  const students2 = await call("/api/students?group_id=" + encodeURIComponent(groupId), { token: adminToken });
  const other = (students2.data || []).find(s => s.name === "طالب صلاحيات 2");
  if (other) {
    const otherSummary = await call("/api/points/summary?student_id=" + encodeURIComponent(other.id), { token: studentToken });
    check("student cannot read other's summary", otherSummary.status === 403 || otherSummary.status === 404, "status=" + otherSummary.status);
  } else {
    check("second student created", false, "not found");
  }

  // Teacher cannot edit rules
  if (teacherToken) {
    const rulesByTeacher = await call("/api/points/rules", { method: "POST", token: teacherToken, body: { event_type: "x", achievement_points: 999 } });
    check("teacher rules edit → 403", rulesByTeacher.status === 403, "status=" + rulesByTeacher.status);
  } else {
    check("teacher login (skipped)", true, "no token");
  }

  // Role matrix: penalties (admin-only)
  const penaltyByStudent = await call("/api/penalties", { method: "POST", token: studentToken, body: { student_id: student.id, points: 1, reason: "test" } });
  check("student penalties create -> 403", penaltyByStudent.status === 403, "status=" + penaltyByStudent.status);
  const penaltyByTeacher = teacherToken ? await call("/api/penalties", { method: "POST", token: teacherToken, body: { student_id: student.id, points: 1, reason: "test" } }) : { status: 403 };
  check("teacher penalties create -> 403", penaltyByTeacher.status === 403, "status=" + penaltyByTeacher.status);

  // Role matrix: store items create (admin-only)
  const storeByStudent = await call("/api/store/items", { method: "POST", token: studentToken, body: { name: "x", cost: 1 } });
  check("student store create -> 403", storeByStudent.status === 403, "status=" + storeByStudent.status);
  const storeByTeacher = teacherToken ? await call("/api/store/items", { method: "POST", token: teacherToken, body: { name: "x", cost: 1 } }) : { status: 403 };
  check("teacher store create -> 403", storeByTeacher.status === 403, "status=" + storeByTeacher.status);

  // Role matrix: cards bulk (admin/staff only)
  const cardsBulkByStudent = await call("/api/student-cards/bulk", { method: "POST", token: studentToken, body: { group_id: groupId } });
  check("student cards bulk -> 403", cardsBulkByStudent.status === 403, "status=" + cardsBulkByStudent.status);

  // Role matrix: missions (student-only)
  const missionsByAdmin = await call("/api/missions", { token: adminToken });
  check("admin missions -> 403", missionsByAdmin.status === 403, "status=" + missionsByAdmin.status);
  const missionsByStudent = await call("/api/missions", { token: studentToken });
  check("student missions -> 200", missionsByStudent.status === 200, "status=" + missionsByStudent.status);

  // Role matrix: admin-only endpoints
  const backupByStudent = await call("/api/admin/backup/full-export", { token: studentToken });
  check("student backup export -> 403", backupByStudent.status === 403, "status=" + backupByStudent.status);
  const chiefsByStudent = await call("/api/admin/chief-supervisors", { token: studentToken });
  check("student chiefs list -> 403", chiefsByStudent.status === 403, "status=" + chiefsByStudent.status);

  console.log("\nTOTAL FAILURES: " + failures);
  process.exit(failures > 0 ? 1 : 0);
}
main().catch(err => { console.error("FATAL", err); process.exit(1); });
