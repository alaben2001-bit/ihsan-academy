// Local end-to-end checks for the open signup + join-request approval journey (0009_signup_join_requests).
// Run against `wrangler dev` with a fresh local D1 database:
//   node scripts/signup-journey-test.mjs
// Prereq: if the suite was run recently against the same local D1, clear the signup rate-limit bucket first:
//   wrangler d1 execute ihsan-academy-students --local --persist-to <dir> --command "DELETE FROM rate_limits WHERE bucket IN ('signup','join-request')"
// (local miniflare forces cf-connecting-ip=127.0.0.1, so all local signups share one rate-limit bucket; the limiter is intentional.)
// The script is additive: it only writes inside the local .wrangler D1 state.
// It verifies the exact user-facing journey for tomorrow's lesson:
//   signup -> join request stays pending -> authorized staff approves -> student sees their plan/tasks,
//   shaykh sees his students, scans a card (simulated via the card-resolve API path) or picks manually,
//   records attendance / hifz / thabit / ward / points, and the student sees the result and balance.

const BASE = process.env.SIGNUP_TEST_BASE || "http://127.0.0.1:8788";
const BOOTSTRAP_SECRET = process.env.SIGNUP_BOOTSTRAP_SECRET || "test-bootstrap-secret-1234";
const ADMIN = { name: "مدير الاختبار", email: "admin@test.local", password: "TestPassword#2026Strong" };
const SCHOOL = "qs-rahman";
const SCHOOL_OTHER = "qs-shuayb";

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
  for (let attempt = 0; attempt < 90; attempt += 1) {
    try { const response = await fetch(BASE + "/api/health"); if (response.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error("local server did not become ready at " + BASE);
}

async function call(path, { method = "GET", token = "", body, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (body !== undefined) requestHeaders["content-type"] = "application/json";
  if (token) requestHeaders.authorization = "Bearer " + token;
  const response = await fetch(BASE + path, { method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await response.json(); } catch { data = null; }
  return { status: response.status, data, headers: response.headers };
}

const sessionFromResponse = response => {
  const cookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  for (const cookie of cookies) { const match = /__Host-ihsan_session=([a-f0-9]{64})/i.exec(cookie); if (match) return match[1]; }
  return "";
};

async function login(identity, password) {
  const response = await fetch(BASE + "/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identity, password }) });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data, token: sessionFromResponse(response) };
}

const SESSION_IP = "10.71." + Math.floor(Math.random() * 254 + 1) + "." + Math.floor(Math.random() * 254 + 1); // عنوان معزول لكل تشغيل للاختبار المحلي حتى لا يسقط الفحص على محدّد طلبات الإنشاء لعنوان 127.0.0.1 المشترك محليًا.

async function signup(body) {
  const response = await fetch(BASE + "/api/signup", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": SESSION_IP }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data, token: sessionFromResponse(response) };
}

async function main() {
  await waitForServer();
  const today = academyDate(0);

  // ---------- 0) المسؤول الأول (أو الموجود) ----------
  const bootstrap = await call("/api/admin/bootstrap", { method: "POST", headers: { "x-bootstrap-secret": BOOTSTRAP_SECRET }, body: ADMIN });
  check("admin bootstrap (created or already exists)", [201, 409].includes(bootstrap.status), JSON.stringify(bootstrap.data));
  const adminLogin = await login(ADMIN.email, ADMIN.password);
  const admin = adminLogin.token;
  check("admin session works", adminLogin.status === 200 && admin, JSON.stringify(adminLogin.data));

  // ---------- 1) خيارات التسجيل العامة لا تكشف الفوج/الطلاب ----------
  const options = await call("/api/public/signup-options");
  const schoolNames = (options.data?.schools || []).map(s => s.name);
  check("signup options exposes active schools only (no groups/students)", options.status === 200 && Array.isArray(options.data?.schools) && options.data.schools.length >= 1 && !("students" in (options.data || {})) && !("groups" in (options.data || {})), JSON.stringify(options.data));
  console.log("   schools visible: " + schoolNames.join(" | "));

  // ---------- 2) شخص جديد ينشئ حسابًا (طالب) ----------
  const studentEmail = "journey-student-" + RUN + "@test.local";
  const password = "StudentJourney#2026";
  const studentSignup = await signup({ name: "طالب رحلة التسجيل " + RUN, email: studentEmail, password, kind: "student", school_id: SCHOOL, note: "أحفظ عدة أجزاء" });
  check("new person can sign up as a student", studentSignup.status === 201 && studentSignup.data?.user?.role === "student", JSON.stringify(studentSignup.data));
  check("signup response sets a session cookie", studentSignup.token.length === 64, "no session cookie");
  check("new student starts with no group (pending approval)", studentSignup.data?.user?.group_id === null, JSON.stringify(studentSignup.data?.user));
  const studentPendingToken = studentSignup.token;

  // الصلاحيات قبل الاعتماد: لا شيء يذكر
  const meBefore = await call("/api/me", { token: studentPendingToken });
  check("pending student sees own (group-less) profile", meBefore.status === 200 && meBefore.data?.role === "student" && meBefore.data?.group_id === null, JSON.stringify(meBefore.data));
  const pendingQuran = await call("/api/quran/path", { token: studentPendingToken });
  check("pending student blocked from Quran path before approval", pendingQuran.status === 403, JSON.stringify(pendingQuran.data));
  const pendingDaily = await call("/api/quran/daily", { method: "POST", token: studentPendingToken, body: { kind: "ward", amount: 1, unit: "حزب" } });
  check("pending student blocked from logging ward before approval", pendingDaily.status === 403, JSON.stringify(pendingDaily.data));
  const pendingStudents = await call("/api/students", { token: studentPendingToken });
  const pendingOwnRows = Array.isArray(pendingStudents.data) ? pendingStudents.data : [];
  check("pending student cannot list other students (only their own row at most)", pendingStudents.status === 200 && pendingOwnRows.length <= 1 && (!pendingOwnRows.length || pendingOwnRows[0].id === meBefore.data?.student_id), JSON.stringify(pendingStudents.data));

  // طلبي الانضمام يظهر في حسابي
  const myRequests = await call("/api/join/my-requests", { token: studentPendingToken });
  const myRequestsList = Array.isArray(myRequests.data) ? myRequests.data : [];
  const joinReq = myRequestsList.find(r => r.kind === "school_join" && r.status === "pending");
  check("join request visible and pending for the new student", Boolean(joinReq), JSON.stringify(myRequests.data));

  // ---------- 3) التسجيل لا يمنح أدوارًا خاصة ----------
  const badAdmin = await signup({ name: "محتال الدور", email: "evil-admin-" + RUN + "@test.local", password: "Evil#2026xxxx", kind: "admin" });
  check("signup cannot self-grant the admin role", badAdmin.status === 400, JSON.stringify(badAdmin.data));
  const badSupervisor = await signup({ name: "محتال الإشراف", email: "evil-supervisor-" + RUN + "@test.local", password: "Evil#2026xxxx", kind: "supervisor" });
  check("signup cannot self-grant the supervisor role", badSupervisor.status === 400, JSON.stringify(badSupervisor.data));
  const dupSignup = await signup({ name: "مكرر", email: studentEmail, password: "Dup#2026xxxxx", kind: "student" });
  check("duplicate signup email is rejected", dupSignup.status === 409, JSON.stringify(dupSignup.data));
  const weakPassword = await signup({ name: "ضعيف المرور", email: "weak-pass-" + RUN + "@test.local", password: "short", kind: "student" });
  check("weak password rejected", weakPassword.status === 400, JSON.stringify(weakPassword.data));

  // ---------- 4) زائر/محسن ----------
  const visitorEmail = "journey-visitor-" + RUN + "@test.local";
  const visitorSignup = await signup({ name: "محسن رحلة " + RUN, email: visitorEmail, password: "VisitorJourney#2026", kind: "teacher", note: "أريد كفالة طالب" });
  check("contributor account starts as a pending visitor", visitorSignup.status === 201 && visitorSignup.data?.user?.role === "visitor", JSON.stringify(visitorSignup.data));
  const directVisitor = await signup({ name: "زائر مباشر " + RUN, email: "direct-visitor-" + RUN + "@test.local", password: "VisitorJourney#2026", kind: "visitor" });
  check("direct visitor signup is closed and points to Taysir", directVisitor.status === 403 && /التيسير/.test(String(directVisitor.data?.message || "")), JSON.stringify(directVisitor.data));
  const visitorToken = visitorSignup.token;
  const visitorStudents = await call("/api/students", { token: visitorToken });
  check("visitor cannot list students", visitorStudents.status === 403, JSON.stringify(visitorStudents.data));
  const visitorSummary = await call("/api/points/summary?student_id=whatever", { token: visitorToken });
  check("visitor cannot read student points", visitorSummary.status === 403, JSON.stringify(visitorSummary.data));
  const visitorTeachers = await call("/api/teachers", { token: visitorToken });
  check("visitor cannot list teacher accounts", visitorTeachers.status === 403, JSON.stringify(visitorTeachers.data));
  const visitorAward = await call("/api/points/award", { method: "POST", token: visitorToken, body: { student_id: "x", achievement_points: 10, store_points: 10, reason: "self grant attempt" } });
  check("visitor cannot award points", visitorAward.status === 403, JSON.stringify(visitorAward.data));
  const visitorAttendance = await call("/api/attendance", { method: "POST", token: visitorToken, body: { group_id: "x", date: today, items: [] } });
  check("visitor cannot record attendance", visitorAttendance.status === 403, JSON.stringify(visitorAttendance.data));
  const visitorDash = await call("/api/dashboard", { token: visitorToken });
  check("visitor dashboard exposes no student data", visitorDash.status === 200 && Number(visitorDash.data?.students_count || 0) === 0 && Number(visitorDash.data?.groups_count || 0) === 0, JSON.stringify(visitorDash.data));

  // ---------- 5) شيخ/معلم عبر طلب يُعتمد فقط من الإدارة ----------
  const teacherEmail = "journey-teacher-" + RUN + "@test.local";
  const teacherSignup = await signup({ name: "شيخ معلم رحلة " + RUN, email: teacherEmail, password: "TeacherJourney#2026", kind: "teacher", note: "حافظ وخبرة في التحفيظ" });
  check("teacher candidate signs up as visitor + pending request", teacherSignup.status === 201 && teacherSignup.data?.user?.role === "visitor", JSON.stringify(teacherSignup.data));
  const teacherPendingToken = teacherSignup.token;
  const teacherTryScan = await call("/api/join/requests", { token: teacherPendingToken });
  check("pending teacher candidate cannot review join requests yet", teacherTryScan.status === 403, JSON.stringify(teacherTryScan.data));

  // ---------- 6) تحضير مجموعة (فوج) وإسنادها للشيخ المعيّن من الإدارة ----------
  const adminTeacherName = "شيخ معين " + RUN;
  const adminTeacherUsername = "journey-sheikh-" + RUN;
  const createdTeacher = await call("/api/teachers", { method: "POST", token: admin, body: { name: adminTeacherName, username: adminTeacherUsername, password: "SheikhJourney#2026" } });
  check("admin creates the assigned shaykh account", createdTeacher.status === 201, JSON.stringify(createdTeacher.data));
  const assignedTeacherId = createdTeacher.data?.id;
  // حساب الأستاذ المُنشأ يجب تغيير كلمة مروره المؤقتة أولًا
  const sheikhLogin1 = await login(adminTeacherUsername, "SheikhJourney#2026");
  check("assigned shaykh can log in", sheikhLogin1.status === 200, JSON.stringify(sheikhLogin1.data));
  const sheikhPass = await call("/api/me/password", { method: "POST", token: sheikhLogin1.token, body: { current_password: "SheikhJourney#2026", new_password: "SheikhJourney#2026New" } });
  check("assigned shaykh changes temporary password", sheikhPass.status === 200, JSON.stringify(sheikhPass.data));
  const sheikhLogin = await login(adminTeacherUsername, "SheikhJourney#2026New");
  const sheikh = sheikhLogin.token;
  check("assigned shaykh session works after password change", Boolean(sheikh), "");

  const group = await call("/api/groups", { method: "POST", token: admin, body: { name: "فوج رحلة الانضمام " + RUN, school_id: SCHOOL, teacher_id: assignedTeacherId } });
  check("admin creates a group and assigns it to the appointed shaykh", group.status === 201 && group.data?.id, JSON.stringify(group.data));
  const groupId = group.data?.id;

  // ---------- 7) اعتماد الطالب: الشيخ يرى الطلب ويسند الفوج ----------
  const sheikhPending = await call("/api/join/requests?status=pending", { token: sheikh });
  const visibleToSheikh = (Array.isArray(sheikhPending.data)?sheikhPending.data:[]).find(r => r.kind === "school_join" && r.user_email === studentEmail);
  check("assigned shaykh sees the student's pending join request", Boolean(visibleToSheikh), JSON.stringify(sheikhPending.data));

  const approve = await call("/api/join/requests/" + encodeURIComponent(joinReq.id) + "/decision", { method: "POST", token: sheikh, body: { decision: "approved", group_id: groupId, decision_note: "اعتمادك في فوج الرحلة" } });
  check("shaykh approves the student and assigns the group", approve.status === 200 && approve.data?.request?.status === "approved", JSON.stringify(approve.data));

  const studentAfter = await login(studentEmail, password);
  const meAfter = await call("/api/me", { token: studentAfter.token });
  check("approved student now belongs to the group", meAfter.status === 200 && meAfter.data?.group_id === groupId, JSON.stringify(meAfter.data));

  // ---------- 8) الطالب يبدأ مساره القرآني ويرى خطته ----------
  const enroll = await call("/api/quran/path", { method: "POST", token: studentAfter.token, body: { hifz_plan: "plan_b", hifz_category: "30", hifz_amount: "5", hifz_unit: "سطر", ward_ahzab: 2, rest_day: 5, start_date: today } });
  check("approved student enrolls in the Quran path", enroll.status === 200 && enroll.data?.path?.hifz_plan === "plan_b", JSON.stringify(enroll.data));
  check("category 30 derives quarter-hizb thabit", enroll.data?.path?.thabit_amount === 0.25, JSON.stringify(enroll.data?.path));
  const pathRead = await call("/api/quran/path", { token: studentAfter.token });
  check("student sees his approved plan (hifz/thabit/ward separated)", pathRead.status === 200 && pathRead.data?.enrolled === true && pathRead.data?.path?.ward_ahzab === 2, JSON.stringify(pathRead.data));

  // ---------- 9) الشيخ يرى الطالب، يمسح بطاقته (مسار الـ API نفسه) أو يختاره يدويًا ----------
  const students = await call("/api/students?group_id=" + encodeURIComponent(groupId), { token: sheikh });
  const studentRow = (Array.isArray(students.data)?students.data:[]).find(r => r.name && r.name.includes("طالب رحلة التسجيل"));
  check("shaykh sees his students after approval", Boolean(studentRow), JSON.stringify(students.data));

  const card = await call("/api/student-cards", { method: "POST", token: sheikh, body: { student_id: studentRow.id } });
  const addPointsLink = card.data?.links?.add_points || "";
  const scanMatch = addPointsLink.match(/scan=([^#\s]+)/);
  const scanParts = scanMatch ? scanMatch[1].split(".") : [];
  check("shaykh can issue the student card with scan links", card.status < 300 && scanParts.length >= 3, JSON.stringify(card.data));
  const resolve = scanParts.length >= 3 ? await call("/api/cards/resolve", { method: "POST", token: admin, body: { kind: scanParts[0], card_id: scanParts[1], secret: scanParts.slice(2).join(".") } }) : { status: 0, data: null };
  check("scanned card resolves to the correct student (scan API path)", resolve.status === 200 && resolve.data?.student?.id === studentRow.id, JSON.stringify(resolve.data));
  const badResolve = scanParts.length >= 3 ? await call("/api/cards/resolve", { method: "POST", token: sheikh, body: { kind: scanParts[0], card_id: scanParts[1], secret: "deadbeef" + scanParts.slice(2).join(".").slice(8) } }) : { status: 0 };
  check("tampered card secret is rejected", badResolve.status >= 400, "");

  // ---------- 10) الشيخ يسجل الحضور والحفظ والنقاط ----------
  const attendance = await call("/api/attendance", { method: "POST", token: sheikh, body: { group_id: groupId, date: today, items: [{ student_id: studentRow.id, status: "present" }] } });
  check("shaykh records attendance (present)", [200, 201].includes(attendance.status), JSON.stringify(attendance.data));

  const hifz = await call("/api/quran/daily", { method: "POST", token: sheikh, body: { student_id: studentRow.id, kind: "hifz", amount: 1, unit: "صفحة" } });
  check("shaykh logs hifz from the scan panel API", hifz.status === 201, JSON.stringify(hifz.data));
  const thabit = await call("/api/quran/daily", { method: "POST", token: sheikh, body: { student_id: studentRow.id, kind: "thabit", amount: 0.25, unit: "ربع حزب", repetitions: 15 } });
  check("shaykh logs thabit (quarter-hizb, 15 repetitions)", thabit.status === 201, JSON.stringify(thabit.data));
  const ward = await call("/api/quran/daily", { method: "POST", token: sheikh, body: { student_id: studentRow.id, kind: "ward", amount: 2, unit: "حزبان" } });
  check("shaykh logs the daily ward (independent)", ward.status === 201, JSON.stringify(ward.data));

  // نقاط النشاط: التكرار في نفس اليوم يُمنع تلقائيًا
  const activity1 = await call("/api/points/activity", { method: "POST", token: admin, body: { student_id: studentRow.id, activity: "attendance", date: today } });
  const activity2 = await call("/api/points/activity", { method: "POST", token: admin, body: { student_id: studentRow.id, activity: "attendance", date: today } });
  const awardsOf = r => (r.data?.awards || []).map(a => a.status);
  check("activity points awarded once per day (second call is duplicate/capped)", [201].includes(activity1.status) && awardsOf(activity2).every(s => s !== "awarded"), JSON.stringify({ first: activity1.data, second: activity2.data }));

  // منع نقاط غير مستحقة: طالب لا يستطيع منح نفسه نقاطًا
  const selfAward = await call("/api/points/award", { method: "POST", token: studentAfter.token, body: { student_id: studentRow.id, achievement_points: 100, store_points: 100, reason: "منح ذاتي" } });
  check("student cannot award himself points", selfAward.status === 403, JSON.stringify(selfAward.data));

  // ---------- 11) الطالب يرى رصيده وسجل عملياته ----------
  const summary = await call("/api/points/summary", { token: studentAfter.token });
  const achievement = Number(summary.data?.totals?.achievement || 0);
  const store = Number(summary.data?.totals?.store || 0);
  check("student sees achievement and store balances (tracked separately)", summary.status === 200 && Number.isFinite(achievement) && Number.isFinite(store) && achievement >= 0 && store >= 0, JSON.stringify(summary.data));
  check("student earned attendance/hifz points today", achievement > 0, "achievement=" + achievement);
  const history = await call("/api/points/history?limit=10", { token: studentAfter.token });
  const historyRows = Array.isArray(history.data) ? history.data : (history.data?.events || history.data?.items || []);
  check("student sees today's point events with reasons", history.status === 200 && historyRows.length > 0, JSON.stringify(history.data).slice(0, 400));

  // ---------- 12) عزل المدارس/الأفواج ----------
  const otherEmail = "other-school-student-" + RUN + "@test.local";
  const otherSignup = await signup({ name: "طالب المدرسة الأخرى " + RUN, email: otherEmail, password: "OtherSchool#2026", kind: "student", school_id: SCHOOL_OTHER });
  check("second-school student can sign up", otherSignup.status === 201, JSON.stringify(otherSignup.data));
  // الرقم السري للطلب الآخر: يظهر في حسابه
  const otherRequests = await call("/api/join/my-requests", { token: otherSignup.token });
  const otherRequestsList = Array.isArray(otherRequests.data) ? otherRequests.data : [];
  const otherReq = otherRequestsList.find(r => r.status === "pending");
  check("other-school student has a pending request", Boolean(otherReq), JSON.stringify(otherRequests.data));
  // شيخ qs-rahman لا يرى طلب طالب qs-shuayb
  const sheikhScope = await call("/api/join/requests?status=pending", { token: sheikh });
  const shuaybVisible = (Array.isArray(sheikhScope.data)?sheikhScope.data:[]).find(r => r.user_email === otherEmail);
  check("shaykh of one school cannot see/approve the other school's request", !shuaybVisible, JSON.stringify(sheikhScope.data));
  const crossDecisions = otherReq ? await call("/api/join/requests/" + encodeURIComponent(otherReq.id) + "/decision", { method: "POST", token: sheikh, body: { decision: "approved", group_id: groupId } }) : { status: 0 };
  check("shaykh cannot approve another school's join request", crossDecisions.status === 403, JSON.stringify(crossDecisions.data));

  // الشيخ نفسه لا يستطيع تجاوز نطاقه لطلبات المعلمين
  const sheikhOnTeacherRequest = await call("/api/join/requests?status=pending", { token: sheikh });
  check("teacher cannot view pending teacher requests", !(Array.isArray(sheikhOnTeacherRequest.data) ? sheikhOnTeacherRequest.data : []).some(r => r.kind === "teacher_request"), JSON.stringify(sheikhOnTeacherRequest.data));

  // ---------- 13) الإدارة تعتمد طلب الشيخ/المعلم وتتحول صلاحيته ----------
  const teacherRequests = await call("/api/join/requests?status=pending", { token: admin });
  const tReq = (Array.isArray(teacherRequests.data)?teacherRequests.data:[]).find(r => r.kind === "teacher_request" && r.user_email === teacherEmail);
  check("admin sees the teacher candidate's request", Boolean(tReq), JSON.stringify(teacherRequests.data));
  const approveTeacher = tReq ? await call("/api/join/requests/" + encodeURIComponent(tReq.id) + "/decision", { method: "POST", token: admin, body: { decision: "approved", decision_note: "تم التحقق من الأهلية" } }) : { status: 0 };
  check("admin approves the shaykh/teacher request", approveTeacher.status === 200, JSON.stringify(approveTeacher.data));
  const teacherAfter = await call("/api/me", { token: teacherPendingToken });
  // يحتاج تسجيل دخول جديد ليحمل الدور الجديد
  const teacherRelogin = await login(teacherEmail, "TeacherJourney#2026");
  const teacherFinal = await call("/api/me", { token: teacherRelogin.token });
  check("approved shaykh candidate now has the teacher role", teacherFinal.data?.role === "teacher", JSON.stringify(teacherFinal.data));

  // ---------- 14) محسن يطلب الانضمام كطالب ثم يُعتمد ----------
  const visitorReq = await call("/api/join/requests", { method: "POST", token: visitorToken, body: { kind: "school_join", school_id: SCHOOL, note: "أريد التعلم معكم" } });
  check("visitor can request student membership", visitorReq.status === 201, JSON.stringify(visitorReq.data));
  const visitorReq2 = await call("/api/join/requests", { method: "POST", token: visitorToken, body: { kind: "school_join", school_id: SCHOOL } });
  check("duplicate pending school join is blocked", visitorReq2.status === 409, JSON.stringify(visitorReq2.data));
  const visitorReqId = visitorReq.data?.request?.id;
  const visitorApprove = visitorReqId ? await call("/api/join/requests/" + encodeURIComponent(visitorReqId) + "/decision", { method: "POST", token: sheikh, body: { decision: "approved", group_id: groupId } }) : { status: 0 };
  check("shaykh approves the contributor as a student in the group", visitorApprove.status === 200, JSON.stringify(visitorApprove.data));
  const visitorRelogin = await login(visitorEmail, "VisitorJourney#2026");
  const visitorFinal = await call("/api/me", { token: visitorRelogin.token });
  check("contributor is now a student in the group", visitorFinal.data?.role === "student" && visitorFinal.data?.group_id === groupId, JSON.stringify(visitorFinal.data));

  // ---------- 15) تسجيل خروج / حماية الجلسات ----------
  const logoutStudent = await call("/api/logout", { method: "POST", token: studentAfter.token, body: {} });
  check("student can log out", logoutStudent.status === 200, JSON.stringify(logoutStudent.data));
  const afterLogout = await call("/api/me", { token: studentAfter.token });
  check("logged-out session no longer authenticates", afterLogout.status === 401, JSON.stringify(afterLogout.data));

  console.log("\n" + results.length + " checks · " + (results.length - failures) + " passed · " + failures + " failed");
  process.exit(failures ? 1 : 0);
}

main().catch(error => { console.error("TEST HARNESS ERROR:", error && (error.stack || error.message || error)); process.exit(1); });
