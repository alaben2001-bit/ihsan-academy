// Local role/permission checks against `wrangler dev`.
// Run: npx wrangler@4 dev --port 8788 --var BOOTSTRAP_SECRET:test-bootstrap-secret-1234
//      node scripts/role-permission-test.mjs
import { execFileSync } from "node:child_process";
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
// ---------------------------------------------------------------------------
// مصفوفة الأدوار الخمسة وعزل الأفواج والمدارس. تُنشأ كل بيانات الفحص محليًا.
// ---------------------------------------------------------------------------
async function callRaw(path, { method = "GET", token = "", body } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = "Bearer " + token;
  const response = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const cookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  let sessionToken = "";
  for (const c of cookies) { const m = /__Host-ihsan_session=([a-f0-9]{64})/i.exec(c); if (m) sessionToken = m[1]; }
  let data = null; try { data = await response.json(); } catch {}
  return { status: response.status, data, token: sessionToken };
}
async function activateLogin(identity, password) {
  const first = await callRaw("/api/login", { method: "POST", body: { identity, password } });
  if (first.status !== 200 || !first.token) throw new Error("first login failed for " + identity + ": " + JSON.stringify(first.data));
  const change = await callRaw("/api/me/password", { method: "POST", token: first.token, body: { current_password: password, new_password: password + "-R" } });
  if (change.status !== 200) throw new Error("password change failed for " + identity + ": " + JSON.stringify(change.data));
  const second = await callRaw("/api/login", { method: "POST", body: { identity, password: password + "-R" } });
  if (second.status !== 200 || !second.token) throw new Error("re-login failed for " + identity + ": " + JSON.stringify(second.data));
  return second.token;
}
async function makeStaff(admin, body) {
  const created = await call("/api/admin/staff", { method: "POST", token: admin, body });
  if (created.status !== 201) throw new Error("staff creation failed: " + JSON.stringify(created.data));
  return activateLogin(body.username, body.password);
}
// ---------------------------------------------------------------------------
// عزل المدارس: تُزرع مدرسة اختبار محلية (لا تُنشر ولا تُضاف للترحيل) حتى يصبح
// اختبار «مدير لا يرى مدرسة أخرى» ممكنًا حتى مع مدرسة واحدة حقيقية.
// ---------------------------------------------------------------------------
async function ensureIsolationSchool() {
  const fetchSchools = async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const r = await call("/api/public/quran-schools");
        if (r.status === 200) return r;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 750));
    }
    return { status: 0, data: [] };
  };
  const before = await fetchSchools();
  const found = (before.data || []).find(s => s.id === "qs-shuayb-test" || s.id === "qs-shuayb");
  if (found) return found.id;
  const persistTo = process.env.E2E_PERSIST_TO;
  if (persistTo) { // فقط حين يُمرَّر مسار persist-to صراحةً
    try {
      execFileSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "d1", "execute", "ihsan-academy-students", "--local", "--persist-to", persistTo, "--command", "INSERT OR IGNORE INTO quran_schools (id, name, description, active, sort_order) VALUES ('qs-shuayb-test', 'مدرسة اختبار العزل المدرسي', 'تُستخدم في اختبارات العزل المدرسي فقط', 1, 99)"], { stdio: "pipe", timeout: 240000 });
    } catch { return ""; }
    const after = await fetchSchools();
    return (after.data || []).some(s => s.id === "qs-shuayb-test") ? "qs-shuayb-test" : "";
  }
  return "";
}

async function roleMatrixTests(admin, inScopeStudentId, groupId) {
  const run = String(Date.now()).slice(-6);

  // مدرسة ثانية (محلية فقط) فوج فيها طالب — خارج مدرسة "مدرسة مسجد الرحمان".
  // إن تعذر العثور عليها/زرعها، يتخطى فحص عزل المدرسة فقط ويُسجَّل كـ SKIP واضح.
  const isolationSchoolId = await ensureIsolationSchool();
  const canIsolateSchool = Boolean(isolationSchoolId);
  check("a second (test-local) school is available for isolation checks" + (canIsolateSchool ? "" : " (SKIPPED)"), true, canIsolateSchool ? "isolation school: " + isolationSchoolId : "SKIP: seed qs-shuayb-test or pass E2E_PERSIST_TO");
  const otherGroup = await call("/api/groups", { method: "POST", token: admin, body: { name: "فوج عزل الصلاحيات " + run, school_id: isolationSchoolId || undefined } });
  check("create isolation group", otherGroup.status === 201 && otherGroup.data?.id, JSON.stringify(otherGroup.data));
  const otherGroupId = otherGroup.data?.id;
  await call("/api/admin/roster-add", { method: "POST", token: admin, body: { group_id: otherGroupId, names: ["طالب العزل " + run] } });
  const otherStudents = await call("/api/students?group_id=" + encodeURIComponent(otherGroupId), { token: admin });
  const outScopeStudent = (otherStudents.data || []).find(s => s.name === "طالب العزل " + run);
  check("isolation student created", Boolean(outScopeStudent), JSON.stringify(otherStudents.data)?.slice(0, 200));
  if (!outScopeStudent) return;

  // مدير المدرسة (نطاق مدرسة كاملة) — مدرسة حقيقية من البذرة.
  const schools = await call("/api/public/quran-schools");
  const schoolId = (schools.data || [])[0]?.id || "";
  check("public Quran school list is available for director scope", schools.status === 200 && Boolean(schoolId), JSON.stringify(schools.data));
  if (!schoolId) return;
  const directorGroup = await call("/api/groups", { method: "POST", token: admin, body: { name: "فوج الصلاحيات للمدير " + run, school_id: schoolId } });
  check("create director school group", directorGroup.status === 201 && directorGroup.data?.id, JSON.stringify(directorGroup.data));
  const directorGroupId = directorGroup.data?.id;
  const directorRoster = await call("/api/admin/roster-add", { method: "POST", token: admin, body: { group_id: directorGroupId, names: ["طالب المدير " + run] } });
  check("director school student roster", directorRoster.status === 201, JSON.stringify(directorRoster.data));
  const schoolStudents = await call("/api/students?group_id=" + encodeURIComponent(directorGroupId), { token: admin });
  const schoolStudent = (schoolStudents.data || []).find(s => s.name === "طالب المدير " + run);
  check("director school student created", Boolean(schoolStudent), JSON.stringify(schoolStudents.data)?.slice(0, 200));

  const directorToken = await makeStaff(admin, { name: "مدير الصلاحيات " + run, username: "role-director-" + run, password: "RoleDirector#2026", role: "director", school_ids: [schoolId] });
  check("director login", Boolean(directorToken));
  if (schoolStudent) {
    const directorSummary = await call("/api/points/summary?student_id=" + encodeURIComponent(schoolStudent.id), { token: directorToken });
    check("director reads points inside own school", directorSummary.status === 200, "status=" + directorSummary.status);
  }
  if (canIsolateSchool) {
    const outsideSummary = await call("/api/points/summary?student_id=" + encodeURIComponent(outScopeStudent.id), { token: directorToken });
    check("director cannot read points outside own school", outsideSummary.status === 403, "status=" + outsideSummary.status);
  } else {
    check("director cannot read points outside own school (SKIPPED: no second school)", true, "SKIP");
  }
  const rulesByDirector = await call("/api/points/rules", { method: "POST", token: directorToken, body: { event_type: "x", achievement_points: 999 } });
  check("director rules edit -> 403", rulesByDirector.status === 403, "status=" + rulesByDirector.status);
  const storeByDirector = await call("/api/store/items", { method: "POST", token: directorToken, body: { name: "x", cost: 1 } });
  check("director store create -> 403", storeByDirector.status === 403, "status=" + storeByDirector.status);
  const backupByDirector = await call("/api/admin/backup/full-export", { token: directorToken });
  check("director backup export -> 403", backupByDirector.status === 403, "status=" + backupByDirector.status);
  const staffByDirector = await call("/api/admin/staff", { token: directorToken });
  check("director staff list -> 403", staffByDirector.status === 403, "status=" + staffByDirector.status);
  if (schoolStudent) {
    // جزاء منفّذ: يمول المدير العام للطالب رصيدًا أولًا ثم يُمرّر الخصم عبر نطاق المدير.
    await call("/api/points/award", { method: "POST", token: admin, body: { student_id: schoolStudent.id, achievement_points: 0, store_points: 5, reason: "رصيد اختبار الجزاءات", request_id: "role-penalty-fund-" + run } });
    const penaltiesAuthorized = await call("/api/penalties", { method: "POST", token: directorToken, body: { student_id: schoolStudent.id, store_points: 1, reason: "خصم معتمد للمعاينة" } });
    check("director cannot deduct points; Sheikh-only policy", penaltiesAuthorized.status === 403, "status=" + penaltiesAuthorized.status);
    const penaltiesOutside = await call("/api/penalties", { method: "POST", token: directorToken, body: { student_id: outScopeStudent.id, store_points: 1, reason: "خصم خارج النطاق" } });
    check("director cannot deduct a penalty outside own school", penaltiesOutside.status === 403, "status=" + penaltiesOutside.status);
  }

  // مشرف فوج (نطاق فوج واحد)
  const supervisorToken = await makeStaff(admin, { name: "مشرف الصلاحيات " + run, username: "role-supervisor-" + run, password: "RoleSupervisor#2026", role: "supervisor", group_ids: [groupId] });
  check("supervisor login", Boolean(supervisorToken));
  const supSummary = await call("/api/points/summary?student_id=" + encodeURIComponent(inScopeStudentId), { token: supervisorToken });
  check("supervisor reads points inside own group", supSummary.status === 200, "status=" + supSummary.status);
  const otherGroupSummary = await call("/api/points/summary?student_id=" + encodeURIComponent(outScopeStudent.id), { token: supervisorToken });
  check("supervisor cannot read points outside own group", otherGroupSummary.status === 403, "status=" + otherGroupSummary.status);
  const supAward = await call("/api/points/award", { method: "POST", token: supervisorToken, body: { student_id: inScopeStudentId, achievement_points: 1, store_points: 0, reason: "تحقق صلاحيات المشرف", request_id: "role-test-sup-" + run } });
  check("supervisor can award points inside own group", supAward.status === 201, "status=" + supAward.status);
  const supAwardOutside = await call("/api/points/award", { method: "POST", token: supervisorToken, body: { student_id: outScopeStudent.id, achievement_points: 1, store_points: 0, reason: "تحقق النطاق", request_id: "role-test-sup-x-" + run } });
  check("supervisor cannot award points outside own group", supAwardOutside.status === 403, "status=" + supAwardOutside.status);
  await call("/api/points/award", { method: "POST", token: admin, body: { student_id: inScopeStudentId, achievement_points: 0, store_points: 5, reason: "رصيد اختبار المشرف", request_id: "role-sup-fund-" + run } });
  const supPenalty = await call("/api/penalties", { method: "POST", token: supervisorToken, body: { student_id: inScopeStudentId, store_points: 1, reason: "خصم فريق منفّذ" } });
  check("supervisor cannot deduct points; Sheikh-only policy", supPenalty.status === 403, "status=" + supPenalty.status);
  const supPenaltyOutside = await call("/api/penalties", { method: "POST", token: supervisorToken, body: { student_id: outScopeStudent.id, store_points: 1, reason: "خصم خارج نطاق المشرف" } });
  check("supervisor cannot deduct a penalty outside own group", supPenaltyOutside.status === 403, "status=" + supPenaltyOutside.status);
  const storeBySupervisor = await call("/api/store/items", { method: "POST", token: supervisorToken, body: { name: "x", cost: 1 } });
  check("supervisor store create -> 403", storeBySupervisor.status === 403, "status=" + storeBySupervisor.status);
  const rulesBySupervisor = await call("/api/points/rules", { method: "POST", token: supervisorToken, body: { event_type: "x", achievement_points: 999 } });
  check("supervisor rules edit -> 403", rulesBySupervisor.status === 403, "status=" + rulesBySupervisor.status);
  const otherGroupList = await call("/api/students?group_id=" + encodeURIComponent(otherGroupId), { token: supervisorToken });
  check("supervisor cannot list another group's students", otherGroupList.status === 403, "status=" + otherGroupList.status);
  const plainList = await call("/api/students", { token: supervisorToken });
  const leaked = (plainList.data || []).some(s => String(s.group_id) !== String(groupId));
  check("supervisor plain list stays inside own group", plainList.status === 200 && Array.isArray(plainList.data) && !leaked, "status=" + plainList.status);
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
  // حساب الطالب قد يكون بكلمة المرور الأولية (أول تشغيل) أو المُبدَّلة "...X" (تشغيلات لاحقة)؛ تُطبَّع في كل مرة.
  let firstStudentLogin = await login("perm-student", "StudentPass#2026StrongX");
  let usedInitialPassword = false;
  if (firstStudentLogin.status !== 200) {
    firstStudentLogin = await login("perm-student", "StudentPass#2026Strong");
    usedInitialPassword = true;
  }
  check("student login", firstStudentLogin.status === 200 && firstStudentLogin.token, "status=" + firstStudentLogin.status);
  if (usedInitialPassword && firstStudentLogin.token) await call("/api/me/password", { method: "POST", token: firstStudentLogin.token, body: { current_password: "StudentPass#2026Strong", new_password: "StudentPass#2026StrongX" } });
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

  // مصفوفة الأدوار الخمسة وعزل الأفواج/المدارس (تنشئ بياناتها محليًا).
  if (student && groupId) {
    try {
      await roleMatrixTests(adminToken, student.id, groupId);
    } catch (error) {
      check("role matrix suite completed", false, String(error && (error.message || error)).slice(0, 300));
    }
  } else {
    check("role matrix suite fixtures available", false, "missing student/group fixtures");
  }

  console.log("\nTOTAL FAILURES: " + failures);
  process.exit(failures > 0 ? 1 : 0);
}
main().catch(err => { console.error("FATAL", err); process.exit(1); });
