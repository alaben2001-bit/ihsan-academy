// Local end-to-end checks for the competitions system (0006_competitions).
// Run against `wrangler dev` with a fresh local D1 database:
//   npx wrangler@4 dev --port 8788 --var BOOTSTRAP_SECRET:test-bootstrap-secret-1234
//   node scripts/competitions-test.mjs
// The script is additive: it only writes inside the local .wrangler D1 state,
// reuses the real users/students/groups/points ledger, and never touches
// production. It creates unique accounts per run so repeated runs are safe.

const BASE = process.env.COMPETITIONS_TEST_BASE || "http://127.0.0.1:8788";
const BOOTSTRAP_SECRET = process.env.COMPETITIONS_BOOTSTRAP_SECRET || "test-bootstrap-secret-1234";
const ADMIN = { name: "مدير الاختبار", email: "admin@test.local", password: "TestPassword#2026Strong" };

const results = [];
let failures = 0;
const RUN = Date.now().toString(36).slice(-6);

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  results.push({ name, ok, detail: ok ? "" : String(detail).slice(0, 800) });
  console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : " :: " + String(detail).slice(0, 300)));
}

function academyDate(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Algiers", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const fields = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return fields.year + "-" + fields.month + "-" + fields.day;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(BASE + "/api/health");
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error("local server did not become ready at " + BASE);
}

async function call(path, { method = "GET", token = "", body, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (body !== undefined) requestHeaders["content-type"] = "application/json";
  if (token) requestHeaders.authorization = "Bearer " + token;
  const response = await fetch(BASE + path, { method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  return { status: response.status, data };
}

async function fetchText(path) {
  const response = await fetch(BASE + path);
  const text = await response.text();
  return { status: response.status, text };
}

async function login(identity, password) {
  const response = await fetch(BASE + "/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identity, password }) });
  const data = await response.json().catch(() => ({}));
  const cookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  let token = "";
  for (const cookie of cookies) {
    const match = /__Host-ihsan_session=([a-f0-9]{64})/i.exec(cookie);
    if (match) token = match[1];
  }
  return { status: response.status, data, token };
}

async function activateLogin(identity, password) {
  const first = await login(identity, password);
  if (!first.token) throw new Error("login failed for " + identity + ": " + JSON.stringify(first.data));
  const changed = password + "b";
  const change = await call("/api/me/password", { method: "POST", token: first.token, body: { current_password: password, new_password: changed } });
  if (change.status !== 200) throw new Error("password change failed for " + identity + ": " + JSON.stringify(change.data));
  const second = await login(identity, changed);
  if (!second.token) throw new Error("re-login failed for " + identity + ": " + JSON.stringify(second.data));
  return second.token;
}

async function makeStudent(admin, groupId, name, username, password) {
  const roster = await call("/api/admin/roster-add", { method: "POST", token: admin, body: { group_id: groupId, names: [name] } });
  if (roster.status !== 201) throw new Error("roster add failed: " + JSON.stringify(roster.data));
  const students = await call("/api/students?group_id=" + encodeURIComponent(groupId), { token: admin });
  const student = (students.data || []).find(row => row.name === name);
  if (!student) throw new Error("roster did not return " + name);
  const account = await call("/api/students/" + encodeURIComponent(student.id) + "/account", { method: "POST", token: admin, body: { username, password } });
  if (account.status !== 201) throw new Error("account creation failed: " + JSON.stringify(account.data));
  const token = await activateLogin(username, password);
  return { id: student.id, name, token };
}

async function makeStaff(admin, body) {
  const created = await call("/api/admin/staff", { method: "POST", token: admin, body });
  if (created.status !== 201) throw new Error("staff creation failed: " + JSON.stringify(created.data));
  const token = await activateLogin(body.username, body.password);
  return { id: created.data.id, token };
}

async function makeTeacher(admin, body) {
  const created = await call("/api/teachers", { method: "POST", token: admin, body });
  if (created.status !== 201) throw new Error("teacher creation failed: " + JSON.stringify(created.data));
  const token = await activateLogin(body.username, body.password);
  return { id: created.data.id, token };
}

async function setProfile(admin, studentId, profile) {
  const saved = await call("/api/students/" + encodeURIComponent(studentId) + "/profile", { method: "PATCH", token: admin, body: profile });
  if (saved.status !== 200) throw new Error("profile save failed: " + JSON.stringify(saved.data));
  return saved;
}

async function setStatus(token, competitionId, status) {
  return call("/api/competitions/" + encodeURIComponent(competitionId) + "/status", { method: "POST", token, body: { status } });
}

function findResult(list, registrationId) {
  return (list || []).find(row => row.registration_id === registrationId) || null;
}

async function main() {
  await waitForServer();
  const today = academyDate(0);
  const yesterday = academyDate(-1);

  // -------------------------------------------------------------------------
  // 1) Admin, school, groups, staff scopes and students
  // -------------------------------------------------------------------------
  const bootstrap = await call("/api/admin/bootstrap", { method: "POST", headers: { "x-bootstrap-secret": BOOTSTRAP_SECRET }, body: ADMIN });
  check("admin bootstrap (created or already exists)", [201, 409].includes(bootstrap.status), JSON.stringify(bootstrap.data));
  const adminLogin = await login(ADMIN.email, ADMIN.password);
  check("admin login returns a session token", adminLogin.status === 200 && adminLogin.token.length === 64, JSON.stringify(adminLogin.data));
  const admin = adminLogin.token;

  const schools = await call("/api/public/quran-schools");
  const schoolId = (schools.data || [])[0]?.id || "";
  check("public Quran school list is available", schools.status === 200 && Boolean(schoolId), JSON.stringify(schools.data));

  const groupA = await call("/api/groups", { method: "POST", token: admin, body: { name: "فوج مسابقات أ " + RUN, school_id: schoolId } });
  const groupB = await call("/api/groups", { method: "POST", token: admin, body: { name: "فوج مسابقات ب " + RUN, school_id: schoolId } });
  check("create two test groups in the real Quran school", groupA.status === 201 && groupA.data?.id && groupB.status === 201 && groupB.data?.id, JSON.stringify({ a: groupA.data, b: groupB.data }));
  const groupAId = groupA.data.id;
  const groupBId = groupB.data.id;

  const teacher1 = await makeTeacher(admin, { name: "معلم المسابقات الأول " + RUN, username: "comp-teacher-1-" + RUN, password: "CompTeacher#2026" });
  const teacher2 = await makeTeacher(admin, { name: "معلم المسابقات الثاني " + RUN, username: "comp-teacher-2-" + RUN, password: "CompTeacher#2026" });
  check("create two teacher accounts", teacher1.token.length === 64 && teacher2.token.length === 64);

  const assignTeacher = await call("/api/groups/" + encodeURIComponent(groupAId), { method: "PATCH", token: admin, body: { teacher_id: teacher1.id } });
  check("assign the first teacher to group A", assignTeacher.status === 200, JSON.stringify(assignTeacher.data));

  const director = await makeStaff(admin, { name: "مدير المدرسة " + RUN, username: "comp-director-" + RUN, password: "CompDirector#2026", role: "director", school_ids: [schoolId] });
  const supervisor = await makeStaff(admin, { name: "مشرف الفوج " + RUN, username: "comp-supervisor-" + RUN, password: "CompSupervisor#2026", role: "supervisor", group_ids: [groupBId] });
  check("create director and supervisor scoped accounts", director.token.length === 64 && supervisor.token.length === 64);

  const s1 = await makeStudent(admin, groupAId, "طالب مسابقات أول " + RUN, "comp-student-1-" + RUN, "CompStudent#2026");
  const s2 = await makeStudent(admin, groupAId, "طالب مسابقات ثانٍ " + RUN, "comp-student-2-" + RUN, "CompStudent#2026");
  const s3 = await makeStudent(admin, groupAId, "طالب مسابقات ثالث " + RUN, "comp-student-3-" + RUN, "CompStudent#2026");
  check("create three real student accounts in group A", [s1, s2, s3].every(row => row.token.length === 64));

  await setProfile(admin, s1.id, { age: 15, riwaya: "حفص عن عاصم", memorized_hizb: 20 });
  await setProfile(admin, s2.id, { age: 25, riwaya: "ورش", memorized_hizb: 50 });
  await setProfile(admin, s3.id, { age: 12, riwaya: "", memorized_hizb: "" });
  const profileS1 = await call("/api/students/" + encodeURIComponent(s1.id) + "/profile", { token: admin });
  check("student profile stores age, riwaya and explicit memorized hizb", profileS1.status === 200 && profileS1.data?.age === 15 && profileS1.data?.riwaya === "حفص عن عاصم" && profileS1.data?.memorized_hizb === 20, JSON.stringify(profileS1.data));

  // s1 has an explicit 20-hizb profile but a 60-hizb Quran path: the explicit
  // profile value must win for eligibility. s3 has no explicit hizb and must
  // fall back to the Quran path category.
  const enrollS1 = await call("/api/quran/path", { method: "POST", token: s1.token, body: { hifz_plan: "plan_b", hifz_category: "60", hifz_amount: "5", hifz_unit: "سطر", ward_ahzab: 2, start_date: today } });
  const enrollS3 = await call("/api/quran/path", { method: "POST", token: s3.token, body: { hifz_plan: "plan_b", hifz_category: "30", hifz_amount: "5", hifz_unit: "سطر", ward_ahzab: 2, start_date: today } });
  check("students enroll in the existing Quran path", enrollS1.status === 200 && enrollS3.status === 200, JSON.stringify({ s1: enrollS1.data, s3: enrollS3.data }));

  // Baseline academic records: these must survive the competition flow.
  const attendance = await call("/api/attendance", { method: "POST", token: admin, body: { group_id: groupAId, date: today, items: [{ student_id: s1.id, status: "present" }] } });
  const progress = await call("/api/quran/progress", { method: "POST", token: admin, body: { student_id: s1.id, date: today, activity: "recitation", recitation: "سورة الملك 1-5" } });
  check("baseline attendance and Quran progress save", attendance.status === 200 && progress.status === 201, JSON.stringify({ attendance: attendance.data, progress: progress.data }));
  const baseline = await call("/api/points/summary?student_id=" + encodeURIComponent(s1.id), { token: admin });
  const baselineHistory = await call("/api/points/history?student_id=" + encodeURIComponent(s1.id) + "&limit=50", { token: admin });
  console.log("COMPETITION_BASELINE_HISTORY_DIAGNOSTIC", JSON.stringify(baselineHistory.data));
  check("baseline is represented as one unified balance", baseline.data?.totals?.achievement === 30 && baseline.data?.totals?.store === 30, JSON.stringify(baseline.data?.totals));

  // -------------------------------------------------------------------------
  // 2) Categories and creation validation
  // -------------------------------------------------------------------------
  const categories = await call("/api/competitions/categories", { token: s1.token });
  check("seeded categories include the four hizb buckets", categories.status === 200 && ["hizb15", "hizb30", "hizb45", "hizb60"].every(code => (categories.data || []).some(row => row.code === code)), JSON.stringify(categories.data));

  const baseCompetition = {
    title: "مسابقة الحفظ المقيدة " + RUN,
    description: "اختبار محلي لمسابقة الحفظ",
    kind: "quran_hifz",
    season: "اختبار",
    category_id: "cat-hizb-30",
    registration_starts_at: today,
    registration_ends_at: today,
    starts_at: today,
    ends_at: today,
    min_age: 10,
    max_age: 18,
    riwayat: ["حفص عن عاصم"],
    requires_approval: false,
    rules: "شروط اختبار محلية"
  };

  const noTitle = await call("/api/competitions", { method: "POST", token: admin, body: { ...baseCompetition, title: "" } });
  check("competition without a title is rejected", noTitle.status === 400, JSON.stringify(noTitle.data));
  const badKind = await call("/api/competitions", { method: "POST", token: admin, body: { ...baseCompetition, kind: "quran" } });
  check("unknown competition kind is rejected", badKind.status === 400, JSON.stringify(badKind.data));
  const badDate = await call("/api/competitions", { method: "POST", token: admin, body: { ...baseCompetition, registration_starts_at: "2026-02-29" } });
  check("invalid calendar date is rejected", badDate.status === 400, JSON.stringify(badDate.data));
  const reversedRegistration = await call("/api/competitions", { method: "POST", token: admin, body: { ...baseCompetition, registration_starts_at: today, registration_ends_at: yesterday } });
  check("registration end before start is rejected", reversedRegistration.status === 400, JSON.stringify(reversedRegistration.data));
  const reversedRun = await call("/api/competitions", { method: "POST", token: admin, body: { ...baseCompetition, starts_at: today, ends_at: yesterday } });
  check("competition end before start is rejected", reversedRun.status === 400, JSON.stringify(reversedRun.data));
  const reversedAge = await call("/api/competitions", { method: "POST", token: admin, body: { ...baseCompetition, min_age: 20, max_age: 18 } });
  check("reversed age range is rejected", reversedAge.status === 400, JSON.stringify(reversedAge.data));
  const reversedHizb = await call("/api/competitions", { method: "POST", token: admin, body: { ...baseCompetition, min_hizb: 40, max_hizb: 30 } });
  check("reversed hizb range is rejected", reversedHizb.status === 400, JSON.stringify(reversedHizb.data));
  const emptyCriteria = await call("/api/competitions", { method: "POST", token: admin, body: { ...baseCompetition, judging_criteria: [{ id: "bad", label: "سيئ", max: 0 }] } });
  check("a competition with no usable criterion is rejected", emptyCriteria.status === 400, JSON.stringify(emptyCriteria.data));
  const missingSchool = await call("/api/competitions", { method: "POST", token: admin, body: { ...baseCompetition, school_id: "qs-missing-" + RUN } });
  check("a competition for a missing school is rejected", missingSchool.status === 400, JSON.stringify(missingSchool.data));
  const studentCreate = await call("/api/competitions", { method: "POST", token: s1.token, body: baseCompetition });
  check("students cannot create competitions", studentCreate.status === 403, JSON.stringify(studentCreate.data));
  const teacherCreate = await call("/api/competitions", { method: "POST", token: teacher1.token, body: baseCompetition });
  check("teachers cannot create competitions", teacherCreate.status === 403, JSON.stringify(teacherCreate.data));
  const supervisorCreate = await call("/api/competitions", { method: "POST", token: supervisor.token, body: baseCompetition });
  check("supervisors cannot create competitions", supervisorCreate.status === 403, JSON.stringify(supervisorCreate.data));
  const unauthCreate = await call("/api/competitions", { method: "POST", body: baseCompetition });
  check("unauthenticated competition creation is rejected", unauthCreate.status === 401, JSON.stringify(unauthCreate.data));
  const unauthList = await call("/api/competitions");
  check("unauthenticated competition listing is rejected", unauthList.status === 401, JSON.stringify(unauthList.data));

  // -------------------------------------------------------------------------
  // 3) Competition A: category conditions, eligibility and registration
  // -------------------------------------------------------------------------
  const createdA = await call("/api/competitions", { method: "POST", token: admin, body: baseCompetition });
  const competitionA = createdA.data || {};
  check("admin creates competition A in draft", createdA.status === 201 && competitionA.id && competitionA.status === "draft", JSON.stringify(createdA.data));
  check("category derives the 15-30 hizb range", competitionA.min_hizb === 15 && competitionA.max_hizb === 30, JSON.stringify({ min: competitionA.min_hizb, max: competitionA.max_hizb }));
  check("competition stores its editable riwaya list", Array.isArray(competitionA.riwayat) && competitionA.riwayat.includes("حفص عن عاصم"), JSON.stringify(competitionA.riwayat));
  check("default judging criteria and top-3 awards are editable data", (competitionA.judging_criteria || []).length === 4 && (competitionA.awards || []).length === 3, JSON.stringify({ criteria: competitionA.judging_criteria, awards: competitionA.awards }));

  const skipAnnouncement = await setStatus(admin, competitionA.id, "registration");
  check("the lifecycle cannot skip the announcement stage", skipAnnouncement.status === 409, JSON.stringify(skipAnnouncement.data));
  const announceA = await setStatus(admin, competitionA.id, "announced");
  check("competition A moves to announced", announceA.status === 200 && announceA.data?.status === "announced", JSON.stringify(announceA.data));
  const registerBeforeOpen = await call("/api/competitions/" + encodeURIComponent(competitionA.id) + "/register", { method: "POST", token: s1.token, body: {} });
  check("registration is refused before the registration stage", registerBeforeOpen.status === 409, JSON.stringify(registerBeforeOpen.data));
  const openA = await setStatus(admin, competitionA.id, "registration");
  check("competition A opens registration", openA.status === 200 && openA.data?.status === "registration", JSON.stringify(openA.data));

  const studentListA = await call("/api/competitions", { token: s1.token });
  const listedA = (studentListA.data || []).find(row => row.id === competitionA.id);
  check("student sees the open competition with eligibility", studentListA.status === 200 && listedA?.eligibility?.eligible === true && (listedA?.judging_criteria || []).length === 4, JSON.stringify(listedA));

  const s2RegisterA = await call("/api/competitions/" + encodeURIComponent(competitionA.id) + "/register", { method: "POST", token: s2.token, body: {} });
  const s2Reasons = s2RegisterA.data?.error || "";
  check("age/hizb/riwaya conditions reject an ineligible student", s2RegisterA.status === 409 && s2Reasons.length > 0, JSON.stringify(s2RegisterA.data));
  const s3RegisterA = await call("/api/competitions/" + encodeURIComponent(competitionA.id) + "/register", { method: "POST", token: s3.token, body: {} });
  check("a missing riwaya is reported as an eligibility reason", s3RegisterA.status === 409, JSON.stringify(s3RegisterA.data));
  const teacherRegisterA = await call("/api/competitions/" + encodeURIComponent(competitionA.id) + "/register", { method: "POST", token: teacher1.token, body: {} });
  check("teacher accounts cannot register as students", teacherRegisterA.status === 403, JSON.stringify(teacherRegisterA.data));
  const adminRegisterA = await call("/api/competitions/" + encodeURIComponent(competitionA.id) + "/register", { method: "POST", token: admin, body: {} });
  check("admin accounts cannot register as students", adminRegisterA.status === 403, JSON.stringify(adminRegisterA.data));
  const unauthRegisterA = await call("/api/competitions/" + encodeURIComponent(competitionA.id) + "/register", { method: "POST", body: {} });
  check("unauthenticated registration is rejected", unauthRegisterA.status === 401, JSON.stringify(unauthRegisterA.data));

  const s1RegisterA = await call("/api/competitions/" + encodeURIComponent(competitionA.id) + "/register", { method: "POST", token: s1.token, body: { note: "اختبار التسجيل" } });
  const registrationA = s1RegisterA.data?.registration || {};
  check("eligible student registers and is auto-approved", s1RegisterA.status === 201 && registrationA.status === "approved", JSON.stringify(s1RegisterA.data));
  check("registration snapshots the explicit 20 hizb (not the 60-hizb path)", registrationA.age_at_registration === 15 && registrationA.hizb_at_registration === "20" && registrationA.riwaya === "حفص عن عاصم", JSON.stringify(registrationA));
  const s1RegisterAgainA = await call("/api/competitions/" + encodeURIComponent(competitionA.id) + "/register", { method: "POST", token: s1.token, body: {} });
  check("duplicate registration is rejected", s1RegisterAgainA.status === 409, JSON.stringify(s1RegisterAgainA.data));
  const studentDecisionA = await call("/api/competitions/" + encodeURIComponent(competitionA.id) + "/registrations/" + encodeURIComponent(registrationA.id) + "/decision", { method: "POST", token: s1.token, body: { decision: "approved" } });
  check("students cannot decide their own registration", studentDecisionA.status === 403, JSON.stringify(studentDecisionA.data));
  const teacherDecisionA = await call("/api/competitions/" + encodeURIComponent(competitionA.id) + "/registrations/" + encodeURIComponent(registrationA.id) + "/decision", { method: "POST", token: teacher1.token, body: { decision: "approved", note: "اعتماد المعلم" } });
  check("the group teacher can decide a registration", teacherDecisionA.status === 200 && teacherDecisionA.data?.status === "approved", JSON.stringify(teacherDecisionA.data));
  const teacher2DecisionA = await call("/api/competitions/" + encodeURIComponent(competitionA.id) + "/registrations/" + encodeURIComponent(registrationA.id) + "/decision", { method: "POST", token: teacher2.token, body: { decision: "approved" } });
  check("an unrelated teacher cannot decide a registration", teacher2DecisionA.status === 403, JSON.stringify(teacher2DecisionA.data));
  const supervisorDecisionA = await call("/api/competitions/" + encodeURIComponent(competitionA.id) + "/registrations/" + encodeURIComponent(registrationA.id) + "/decision", { method: "POST", token: supervisor.token, body: { decision: "approved" } });
  check("a supervisor outside the group cannot decide a registration", supervisorDecisionA.status === 403, JSON.stringify(supervisorDecisionA.data));
  const detailA = await call("/api/competitions/" + encodeURIComponent(competitionA.id), { token: s1.token });
  check("student detail shows the live registration and eligibility", detailA.status === 200 && detailA.data?.my_registration?.id === registrationA.id && detailA.data?.eligibility?.eligible === false, JSON.stringify(detailA.data));

  // -------------------------------------------------------------------------
  // 4) Competition B: pending approval, human judging, results and awards
  // -------------------------------------------------------------------------
  const createdB = await call("/api/competitions", { method: "POST", token: admin, body: {
    title: "مسابقة التحكيم المفتوحة " + RUN,
    description: "اختبار التحكيم والنتائج",
    kind: "quran_hifz",
    season: "اختبار",
    registration_starts_at: today,
    registration_ends_at: today,
    starts_at: today,
    ends_at: today,
    requires_approval: true,
    awards: [
      { place: 1, label: "الأول", achievement: 80, store: 40 },
      { place: 2, label: "الثاني", achievement: 40, store: 20 }
    ]
  } });
  const competitionB = createdB.data || {};
  check("admin creates competition B with custom awards", createdB.status === 201 && competitionB.id && competitionB.awards?.[0]?.achievement === 80, JSON.stringify(createdB.data));
  await setStatus(admin, competitionB.id, "announced");
  const openB = await setStatus(admin, competitionB.id, "registration");
  check("competition B opens registration", openB.status === 200, JSON.stringify(openB.data));

  const registerB = async (student, note) => call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/register", { method: "POST", token: student.token, body: { note } });
  const s1RegisterB = await registerB(s1, "اختبار التحكيم");
  const s2RegisterB = await registerB(s2, "اختبار التحكيم");
  const s3RegisterB = await registerB(s3, "اختبار التحكيم");
  const registrationB1 = s1RegisterB.data?.registration || {};
  const registrationB2 = s2RegisterB.data?.registration || {};
  const registrationB3 = s3RegisterB.data?.registration || {};
  check("approval-required registrations start as pending", s1RegisterB.status === 201 && s2RegisterB.status === 201 && s3RegisterB.status === 201 && [registrationB1, registrationB2, registrationB3].every(row => row.status === "pending"), JSON.stringify([registrationB1, registrationB2, registrationB3]));
  const s1DuplicateB = await registerB(s1, "تكرار");
  check("a pending registration blocks a second one", s1DuplicateB.status === 409, JSON.stringify(s1DuplicateB.data));

  const rejectWithoutNote = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/registrations/" + encodeURIComponent(registrationB3.id) + "/decision", { method: "POST", token: teacher1.token, body: { decision: "rejected" } });
  check("rejecting a registration requires a reason", rejectWithoutNote.status === 400, JSON.stringify(rejectWithoutNote.data));
  const rejectS3 = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/registrations/" + encodeURIComponent(registrationB3.id) + "/decision", { method: "POST", token: teacher1.token, body: { decision: "rejected", note: "لا يستوفي شروط التحكيم" } });
  check("the group teacher rejects a registration with a reason", rejectS3.status === 200 && rejectS3.data?.status === "rejected", JSON.stringify(rejectS3.data));
  const approveS1 = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/registrations/" + encodeURIComponent(registrationB1.id) + "/decision", { method: "POST", token: admin, body: { decision: "approved", note: "اعتماد" } });
  const approveS2 = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/registrations/" + encodeURIComponent(registrationB2.id) + "/decision", { method: "POST", token: admin, body: { decision: "approved", note: "اعتماد" } });
  check("admin approves two participants", approveS1.status === 200 && approveS2.status === 200, JSON.stringify({ s1: approveS1.data, s2: approveS2.data }));

  const judgingB = await setStatus(admin, competitionB.id, "judging");
  check("competition B moves to judging after approvals", judgingB.status === 200 && judgingB.data?.status === "judging", JSON.stringify(judgingB.data));
  const scoreS1 = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/registrations/" + encodeURIComponent(registrationB1.id) + "/score", { method: "POST", token: admin, body: { criteria: [{ id: "hifz", score: 45 }, { id: "adau", score: 18 }, { id: "tajweed", score: 13 }, { id: "adab", score: 14 }], note: "تحكيم المدير" } });
  check("human judging normalizes a full rubric to 100", scoreS1.status === 200 && scoreS1.data?.total === 90 && (scoreS1.data?.detail || []).length === 4, JSON.stringify(scoreS1.data));
  const missingCriterion = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/registrations/" + encodeURIComponent(registrationB1.id) + "/score", { method: "POST", token: admin, body: { criteria: [{ id: "hifz", score: 50 }] } });
  check("judging requires every criterion", missingCriterion.status === 400, JSON.stringify(missingCriterion.data));
  const scoreRejected = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/registrations/" + encodeURIComponent(registrationB3.id) + "/score", { method: "POST", token: admin, body: { criteria: [{ id: "hifz", score: 50 }, { id: "adau", score: 20 }, { id: "tajweed", score: 15 }, { id: "adab", score: 15 }] } });
  check("rejected participants cannot be judged", scoreRejected.status === 409, JSON.stringify(scoreRejected.data));
  const scoreS2Teacher = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/registrations/" + encodeURIComponent(registrationB2.id) + "/score", { method: "POST", token: teacher1.token, body: { criteria: [{ id: "hifz", score: 25 }, { id: "adau", score: 10 }, { id: "tajweed", score: 8 }, { id: "adab", score: 7 }], note: "تحكيم المعلم" } });
  check("the group teacher can judge its participant", scoreS2Teacher.status === 200 && scoreS2Teacher.data?.total === 50, JSON.stringify(scoreS2Teacher.data));
  const scoreS2Supervisor = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/registrations/" + encodeURIComponent(registrationB2.id) + "/score", { method: "POST", token: supervisor.token, body: { criteria: [{ id: "hifz", score: 50 }, { id: "adau", score: 20 }, { id: "tajweed", score: 15 }, { id: "adab", score: 15 }] } });
  check("a supervisor outside the group cannot judge", scoreS2Supervisor.status === 403, JSON.stringify(scoreS2Supervisor.data));
  const scoreS2Teacher2Before = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/registrations/" + encodeURIComponent(registrationB2.id) + "/score", { method: "POST", token: teacher2.token, body: { criteria: [{ id: "hifz", score: 5 }, { id: "adau", score: 2 }, { id: "tajweed", score: 2 }, { id: "adab", score: 1 }] } });
  check("an unassigned teacher cannot judge another group", scoreS2Teacher2Before.status === 403, JSON.stringify(scoreS2Teacher2Before.data));
  const addJudge = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/judges", { method: "POST", token: admin, body: { user_id: teacher2.id } });
  check("admin assigns an additional judge", addJudge.status === 200 && addJudge.data?.judge?.id === teacher2.id, JSON.stringify(addJudge.data));
  const scoreS2Teacher2 = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/registrations/" + encodeURIComponent(registrationB2.id) + "/score", { method: "POST", token: teacher2.token, body: { criteria: [{ id: "hifz", score: 5 }, { id: "adau", score: 2 }, { id: "tajweed", score: 2 }, { id: "adab", score: 1 }] } });
  check("an assigned judge can score the participant", scoreS2Teacher2.status === 200 && scoreS2Teacher2.data?.total === 10, JSON.stringify(scoreS2Teacher2.data));
  const removeJudge = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/judges/" + encodeURIComponent(teacher2.id), { method: "DELETE", token: admin });
  check("admin removes the additional judge", removeJudge.status === 200, JSON.stringify(removeJudge.data));
  const scoreS2Teacher2After = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/registrations/" + encodeURIComponent(registrationB2.id) + "/score", { method: "POST", token: teacher2.token, body: { criteria: [{ id: "hifz", score: 5 }, { id: "adau", score: 2 }, { id: "tajweed", score: 2 }, { id: "adab", score: 1 }] } });
  check("a removed judge loses judging access", scoreS2Teacher2After.status === 403, JSON.stringify(scoreS2Teacher2After.data));
  const teacherAddJudge = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/judges", { method: "POST", token: teacher1.token, body: { user_id: teacher1.id } });
  check("teachers cannot assign judges", teacherAddJudge.status === 403, JSON.stringify(teacherAddJudge.data));
  const rescoreS1 = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/registrations/" + encodeURIComponent(registrationB1.id) + "/score", { method: "POST", token: admin, body: { criteria: [{ id: "hifz", score: 45 }, { id: "adau", score: 18 }, { id: "tajweed", score: 13 }, { id: "adab", score: 14 }] } });
  check("re-scoring the same judge upserts one row", rescoreS1.status === 200 && rescoreS1.data?.total === 90, JSON.stringify(rescoreS1.data));
  const registrationsB = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/registrations", { token: admin });
  const registrationB1Row = (registrationsB.data || []).find(row => row.id === registrationB1.id);
  check("registrations list shows one score and the average", registrationB1Row?.scores_count === 1 && Number(registrationB1Row?.average_score) === 90, JSON.stringify(registrationB1Row));
  const lockCriteria = await call("/api/competitions/" + encodeURIComponent(competitionB.id), { method: "PATCH", token: admin, body: { judging_criteria: [{ id: "hifz", label: "الحفظ", max: 100 }] } });
  check("judging criteria are locked after scoring starts", lockCriteria.status === 409, JSON.stringify(lockCriteria.data));
  const editTitleB = await call("/api/competitions/" + encodeURIComponent(competitionB.id), { method: "PATCH", token: admin, body: { title: "مسابقة التحكيم المفتوحة " + RUN + " — معدّلة" } });
  check("other competition fields stay editable", editTitleB.status === 200 && editTitleB.data?.competition?.title.includes("معدّلة"), JSON.stringify(editTitleB.data));

  const generateB = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/results/generate", { method: "POST", token: admin, body: {} });
  const generatedResultsB = generateB.data?.results || [];
  const resultB1 = findResult(generatedResultsB, registrationB1.id);
  const resultB2 = findResult(generatedResultsB, registrationB2.id);
  check("results are generated from the judges' average", generateB.status === 200 && generatedResultsB.length === 2, JSON.stringify(generateB.data));
  check("the higher average is ranked first with its custom award", resultB1?.rank === 1 && Number(resultB1?.final_score) === 90 && Number(resultB1?.award_achievement) === 80 && Number(resultB1?.award_store) === 40, JSON.stringify(resultB1));
  check("the second average is ranked second with its custom award", resultB2?.rank === 2 && Number(resultB2?.final_score) === 30 && Number(resultB2?.award_achievement) === 40 && Number(resultB2?.award_store) === 20, JSON.stringify(resultB2));
  const studentResultsBeforeApprove = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/results", { token: s1.token });
  check("students cannot see results before approval", studentResultsBeforeApprove.status === 200 && studentResultsBeforeApprove.data?.mine === null && (studentResultsBeforeApprove.data?.ranking || []).length === 0, JSON.stringify(studentResultsBeforeApprove.data));

  const approveResultsB = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/results/approve", { method: "POST", token: admin, body: {} });
  check("admin approves results and awards the ranked participants", approveResultsB.status === 200 && approveResultsB.data?.status === "published" && approveResultsB.data?.count === 2 && approveResultsB.data?.awarded === 2, JSON.stringify(approveResultsB.data));
  const approveAgainB = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/results/approve", { method: "POST", token: admin, body: {} });
  check("approved results cannot be awarded twice", approveAgainB.status === 409, JSON.stringify(approveAgainB.data));

  const summaryS1 = await call("/api/points/summary?student_id=" + encodeURIComponent(s1.id), { token: admin });
  const summaryS2 = await call("/api/points/summary?student_id=" + encodeURIComponent(s2.id), { token: admin });
  const summaryS3 = await call("/api/points/summary?student_id=" + encodeURIComponent(s3.id), { token: admin });
  check("competition award adds its configured achievement and store amounts", summaryS1.data?.totals?.achievement === 110 && summaryS1.data?.totals?.store === 70, JSON.stringify(summaryS1.data?.totals));
  check("second place receives only its approved separate award", summaryS2.data?.totals?.achievement === 40 && summaryS2.data?.totals?.store === 20, JSON.stringify(summaryS2.data?.totals));
  check("rejected participation earns no points", summaryS3.data?.totals?.achievement === 0 && summaryS3.data?.totals?.store === 0, JSON.stringify(summaryS3.data?.totals));
  const historyS1 = await call("/api/points/history?student_id=" + encodeURIComponent(s1.id) + "&limit=200", { token: admin });
  const awardEvents = (historyS1.data || []).filter(row => row.event_type === "competition_award");
  check("each competition award appears once in unified point history", awardEvents.length === 1 && awardEvents.every(row => String(row.event_key).includes(competitionB.id) && row.kind==="achievement"), JSON.stringify(awardEvents));

  const studentDetailB = await call("/api/competitions/" + encodeURIComponent(competitionB.id), { token: s1.token });
  check("student sees their published result", studentDetailB.status === 200 && studentDetailB.data?.my_result?.status === "published" && studentDetailB.data?.my_result?.rank === 1, JSON.stringify(studentDetailB.data?.my_result));
  const studentResultsB = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/results", { token: s1.token });
  check("student ranking marks the current student", studentResultsB.status === 200 && studentResultsB.data?.mine?.rank === 1 && studentResultsB.data?.ranking?.[0]?.is_self === true && studentResultsB.data?.ranking?.length === 2, JSON.stringify(studentResultsB.data));
  const studentResultsB2 = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/results", { token: s2.token });
  check("second student sees their own second place", studentResultsB2.status === 200 && studentResultsB2.data?.mine?.rank === 2 && studentResultsB2.data?.ranking?.[1]?.is_self === true, JSON.stringify(studentResultsB2.data));
  const studentResultsB3 = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/results", { token: s3.token });
  check("a rejected student has no published result", studentResultsB3.status === 200 && studentResultsB3.data?.mine === null && (studentResultsB3.data?.ranking || []).length === 2, JSON.stringify(studentResultsB3.data));

  const honorB = await setStatus(admin, competitionB.id, "honored");
  const archiveB = await setStatus(admin, competitionB.id, "archived");
  const reopenArchived = await setStatus(admin, competitionB.id, "results");
  check("the lifecycle reaches honoring then archive and stops there", honorB.status === 200 && archiveB.status === 200 && reopenArchived.status === 409, JSON.stringify({ honor: honorB.data, archive: archiveB.data, reopen: reopenArchived.data }));
  const studentListAfterArchive = await call("/api/competitions", { token: s1.token });
  check("archived competitions disappear from the student list", !(studentListAfterArchive.data || []).some(row => row.id === competitionB.id), JSON.stringify(studentListAfterArchive.data));

  // -------------------------------------------------------------------------
  // 5) Competition C: default awards, capacity limit and idempotent awards
  // -------------------------------------------------------------------------
  const createdC = await call("/api/competitions", { method: "POST", token: admin, body: {
    title: "مسابقة السعة " + RUN,
    description: "اختبار الحد الأقصى والجوائز الافتراضية",
    kind: "quran_hifz",
    season: "اختبار",
    registration_starts_at: today,
    registration_ends_at: today,
    starts_at: today,
    ends_at: today,
    max_participants: 1
  } });
  const competitionC = createdC.data || {};
  check("admin creates competition C with a one-participant cap", createdC.status === 201 && competitionC.max_participants === 1 && (competitionC.awards || []).length === 3, JSON.stringify(createdC.data));
  await setStatus(admin, competitionC.id, "announced");
  await setStatus(admin, competitionC.id, "registration");
  const s1RegisterC = await call("/api/competitions/" + encodeURIComponent(competitionC.id) + "/register", { method: "POST", token: s1.token, body: {} });
  const registrationC1 = s1RegisterC.data?.registration || {};
  check("first student takes the only place", s1RegisterC.status === 201 && registrationC1.status === "approved", JSON.stringify(s1RegisterC.data));
  const s2RegisterC = await call("/api/competitions/" + encodeURIComponent(competitionC.id) + "/register", { method: "POST", token: s2.token, body: {} });
  check("registration stops at the participant cap", s2RegisterC.status === 409, JSON.stringify(s2RegisterC.data));
  const judgingC = await setStatus(admin, competitionC.id, "judging");
  const scoreC = await call("/api/competitions/" + encodeURIComponent(competitionC.id) + "/registrations/" + encodeURIComponent(registrationC1.id) + "/score", { method: "POST", token: admin, body: { criteria: [{ id: "hifz", score: 45 }, { id: "adau", score: 18 }, { id: "tajweed", score: 13 }, { id: "adab", score: 14 }] } });
  check("competition C is judged normally", judgingC.status === 200 && scoreC.status === 200 && scoreC.data?.total === 90, JSON.stringify({ judging: judgingC.data, score: scoreC.data }));
  const generateC = await call("/api/competitions/" + encodeURIComponent(competitionC.id) + "/results/generate", { method: "POST", token: admin, body: {} });
  const resultC1 = (generateC.data?.results || []).find(row => row.registration_id === registrationC1.id);
  check("the default editable award is applied to first place", generateC.status === 200 && Number(resultC1?.award_achievement) === 100 && Number(resultC1?.award_store) === 50, JSON.stringify(resultC1));
  const approveC = await call("/api/competitions/" + encodeURIComponent(competitionC.id) + "/results/approve", { method: "POST", token: admin, body: {} });
  const summaryS1AfterC = await call("/api/points/summary?student_id=" + encodeURIComponent(s1.id), { token: admin });
  check("a second competition awards once to both separate balances", approveC.status === 200 && summaryS1AfterC.data?.totals?.achievement === 210 && summaryS1AfterC.data?.totals?.store === 120, JSON.stringify({ approve: approveC.data, totals: summaryS1AfterC.data?.totals }));
  const historyS1AfterC = await call("/api/points/history?student_id=" + encodeURIComponent(s1.id) + "&limit=200", { token: admin });
  const awardEventsAfterC = (historyS1AfterC.data || []).filter(row => row.event_type === "competition_award");
  check("awards stay one visible history entry per competition, not per retry", awardEventsAfterC.length === 2, JSON.stringify(awardEventsAfterC));

  // -------------------------------------------------------------------------
  // 6) Competition D: hizb fallback from the existing Quran path
  // -------------------------------------------------------------------------
  const createdD = await call("/api/competitions", { method: "POST", token: admin, body: {
    title: "مسابقة حفظ 30 حزبًا " + RUN,
    description: "اختبار الاستحقاق من مسار القرآن",
    kind: "quran_hifz",
    season: "اختبار",
    category_id: "cat-hizb-30",
    registration_starts_at: today,
    registration_ends_at: today,
    starts_at: today,
    ends_at: today
  } });
  const competitionD = createdD.data || {};
  await setStatus(admin, competitionD.id, "announced");
  await setStatus(admin, competitionD.id, "registration");
  const s3RegisterD = await call("/api/competitions/" + encodeURIComponent(competitionD.id) + "/register", { method: "POST", token: s3.token, body: {} });
  check("eligibility falls back to the Quran path hizb when the profile is empty", s3RegisterD.status === 201 && s3RegisterD.data?.registration?.hizb_at_registration === "30", JSON.stringify(s3RegisterD.data));
  const s2RegisterD = await call("/api/competitions/" + encodeURIComponent(competitionD.id) + "/register", { method: "POST", token: s2.token, body: {} });
  check("a 50-hizb student is outside the 15-30 category", s2RegisterD.status === 409, JSON.stringify(s2RegisterD.data));

  // -------------------------------------------------------------------------
  // 7) Director scope and calendar / reference-term administration
  // -------------------------------------------------------------------------
  const directorCreateOwn = await call("/api/competitions", { method: "POST", token: director.token, body: { title: "مسابقة مدير المدرسة " + RUN, kind: "hadith", school_id: schoolId, registration_starts_at: today, registration_ends_at: today } });
  const competitionE = directorCreateOwn.data || {};
  check("a director creates a competition inside their school", directorCreateOwn.status === 201 && competitionE.school_id === schoolId, JSON.stringify(directorCreateOwn.data));
  const directorEditOwn = await call("/api/competitions/" + encodeURIComponent(competitionE.id), { method: "PATCH", token: director.token, body: { title: "مسابقة مدير المدرسة " + RUN + " — معدّلة" } });
  check("a director edits a competition inside their school", directorEditOwn.status === 200, JSON.stringify(directorEditOwn.data));
  const directorCreateOther = await call("/api/competitions", { method: "POST", token: director.token, body: { title: "خارج النطاق " + RUN, kind: "hadith", school_id: "qs-missing-" + RUN } });
  check("a director cannot create for another school", directorCreateOther.status === 403, JSON.stringify(directorCreateOther.data));
  const directorEditA = await call("/api/competitions/" + encodeURIComponent(competitionA.id), { method: "PATCH", token: director.token, body: { title: "محاولة خارج النطاق" } });
  check("a director cannot edit an unscoped competition", directorEditA.status === 403, JSON.stringify(directorEditA.data));
  const directorRegistrationsB = await call("/api/competitions/" + encodeURIComponent(competitionB.id) + "/registrations", { token: director.token });
  check("a director reads registrations of groups in their school", directorRegistrationsB.status === 200 && (directorRegistrationsB.data || []).some(row => row.id === registrationB1.id), JSON.stringify(directorRegistrationsB.data));
  const studentDraftE = await call("/api/competitions/" + encodeURIComponent(competitionE.id), { token: s1.token });
  check("students cannot open a draft competition by id", studentDraftE.status === 404, JSON.stringify(studentDraftE.data));

  const eventCreate = await call("/api/competition-events", { method: "POST", token: admin, body: { competition_id: competitionA.id, title: "فتح التسجيل " + RUN, event_date: today, kind: "registration" } });
  check("admin adds an editable calendar event", eventCreate.status === 201 && eventCreate.data?.id, JSON.stringify(eventCreate.data));
  const eventId = eventCreate.data.id;
  const eventsA = await call("/api/competition-events?competition_id=" + encodeURIComponent(competitionA.id), { token: admin });
  check("calendar returns the event for its competition", eventsA.status === 200 && (eventsA.data || []).some(row => row.id === eventId), JSON.stringify(eventsA.data));
  const eventPatch = await call("/api/competition-events/" + encodeURIComponent(eventId), { method: "PATCH", token: admin, body: { title: "فتح التسجيل المعدّل " + RUN } });
  const eventsAPatched = await call("/api/competition-events?competition_id=" + encodeURIComponent(competitionA.id), { token: admin });
  check("calendar events are editable without code changes", eventPatch.status === 200 && (eventsAPatched.data || []).some(row => row.id === eventId && row.title.includes("المعدّل")), JSON.stringify(eventsAPatched.data));
  const eventTeacher = await call("/api/competition-events", { method: "POST", token: teacher1.token, body: { title: "حدث معلم", event_date: today } });
  check("teachers cannot manage the calendar", eventTeacher.status === 403, JSON.stringify(eventTeacher.data));
  const eventBadDate = await call("/api/competition-events", { method: "POST", token: admin, body: { title: "حدث", event_date: "2026-02-29" } });
  check("calendar rejects an invalid date", eventBadDate.status === 400, JSON.stringify(eventBadDate.data));
  const eventDelete = await call("/api/competition-events/" + encodeURIComponent(eventId), { method: "DELETE", token: admin });
  const eventsAAfterDelete = await call("/api/competition-events?competition_id=" + encodeURIComponent(competitionA.id), { token: admin });
  check("calendar events are soft-deleted", eventDelete.status === 200 && !(eventsAAfterDelete.data || []).some(row => row.id === eventId), JSON.stringify(eventsAAfterDelete.data));
  const studentCalendar = await call("/api/competitions/calendar", { token: s1.token });
  check("student calendar shows derived dates for visible competitions", studentCalendar.status === 200 && (studentCalendar.data || []).some(row => row.competition_id === competitionA.id && row.derived === true), JSON.stringify(studentCalendar.data));

  const termCreate = await call("/api/competition-terms", { method: "POST", token: admin, body: { kind: "quran_hifz", title: "شرط الدورة " + RUN, body: "شروط قابلة للتعديل لكل دورة", source: "اختبار" } });
  check("admin adds an editable reference term", termCreate.status === 201 && termCreate.data?.id, JSON.stringify(termCreate.data));
  const termId = termCreate.data.id;
  const termsList = await call("/api/competition-terms?kind=quran_hifz", { token: admin });
  check("reference terms are filtered by kind", termsList.status === 200 && (termsList.data || []).some(row => row.id === termId), JSON.stringify(termsList.data));
  const termPatch = await call("/api/competition-terms/" + encodeURIComponent(termId), { method: "PATCH", token: admin, body: { body: "شروط معدّلة لدورة جديدة" } });
  const termsPatched = await call("/api/competition-terms?kind=quran_hifz", { token: admin });
  check("reference terms are editable per cycle", termPatch.status === 200 && (termsPatched.data || []).some(row => row.id === termId && row.body.includes("معدّلة")), JSON.stringify(termsPatched.data));
  const termTeacher = await call("/api/competition-terms", { method: "POST", token: teacher1.token, body: { kind: "quran_hifz", title: "شرط معلم", body: "نص" } });
  check("teachers cannot manage reference terms", termTeacher.status === 403, JSON.stringify(termTeacher.data));
  const termBadKind = await call("/api/competition-terms", { method: "POST", token: admin, body: { kind: "quran", title: "شرط", body: "نص" } });
  check("reference terms reject an unknown kind", termBadKind.status === 400, JSON.stringify(termBadKind.data));
  const termDelete = await call("/api/competition-terms/" + encodeURIComponent(termId), { method: "DELETE", token: admin });
  const termsAfterDelete = await call("/api/competition-terms?kind=quran_hifz", { token: admin });
  check("reference terms are soft-deleted", termDelete.status === 200 && !(termsAfterDelete.data || []).some(row => row.id === termId), JSON.stringify(termsAfterDelete.data));

  // -------------------------------------------------------------------------
  // 8) No regression to attendance, Quran records or student rosters
  // -------------------------------------------------------------------------
  const attendanceRead = await call("/api/attendance?group_id=" + encodeURIComponent(groupAId) + "&date=" + encodeURIComponent(today), { token: admin });
  check("attendance still returns the original present record", attendanceRead.status === 200 && (attendanceRead.data || []).some(row => row.student_id === s1.id && row.status === "present"), JSON.stringify(attendanceRead.data));
  const progressRead = await call("/api/quran/progress?student_id=" + encodeURIComponent(s1.id), { token: admin });
  check("Quran progress still returns the original memorization record", progressRead.status === 200 && (progressRead.data || []).some(row => row.student_id === s1.id && row.activity === "recitation" && row.recitation.includes("الملك")), JSON.stringify(progressRead.data));
  const rosterRead = await call("/api/students?group_id=" + encodeURIComponent(groupAId), { token: admin });
  check("the student roster is unchanged", rosterRead.status === 200 && [s1.id, s2.id, s3.id].every(id => (rosterRead.data || []).some(row => row.id === id)), JSON.stringify(rosterRead.data));
  const reSaveAttendance = await call("/api/attendance", { method: "POST", token: admin, body: { group_id: groupAId, date: today, items: [{ student_id: s1.id, status: "present" }] } });
  const summaryAfterReSave = await call("/api/points/summary?student_id=" + encodeURIComponent(s1.id), { token: admin });
  check("re-saving attendance does not double-award after competitions", reSaveAttendance.status === 200 && summaryAfterReSave.data?.totals?.achievement === 210 && summaryAfterReSave.data?.totals?.store === 120, JSON.stringify(summaryAfterReSave.data?.totals));

  // -------------------------------------------------------------------------
  // 9) Mobile/app shell guardrails and final health
  // -------------------------------------------------------------------------
  const indexHtml = await fetchText("/");
  check("the app shell loads with a mobile viewport", indexHtml.status === 200 && indexHtml.text.includes('name="viewport"') && indexHtml.text.includes("app.js"), indexHtml.status);
  const appJs = await fetchText("/app.js");
  check("the shipped app includes the competitions screen and API", appJs.status === 200 && appJs.text.includes("competitionsPage") && appJs.text.includes("/competitions/"), appJs.status);
  const serviceWorker = await fetchText("/service-worker.js");
  check("the service worker is served", serviceWorker.status === 200 && serviceWorker.text.includes("CACHE"), serviceWorker.status);
  const health = await call("/api/health");
  check("the app health endpoint stays healthy", health.status === 200 && health.data?.ok === true, JSON.stringify(health.data));

  const report = { base: BASE, failures, passed: results.filter(row => row.ok).length, total: results.length, results };
  const outputPath = process.env.COMPETITIONS_TEST_REPORT || "";
  if (outputPath) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");
  }
  console.log("RESULT " + JSON.stringify({ failures, passed: report.passed, total: report.total }));
  if (failures) process.exitCode = 1;
}

main().catch(error => {
  console.error("FATAL " + (error && error.stack || error));
  process.exitCode = 1;
});
