// Local end-to-end checks for the learning economy (points + store).
// Run against `wrangler dev` with a fresh local D1 database:
//   npx wrangler@4 dev --port 8788 --var BOOTSTRAP_SECRET:test-bootstrap-secret-1234
//   node scripts/points-local-test.mjs
// The script is additive: it creates a test admin, group, students and store
// items only inside the local .wrangler D1 state, never production.

const BASE = process.env.POINTS_TEST_BASE || "http://127.0.0.1:8788";
const BOOTSTRAP_SECRET = process.env.POINTS_BOOTSTRAP_SECRET || "test-bootstrap-secret-1234";
const ADMIN = { name: "مدير الاختبار", email: "admin@test.local", password: "TestPassword#2026Strong" };

const results = [];
let failures = 0;

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

async function main() {
  await waitForServer();

  // -------------------------------------------------------------------------
  // 1) Admin bootstrap + authentication
  // -------------------------------------------------------------------------
  const bootstrap = await call("/api/admin/bootstrap", { method: "POST", headers: { "x-bootstrap-secret": BOOTSTRAP_SECRET }, body: ADMIN });
  check("admin bootstrap (created or already exists)", [201, 409].includes(bootstrap.status), JSON.stringify(bootstrap.data));

  const adminLogin = await login(ADMIN.email, ADMIN.password);
  check("admin login returns a session token", adminLogin.status === 200 && adminLogin.token.length === 64, JSON.stringify(adminLogin.data));
  const admin = adminLogin.token;

  // -------------------------------------------------------------------------
  // 2) Group + roster + student account
  // -------------------------------------------------------------------------
  const group = await call("/api/groups", { method: "POST", token: admin, body: { name: "فوج اختبار الاقتصاد" } });
  check("create test group", group.status === 201 && group.data?.id, JSON.stringify(group.data));
  const groupId = group.data.id;

  const roster = await call("/api/admin/roster-add", { method: "POST", token: admin, body: { group_id: groupId, names: ["طالب الاختبار الأول", "طالب الاختبار الثاني"] } });
  check("add two roster students", roster.status === 201 && roster.data?.created === 2, JSON.stringify(roster.data));

  const students = await call("/api/students?group_id=" + encodeURIComponent(groupId), { token: admin });
  const student = (students.data || []).find(row => row.name === "طالب الاختبار الأول");
  const otherStudent = (students.data || []).find(row => row.name === "طالب الاختبار الثاني");
  check("roster returns both students", students.status === 200 && Boolean(student && otherStudent), JSON.stringify(students.data));

  const account = await call("/api/students/" + encodeURIComponent(student.id) + "/account", { method: "POST", token: admin, body: { username: "points-student-1", password: "StudentPass#2026" } });
  check("create login for first student", account.status === 201, JSON.stringify(account.data));

  const studentLogin = await login("points-student-1", "StudentPass#2026");
  check("student login returns a token", studentLogin.status === 200 && studentLogin.token.length === 64, JSON.stringify(studentLogin.data));
  let studentToken = studentLogin.token;
  const passwordChange = await call("/api/me/password", { method: "POST", token: studentToken, body: { current_password: "StudentPass#2026", new_password: "StudentPass#2026b" } });
  check("student clears must-change-password gate", passwordChange.status === 200, JSON.stringify(passwordChange.data));
  studentToken = (await login("points-student-1", "StudentPass#2026b")).token;

  // -------------------------------------------------------------------------
  // 3) Manual awards: reason required, idempotent request id
  // -------------------------------------------------------------------------
  const noReason = await call("/api/points/award", { method: "POST", token: admin, body: { student_id: student.id, achievement_points: 5, store_points: 5 } });
  check("manual award without reason is rejected", noReason.status === 400, JSON.stringify(noReason.data));

  const missingRequestId = await call("/api/points/award", { method: "POST", token: admin, body: { student_id: student.id, points: 5, reason: "اختبار بلا معرّف" } });
  check("manual award without request_id is rejected", missingRequestId.status === 400, JSON.stringify(missingRequestId.data));

  const awardBody = { student_id: student.id, achievement_points: 30, store_points: 30, reason: "اختبار المنح اليدوي", request_id: "test-award-001" };
  const award1 = await call("/api/points/award", { method: "POST", token: admin, body: awardBody });
  check("manual award succeeds", award1.status === 201 && award1.data?.totals?.achievement === 30 && award1.data?.totals?.store === 30, JSON.stringify(award1.data));

  const award2 = await call("/api/points/award", { method: "POST", token: admin, body: awardBody });
  const duplicateEvents = (award2.data?.events || []).every(event => event.status === "duplicate");
  check("repeated request_id does not double-award", award2.status === 201 && duplicateEvents && award2.data?.totals?.achievement === 30 && award2.data?.totals?.store === 30, JSON.stringify(award2.data));

  const summaryAfterAward = await call("/api/points/summary?student_id=" + encodeURIComponent(student.id), { token: admin });
  check("summary reports separate achievement and store balances", summaryAfterAward.data?.totals?.achievement === 30 && summaryAfterAward.data?.totals?.store === 30 && summaryAfterAward.data?.totals?.balance === 30 && summaryAfterAward.data?.totals?.mode === "separate", JSON.stringify(summaryAfterAward.data?.totals));

  // -------------------------------------------------------------------------
  // 4) Store item, student redemption, rejection refunds balance
  // -------------------------------------------------------------------------
  const item = await call("/api/store/items", { method: "POST", token: admin, body: { name: "جائزة اختبار النقاط", description: "عنصر تجريبي", cost: 10, stock: 2, max_per_student: 1, active: 1 } });
  check("create store item", item.status === 201 && item.data?.item?.cost === 10, JSON.stringify(item.data));
  const itemId = item.data.item.id;

  const studentStore = await call("/api/store/items", { token: studentToken });
  check("student sees store balance 30", studentStore.status === 200 && studentStore.data?.balance === 30, JSON.stringify(studentStore.data?.balance));

  const redeem1 = await call("/api/store/redeem", { method: "POST", token: studentToken, body: { item_id: itemId } });
  check("student redeem debits balance to 20", redeem1.status === 201 && redeem1.data?.balance === 20, JSON.stringify(redeem1.data));
  const redemptionId = redeem1.data?.redemption?.id;

  const redeem2 = await call("/api/store/redeem", { method: "POST", token: studentToken, body: { item_id: itemId } });
  check("second redemption respects per-student limit", redeem2.status === 409, JSON.stringify(redeem2.data));

  const pending = await call("/api/store/redemptions?status=pending", { token: admin });
  check("admin sees pending redemption", pending.status === 200 && (pending.data || []).some(row => row.id === redemptionId), JSON.stringify(pending.data));

  const reject = await call("/api/store/redemptions/" + encodeURIComponent(redemptionId) + "/decision", { method: "POST", token: admin, body: { decision: "rejected", note: "اختبار الرفض" } });
  check("rejecting a redemption refunds the store balance", reject.status === 200 && reject.data?.totals?.store === 30, JSON.stringify(reject.data));

  const rejectNoNote = await call("/api/store/redemptions/" + encodeURIComponent(redemptionId) + "/decision", { method: "POST", token: admin, body: { decision: "rejected" } });
  check("rejected redemption is final", rejectNoNote.status === 409, JSON.stringify(rejectNoNote.data));

  // -------------------------------------------------------------------------
  // 5) Automatic awards: attendance (idempotent) + Quran + assignment
  // -------------------------------------------------------------------------
  const today = academyDate(0);
  const attendanceBody = { group_id: groupId, date: today, items: [{ student_id: student.id, status: "present" }] };
  const futureAttendance = await call("/api/attendance", { method: "POST", token: admin, body: { ...attendanceBody, date: academyDate(1) } });
  check("future attendance date is rejected", futureAttendance.status === 400, JSON.stringify(futureAttendance.data));
  const attendance1 = await call("/api/attendance", { method: "POST", token: admin, body: attendanceBody });
  check("attendance save succeeds", attendance1.status === 200, JSON.stringify(attendance1.data));
  const afterAttendance = await call("/api/points/summary?student_id=" + encodeURIComponent(student.id), { token: admin });
  check("present attendance adds 30 points automatically", afterAttendance.data?.totals?.achievement === 60 && afterAttendance.data?.totals?.store === 60, JSON.stringify(afterAttendance.data?.totals));

  const attendance2 = await call("/api/attendance", { method: "POST", token: admin, body: attendanceBody });
  const afterAttendance2 = await call("/api/points/summary?student_id=" + encodeURIComponent(student.id), { token: admin });
  check("re-saving attendance does not duplicate the 30-point award", attendance2.status === 200 && afterAttendance2.data?.totals?.achievement === 60 && afterAttendance2.data?.totals?.store === 60, JSON.stringify(afterAttendance2.data?.totals));
  const attendanceHistory = await call("/api/points/history?student_id=" + encodeURIComponent(student.id) + "&limit=100", { token: admin });
  const attendanceEvent = (attendanceHistory.data || []).find(event => event.event_type === "attendance_present" && event.kind === "achievement");
  const undoAttendanceTest = attendanceEvent ? await call("/api/points/events/" + encodeURIComponent(attendanceEvent.id) + "/reverse", { method: "POST", token: admin, body: { reason: "إعادة تهيئة رصيد اختبار الحضور" } }) : { status: 404 };
  check("attendance test award can be reversed without deleting its record", undoAttendanceTest.status === 200 && undoAttendanceTest.data?.totals?.balance === 30, JSON.stringify(undoAttendanceTest.data));

  const quran = await call("/api/quran/progress", { method: "POST", token: admin, body: { student_id: student.id, date: today, activity: "memorization", memorized: "سورة الملك 1-5" } });
  check("Quran progress save succeeds", quran.status === 201, JSON.stringify(quran.data));
  const afterQuran = await call("/api/points/summary?student_id=" + encodeURIComponent(student.id), { token: admin });
  check("generic Quran progress does not award points without a named approved activity", afterQuran.data?.totals?.achievement === 30 && afterQuran.data?.totals?.store === 30, JSON.stringify(afterQuran.data?.totals));

  const assignment = await call("/api/assignments", { method: "POST", token: admin, body: { title: "واجب اختبار النقاط", description: "أجب بإيجاز", group_id: groupId, points_total: 100 } });
  check("create assignment", assignment.status === 201 && assignment.data?.id, JSON.stringify(assignment.data));
  const assignmentId = assignment.data.id;

  const submit = await call("/api/assignment-submit?id=" + encodeURIComponent(assignmentId), { method: "POST", token: studentToken, body: { response_text: "إجابة اختبار النقاط" } });
  check("student submits assignment", submit.status === 201, JSON.stringify(submit.data));

  const review = await call("/api/assignment-review", { method: "POST", token: admin, body: { assignment_id: assignmentId, student_id: student.id, grade: 90, feedback: "إتقان" } });
  check("assignment review succeeds", review.status === 200, JSON.stringify(review.data));
  const afterReview = await call("/api/points/summary?student_id=" + encodeURIComponent(student.id), { token: admin });
  check("excellent assignment adds its configured 20 achievement and 10 store points", afterReview.data?.totals?.achievement === 50 && afterReview.data?.totals?.store === 40, JSON.stringify(afterReview.data?.totals));

  // -------------------------------------------------------------------------
  // 6) Rule editing is honoured by later automatic awards
  // -------------------------------------------------------------------------
  const rules = await call("/api/points/rules", { token: admin });
  const attendanceRule = (rules.data || []).find(rule => rule.event_type === "attendance_present");
  check("attendance rule is seeded", rules.status === 200 && Boolean(attendanceRule), JSON.stringify(rules.data));

  const ruleUpdate = await call("/api/points/rules", { method: "POST", token: admin, body: { id: attendanceRule.id, event_type: "attendance_present", name: attendanceRule.name, description: attendanceRule.description, achievement_points: 5, store_points: 4, max_per_day: 1, auto_award: 1, active: 1, sort_order: attendanceRule.sort_order } });
  check("admin updates attendance rule store points", ruleUpdate.status === 200 && ruleUpdate.data?.rule?.store_points === 4, JSON.stringify(ruleUpdate.data));

  const yesterday = academyDate(-1);
  const attendance3 = await call("/api/attendance", { method: "POST", token: admin, body: { group_id: groupId, date: yesterday, items: [{ student_id: student.id, status: "present" }] } });
  const afterRuleChange = await call("/api/points/summary?student_id=" + encodeURIComponent(student.id), { token: admin });
  check("updated rule applies separate 5 achievement and 4 store points", attendance3.status === 200 && afterRuleChange.data?.totals?.achievement === 55 && afterRuleChange.data?.totals?.store === 44 && afterRuleChange.data?.totals?.balance === 44, JSON.stringify(afterRuleChange.data?.totals));

  // -------------------------------------------------------------------------
  // 7) Reversal is documented, not destructive
  // -------------------------------------------------------------------------
  const history = await call("/api/points/history?student_id=" + encodeURIComponent(student.id) + "&limit=200", { token: admin });
  const manualEvent = (history.data || []).find(event => event.event_type === "manual" && event.kind === "achievement" && event.points === 30);
  check("manual event appears in history", Boolean(manualEvent), JSON.stringify(history.data?.slice?.(0, 3)));

  const reverseNoReason = await call("/api/points/events/" + encodeURIComponent(manualEvent.id) + "/reverse", { method: "POST", token: admin, body: {} });
  check("reversal without reason is rejected", reverseNoReason.status === 400, JSON.stringify(reverseNoReason.data));

  const reverse = await call("/api/points/events/" + encodeURIComponent(manualEvent.id) + "/reverse", { method: "POST", token: admin, body: { reason: "تصحيح اختبار محلي" } });
  check("reversal removes the paired 30-point award and keeps the record", reverse.status === 200 && reverse.data?.totals?.achievement === 25 && reverse.data?.totals?.store === 14, JSON.stringify(reverse.data));

  const reverseAgain = await call("/api/points/events/" + encodeURIComponent(manualEvent.id) + "/reverse", { method: "POST", token: admin, body: { reason: "تكرار" } });
  check("second reversal is rejected", reverseAgain.status === 409, JSON.stringify(reverseAgain.data));

  const historyAfter = await call("/api/points/history?student_id=" + encodeURIComponent(student.id) + "&limit=200", { token: admin });
  const reversedRow = (historyAfter.data || []).find(event => event.id === manualEvent.id);
  check("history keeps the reversed event with a reason", reversedRow?.reversed === true && reversedRow?.reversal_reason === "تصحيح اختبار محلي", JSON.stringify(reversedRow));

  // -------------------------------------------------------------------------
  // 8) Approve / fulfil keeps the debit
  // -------------------------------------------------------------------------
  const redeem3 = await call("/api/store/redeem", { method: "POST", token: studentToken, body: { item_id: itemId } });
  check("student can redeem again after a rejected request", redeem3.status === 201 && redeem3.data?.balance === 4, JSON.stringify(redeem3.data));
  const redemption3 = redeem3.data?.redemption?.id;

  const approve = await call("/api/store/redemptions/" + encodeURIComponent(redemption3) + "/decision", { method: "POST", token: admin, body: { decision: "approved", note: "اختبار الاعتماد" } });
  check("admin approves redemption", approve.status === 200, JSON.stringify(approve.data));

  const fulfill = await call("/api/store/redemptions/" + encodeURIComponent(redemption3) + "/decision", { method: "POST", token: admin, body: { decision: "fulfilled", note: "اختبار التنفيذ" } });
  const afterFulfil = await call("/api/points/summary?student_id=" + encodeURIComponent(student.id), { token: admin });
  check("fulfilled redemption keeps the store debit", fulfill.status === 200 && afterFulfil.data?.totals?.store === 4, JSON.stringify({ fulfil: fulfill.data, totals: afterFulfil.data?.totals }));

  const fulfilAgain = await call("/api/store/redemptions/" + encodeURIComponent(redemption3) + "/decision", { method: "POST", token: admin, body: { decision: "approved" } });
  check("fulfilled redemption is final", fulfilAgain.status === 409, JSON.stringify(fulfilAgain.data));

  // -------------------------------------------------------------------------
  // 9) Server-side scope: a teacher outside the group cannot award points
  // -------------------------------------------------------------------------
  const teacherCreate = await call("/api/teachers", { method: "POST", token: admin, body: { name: "معلم الاختبار", username: "points-teacher-1", password: "TeacherPass#2026" } });
  check("create test teacher", teacherCreate.status === 201, JSON.stringify(teacherCreate.data));
  const teacherLogin = await login("points-teacher-1", "TeacherPass#2026");
  check("teacher login returns a token", teacherLogin.status === 200 && teacherLogin.token.length === 64, JSON.stringify(teacherLogin.data));
  let teacherToken = teacherLogin.token;
  await call("/api/me/password", { method: "POST", token: teacherToken, body: { current_password: "TeacherPass#2026", new_password: "TeacherPass#2026b" } });
  teacherToken = (await login("points-teacher-1", "TeacherPass#2026b")).token;

  const scopedSummary = await call("/api/points/summary?student_id=" + encodeURIComponent(student.id), { token: teacherToken });
  check("teacher outside the group cannot read points", scopedSummary.status === 403, JSON.stringify(scopedSummary.data));
  const scopedAward = await call("/api/points/award", { method: "POST", token: teacherToken, body: { student_id: student.id, achievement_points: 5, reason: "محاولة خارج النطاق" } });
  check("teacher outside the group cannot award points", scopedAward.status === 403, JSON.stringify(scopedAward.data));

  // -------------------------------------------------------------------------
  // 10) Student cannot read another student or manage the store
  // -------------------------------------------------------------------------
  const otherSummary = await call("/api/points/summary?student_id=" + encodeURIComponent(otherStudent.id), { token: studentToken });
  check("student cannot read another student's points", otherSummary.status === 403, JSON.stringify(otherSummary.data));
  const studentRuleEdit = await call("/api/points/rules", { method: "POST", token: studentToken, body: { event_type: "hack_rule", name: "x", achievement_points: 1 } });
  check("student cannot edit rules", studentRuleEdit.status === 403, JSON.stringify(studentRuleEdit.data));
  const studentItemCreate = await call("/api/store/items", { method: "POST", token: studentToken, body: { name: "x", cost: 1 } });
  check("student cannot create store items", studentItemCreate.status === 403, JSON.stringify(studentItemCreate.data));

  // -------------------------------------------------------------------------
  // 11) Unified tasks engine reads assignments, Quran plan and attendance
  // -------------------------------------------------------------------------
  const planSave = await call("/api/quran/plan", { method: "POST", token: admin, body: { student_id: student.id, path_id: "30", weekly_goal: "حفظ ثمنين ومراجعة أربعة", weekly_targets: [{ memorization: "حفظ ثمنين", revision: "مراجعة أربعة أثمان" }] } });
  check("save the student Quran plan", planSave.status === 200, JSON.stringify(planSave.data));
  const studentTasks = await call("/api/tasks", { token: studentToken });
  const taskTypes = new Set((studentTasks.data?.tasks || []).map(task => task.type));
  check("student tasks unify assignment, Quran and attendance", studentTasks.status === 200 && taskTypes.has("assignment") && taskTypes.has("memorization") && taskTypes.has("attendance"), JSON.stringify(studentTasks.data));
  const assignmentTask = (studentTasks.data?.tasks || []).find(task => task.type === "assignment" && task.source_id === assignmentId);
  check("reviewed assignment appears as a completed task", assignmentTask?.status === "done", JSON.stringify(assignmentTask));
  const attendanceTask = (studentTasks.data?.tasks || []).find(task => task.type === "attendance");
  check("present day appears as a completed attendance task", attendanceTask?.status === "done", JSON.stringify(attendanceTask));
  const otherTasks = await call("/api/tasks?student_id=" + encodeURIComponent(otherStudent.id), { token: studentToken });
  check("student cannot read another student's tasks", otherTasks.status === 403, JSON.stringify(otherTasks.data));
  const teacherTasks = await call("/api/tasks?student_id=" + encodeURIComponent(student.id), { token: teacherToken });
  check("teacher outside the group cannot read tasks", teacherTasks.status === 403, JSON.stringify(teacherTasks.data));

  // -------------------------------------------------------------------------
  // 12) Hadith/mutoon content: publishing requires a source, students track it
  // -------------------------------------------------------------------------
  const contentNoSource = await call("/api/content", { method: "POST", token: admin, body: { kind: "hadith", title: "حديث بلا مصدر", text: "نص", status: "published" } });
  check("publishing content without source is rejected", contentNoSource.status === 400, JSON.stringify(contentNoSource.data));
  const contentCreate = await call("/api/content", { method: "POST", token: admin, body: { kind: "hadith", title: "حديث اختبار المصدر", text: "إنما الأعمال بالنيات", source: "صحيح البخاري", reference: "1", grade: "صحيح", status: "published" } });
  check("admin publishes a sourced hadith", contentCreate.status === 201 && contentCreate.data?.id, JSON.stringify(contentCreate.data));
  const contentId = contentCreate.data.id;
  const studentContent = await call("/api/content?kind=hadith", { token: studentToken });
  const publishedContent = (studentContent.data || []).find(item => item.id === contentId);
  check("student reads the published hadith", studentContent.status === 200 && Boolean(publishedContent), JSON.stringify(studentContent.data));
  const contentProgress = await call("/api/content/" + encodeURIComponent(contentId) + "/progress", { method: "POST", token: studentToken, body: { status: "memorized" } });
  check("student marks the hadith as memorized", contentProgress.status === 200 && contentProgress.data?.progress?.status === "memorized", JSON.stringify(contentProgress.data));
  const studentContentAgain = await call("/api/content?kind=hadith", { token: studentToken });
  check("content list reflects the student's progress", (studentContentAgain.data || []).find(item => item.id === contentId)?.my_progress?.status === "memorized", JSON.stringify(studentContentAgain.data));
  const contentForbidden = await call("/api/content", { method: "POST", token: studentToken, body: { kind: "hadith", title: "x", text: "y" } });
  check("student cannot publish content", contentForbidden.status === 403, JSON.stringify(contentForbidden.data));

  // -------------------------------------------------------------------------
  // 13) Competitions live in scripts/competitions-test.mjs; keep only the
  //     cross-cutting role gate here so the economy drill stays focused.
  // -------------------------------------------------------------------------
  const studentCompetitionCreate = await call("/api/competitions", { method: "POST", token: studentToken, body: { title: "x", description: "y" } });
  check("student cannot create competitions", studentCompetitionCreate.status === 403, JSON.stringify(studentCompetitionCreate.data));
  const studentCompetitionList = await call("/api/competitions", { token: studentToken });
  check("students can read the competitions list", studentCompetitionList.status === 200 && Array.isArray(studentCompetitionList.data), JSON.stringify(studentCompetitionList.data));

  // -------------------------------------------------------------------------
  // 14) Restore the academy's configured 30/30 attendance rule for later suites.
  // -------------------------------------------------------------------------
  const restoreRule = await call("/api/points/rules", { method: "POST", token: admin, body: { id: attendanceRule.id, event_type: "attendance_present", name: attendanceRule.name, description: attendanceRule.description, achievement_points: 30, store_points: 30, max_per_day: 1, auto_award: 1, active: 1, sort_order: attendanceRule.sort_order } });
  check("attendance rule is restored to the academy 30-point default", restoreRule.status === 200 && restoreRule.data?.rule?.store_points === 30 && restoreRule.data?.rule?.achievement_points === 30, JSON.stringify(restoreRule.data));

  // -------------------------------------------------------------------------
  // 15) Period rankings and general adjustments (run last to avoid changing
  //     the balances expected by the store and reversal tests above).
  // -------------------------------------------------------------------------
  const balanceBeforeAdjustment = await call("/api/points/summary?student_id=" + encodeURIComponent(student.id), { token: admin });
  const startingBalance = Number(balanceBeforeAdjustment.data?.totals?.store || balanceBeforeAdjustment.data?.totals?.balance || 0);
  const startingAchievement = Number(balanceBeforeAdjustment.data?.totals?.achievement || 0);
  const adjustNoReason = await call("/api/points/adjust", { method: "POST", token: admin, body: { student_id: student.id, points: 5, request_id: "test-adjust-no-reason" } });
  check("general adjustment requires a reason", adjustNoReason.status === 400, JSON.stringify(adjustNoReason.data));

  const adjustmentBody = { student_id: student.id, points: 7, reason: "اختبار إضافة عامة", request_id: "test-general-adjust-001" };
  const adjustment1 = await call("/api/points/adjust", { method: "POST", token: admin, body: adjustmentBody });
  check("general adjustment adds points to both balances", adjustment1.status === 201 && adjustment1.data?.totals?.store === startingBalance + 7 && adjustment1.data?.totals?.achievement === startingAchievement + 7, JSON.stringify(adjustment1.data));

  const adjustment2 = await call("/api/points/adjust", { method: "POST", token: admin, body: adjustmentBody });
  check("repeated general adjustment does not duplicate", adjustment2.status === 201 && (adjustment2.data?.events || []).every(event => event.status === "duplicate") && adjustment2.data?.totals?.store === startingBalance + 7 && adjustment2.data?.totals?.achievement === startingAchievement + 7, JSON.stringify(adjustment2.data));

  const adjustmentSubtract = await call("/api/points/adjust", { method: "POST", token: admin, body: { student_id: student.id, points: -2, reason: "اختبار خصم عام", request_id: "test-general-adjust-002" } });
  check("general adjustment subtracts points once from both balances", adjustmentSubtract.status === 201 && adjustmentSubtract.data?.totals?.store === startingBalance + 5 && adjustmentSubtract.data?.totals?.achievement === startingAchievement + 5, JSON.stringify(adjustmentSubtract.data));

  const adjustmentOverdraw = await call("/api/points/adjust", { method: "POST", token: admin, body: { student_id: student.id, points: -(startingBalance + 6), reason: "اختبار منع الرصيد السالب", request_id: "test-general-adjust-003" } });
  check("general adjustment prevents a negative balance", adjustmentOverdraw.status === 409, JSON.stringify(adjustmentOverdraw.data));

  for (const period of ["weekly", "monthly", "yearly"]) {
    const ranking = await call("/api/effort/ranking?scope=group&group_id=" + encodeURIComponent(groupId) + "&period=" + period, { token: admin });
    const own = (ranking.data?.rows || []).find(row => row.student_id === student.id);
    check("group ranking supports " + period + " period", ranking.status === 200 && ranking.data?.total_count === 2 && own && Number.isFinite(own.score) && own.rank > 0, JSON.stringify(ranking.data));
  }

  const studentGroupRanking = await call("/api/effort/ranking?scope=group&group_id=" + encodeURIComponent(groupId) + "&period=weekly", { token: studentToken });
  check("student ranking exposes only their own row", studentGroupRanking.status === 200 && studentGroupRanking.data?.rows?.length === 1 && studentGroupRanking.data.rows[0]?.student_id === student.id && studentGroupRanking.data?.total_count === 2, JSON.stringify(studentGroupRanking.data));

  const studentAcademyRanking = await call("/api/effort/ranking?scope=academy&student_id=" + encodeURIComponent(student.id) + "&period=weekly", { token: studentToken });
  check("student can see own academy position without other student records", studentAcademyRanking.status === 200 && studentAcademyRanking.data?.rows?.length === 1 && studentAcademyRanking.data.rows[0]?.student_id === student.id && studentAcademyRanking.data?.total_count >= 1, JSON.stringify(studentAcademyRanking.data));

  const studentOtherTeamRanking = await call("/api/effort/ranking?scope=team&group_id=" + encodeURIComponent(groupId) + "&student_id=" + encodeURIComponent(otherStudent.id) + "&period=weekly", { token: studentToken });
  check("student cannot request another student's team ranking", studentOtherTeamRanking.status === 403, JSON.stringify(studentOtherTeamRanking.data));

  const beforeStoreOnly = await call("/api/points/summary?student_id=" + encodeURIComponent(student.id), { token: admin });
  const storeOnlyAward = await call("/api/points/award", { method: "POST", token: admin, body: { student_id: student.id, achievement_points: 0, store_points: 30, reason: "اختبار فصل رصيد المتجر", request_id: "test-store-only-001" } });
  check("store-only award changes only the store balance", storeOnlyAward.status === 201 && storeOnlyAward.data?.totals?.achievement === beforeStoreOnly.data?.totals?.achievement && storeOnlyAward.data?.totals?.store === beforeStoreOnly.data?.totals?.store + 30, JSON.stringify(storeOnlyAward.data));
  const achievementOverdraw = await call("/api/points/adjust", { method: "POST", token: admin, body: { student_id: student.id, points: -(Number(beforeStoreOnly.data?.totals?.achievement || 0) + 1), reason: "اختبار منع سالب الإنجاز", request_id: "test-achievement-overdraw-001" } });
  check("adjustment cannot make achievement negative even when store can cover it", achievementOverdraw.status === 409, JSON.stringify(achievementOverdraw.data));

  const report = { base: BASE, failures, passed: results.filter(row => row.ok).length, total: results.length, results };
  const outputPath = process.env.POINTS_TEST_REPORT || "";
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
