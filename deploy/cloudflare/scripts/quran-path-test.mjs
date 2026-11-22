// Local end-to-end checks for the Quran school path (0005_quran_path).
// Run against `wrangler dev` with a fresh local D1 database:
//   npx wrangler@4 dev --port 8788 --var BOOTSTRAP_SECRET:test-bootstrap-secret-1234
//   node scripts/quran-path-test.mjs
// The script is additive: it only writes inside the local .wrangler D1 state.

const BASE = process.env.QURAN_TEST_BASE || "http://127.0.0.1:8788";
const BOOTSTRAP_SECRET = process.env.QURAN_BOOTSTRAP_SECRET || "test-bootstrap-secret-1234";
const ADMIN = { name: "مدير الاختبار", email: "admin@test.local", password: "TestPassword#2026Strong" };

const results = [];
let failures = 0;
// Unique per run so repeated local runs never collide on usernames.
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

async function makeStudent(admin, groupId, name, username, password) {
  const roster = await call("/api/admin/roster-add", { method: "POST", token: admin, body: { group_id: groupId, names: [name] } });
  if (roster.status !== 201) throw new Error("roster add failed: " + JSON.stringify(roster.data));
  const students = await call("/api/students?group_id=" + encodeURIComponent(groupId), { token: admin });
  const student = (students.data || []).find(row => row.name === name);
  if (!student) throw new Error("roster did not return " + name);
  const account = await call("/api/students/" + encodeURIComponent(student.id) + "/account", { method: "POST", token: admin, body: { username, password } });
  if (account.status !== 201) throw new Error("account creation failed: " + JSON.stringify(account.data));
  const first = await login(username, password);
  if (!first.token) throw new Error("login failed: " + JSON.stringify(first.data));
  const changed = password + "b";
  const change = await call("/api/me/password", { method: "POST", token: first.token, body: { current_password: password, new_password: changed } });
  if (change.status !== 200) throw new Error("password change failed: " + JSON.stringify(change.data));
  const second = await login(username, changed);
  return { id: student.id, name, token: second.token };
}

async function main() {
  await waitForServer();
  const today = academyDate(0);

  // 1) Admin + group + two students in the same group
  const bootstrap = await call("/api/admin/bootstrap", { method: "POST", headers: { "x-bootstrap-secret": BOOTSTRAP_SECRET }, body: ADMIN });
  check("admin bootstrap (created or already exists)", [201, 409].includes(bootstrap.status), JSON.stringify(bootstrap.data));
  const adminLogin = await login(ADMIN.email, ADMIN.password);
  check("admin login returns a session token", adminLogin.status === 200 && adminLogin.token.length === 64, JSON.stringify(adminLogin.data));
  const admin = adminLogin.token;

  const group = await call("/api/groups", { method: "POST", token: admin, body: { name: "فوج اختبار مسار القرآن" } });
  check("create test group", group.status === 201 && group.data?.id, JSON.stringify(group.data));
  const groupId = group.data.id;

  const studentA = await makeStudent(admin, groupId, "طالب مسار القرآن الأول " + RUN, "quran-student-1-" + RUN, "QuranStudent#2026");
  const studentB = await makeStudent(admin, groupId, "طالب مسار القرآن الثاني " + RUN, "quran-student-2-" + RUN, "QuranStudent#2026");
  check("two student sessions are active", studentA.token.length === 64 && studentB.token.length === 64);

  // 2) Enrollment: validation then save
  const badPlan = await call("/api/quran/path", { method: "POST", token: studentA.token, body: { hifz_plan: "plan_z", hifz_category: "15", hifz_amount: "5", ward_ahzab: 1 } });
  check("unknown hifz plan is rejected", badPlan.status === 400, JSON.stringify(badPlan.data));
  const badCategory = await call("/api/quran/path", { method: "POST", token: studentA.token, body: { hifz_plan: "plan_a", hifz_category: "10", hifz_amount: "5", ward_ahzab: 1 } });
  check("unknown memorization category is rejected", badCategory.status === 400, JSON.stringify(badCategory.data));
  const badWard = await call("/api/quran/path", { method: "POST", token: studentA.token, body: { hifz_plan: "plan_a", hifz_category: "15", hifz_amount: "5", ward_ahzab: 3 } });
  check("ward outside 1/2/4 is rejected", badWard.status === 400, JSON.stringify(badWard.data));
  const futureStart = await call("/api/quran/path", { method: "POST", token: studentA.token, body: { hifz_plan: "plan_a", hifz_category: "15", hifz_amount: "5", ward_ahzab: 1, start_date: academyDate(5) } });
  check("future start date is rejected", futureStart.status === 400, JSON.stringify(futureStart.data));

  const plannedRestDay = new Date(academyDate(-2) + "T12:00:00Z").getUTCDay();
  const enroll = await call("/api/quran/path", { method: "POST", token: studentA.token, body: { hifz_plan: "plan_b", hifz_category: "30", hifz_amount: "5", hifz_unit: "سطر", ward_ahzab: 2, rest_day: plannedRestDay, start_date: today } });
  check("student enrolls in the Quran path", enroll.status === 200 && enroll.data?.path?.hifz_plan === "plan_b", JSON.stringify(enroll.data));
  check("category 30 derives quarter-hizb consolidation", enroll.data?.path?.thabit_amount === 0.25 && enroll.data?.path?.thabit_label === "ربع حزب", JSON.stringify(enroll.data?.path));

  const pathRead = await call("/api/quran/path", { token: studentA.token });
  check("path read reports enrollment", pathRead.status === 200 && pathRead.data?.enrolled === true && pathRead.data?.path?.ward_ahzab === 2, JSON.stringify(pathRead.data));
  const enrollB = await call("/api/quran/path", { method: "POST", token: studentB.token, body: { hifz_plan: "plan_a", hifz_category: "15", hifz_amount: "3", hifz_unit: "سطر", ward_ahzab: 1, start_date: today } });
  check("second student can enroll for isolated approval tests", enrollB.status === 200 && enrollB.data?.path?.hifz_plan === "plan_a", JSON.stringify(enrollB.data));

  const todayRead = await call("/api/quran/today", { token: studentA.token });
  check("today read reports rest day and empty logs", todayRead.status === 200 && todayRead.data?.enrolled === true && todayRead.data?.logs?.hifz === null, JSON.stringify(todayRead.data));

  // 3) Cross-student isolation
  const crossPath = await call("/api/quran/path?student_id=" + encodeURIComponent(studentB.id), { token: studentA.token });
  check("student cannot read another student's path", crossPath.status === 403, JSON.stringify(crossPath.data));
  const crossDaily = await call("/api/quran/daily", { method: "POST", token: studentA.token, body: { student_id: studentB.id, kind: "hifz", amount: 1 } });
  check("student cannot write another student's daily log", crossDaily.status === 403, JSON.stringify(crossDaily.data));

  // 4) Makeup blocks new memorization until resolved
  const makeup = await call("/api/quran/makeups", { method: "POST", token: studentA.token, body: { kind: "hifz", due_date: today, amount: "خمسة أسطر", reason: "interruption", reason_note: "اختبار محلي" } });
  check("student files a makeup record", makeup.status === 201 && makeup.data?.id, JSON.stringify(makeup.data));
  const makeupId = makeup.data.id;
  const blockOn = await call("/api/quran/makeups/update", { method: "POST", token: admin, body: { id: makeupId, status: "open", blocks_new: true } });
  check("staff can block new memorization", blockOn.status === 200, JSON.stringify(blockOn.data));

  const blockedHifz = await call("/api/quran/daily", { method: "POST", token: studentA.token, body: { kind: "hifz", amount: 5, unit: "سطر" } });
  check("blocked student cannot log new memorization", blockedHifz.status === 409, JSON.stringify(blockedHifz.data));

  const resolveMakeup = await call("/api/quran/makeups/update", { method: "POST", token: admin, body: { id: makeupId, status: "done" } });
  check("staff resolves the makeup", resolveMakeup.status === 200, JSON.stringify(resolveMakeup.data));

  const priorHifzWorkday = await call("/api/quran/daily", { method: "POST", token: studentA.token, body: { kind: "hifz", day: academyDate(-3), amount: 2, unit: "سطر" } });
  check("student self-reports memorization before the planned rest day as pending", priorHifzWorkday.status === 201 && priorHifzWorkday.data?.entry?.approval_status === "pending" && priorHifzWorkday.data?.awards?.length === 0 && priorHifzWorkday.data?.streak?.pending_approval === true, JSON.stringify(priorHifzWorkday.data));
  const afterRestHifzWorkday = await call("/api/quran/daily", { method: "POST", token: studentA.token, body: { kind: "hifz", day: academyDate(-1), amount: 2, unit: "سطر" } });
  check("student self-reports memorization after the planned rest day without points", afterRestHifzWorkday.status === 201 && afterRestHifzWorkday.data?.entry?.approval_status === "pending" && afterRestHifzWorkday.data?.streak?.pending_approval === true, JSON.stringify(afterRestHifzWorkday.data));
  const hifz = await call("/api/quran/daily", { method: "POST", token: studentA.token, body: { kind: "hifz", amount: 5, unit: "سطر", notes: "اختبار الحفظ" } });
  check("student self-reports today's memorization pending Sheikh approval", hifz.status === 201 && hifz.data?.entry?.kind === "hifz" && hifz.data?.entry?.approval_status === "pending" && hifz.data?.awards?.length === 0, JSON.stringify(hifz.data));
  const selfApproval = await call("/api/quran/daily/decision", { method: "POST", token: studentA.token, body: { student_id: studentA.id, entry_id: hifz.data?.entry?.id, decision: "approved" } });
  check("student cannot approve their own memorization", selfApproval.status === 403, JSON.stringify(selfApproval.data));
  const pendingQueue = await call("/api/quran/daily/pending?group_id=" + encodeURIComponent(groupId), { token: admin });
  check("Sheikh queue lists all pending memorization entries", pendingQueue.status === 200 && pendingQueue.data?.length === 3, JSON.stringify(pendingQueue.data));
  const approvePriorHifz = await call("/api/quran/daily/decision", { method: "POST", token: admin, body: { student_id: studentA.id, entry_id: priorHifzWorkday.data.entry.id, decision: "approved" } });
  check("Sheikh approval awards the first memorization entry and starts its streak", approvePriorHifz.status === 200 && approvePriorHifz.data?.entry?.approval_status === "approved" && approvePriorHifz.data?.streak?.days === 1, JSON.stringify(approvePriorHifz.data));
  const approveAfterRestHifz = await call("/api/quran/daily/decision", { method: "POST", token: admin, body: { student_id: studentA.id, entry_id: afterRestHifzWorkday.data.entry.id, decision: "approved" } });
  check("Sheikh approval continues the streak across the planned rest day", approveAfterRestHifz.status === 200 && approveAfterRestHifz.data?.streak?.days === 2, JSON.stringify(approveAfterRestHifz.data));
  const approveHifz = await call("/api/quran/daily/decision", { method: "POST", token: admin, body: { student_id: studentA.id, entry_id: hifz.data.entry.id, decision: "approved" } });
  check("Sheikh approval awards today's memorization and reaches three days", approveHifz.status === 200 && approveHifz.data?.streak?.days === 3 && approveHifz.data?.awards?.length > 0, JSON.stringify(approveHifz.data));
  const duplicateApproval = await call("/api/quran/daily/decision", { method: "POST", token: admin, body: { student_id: studentA.id, entry_id: hifz.data.entry.id, decision: "approved" } });
  check("repeated Sheikh approval is idempotent", duplicateApproval.status === 200 && duplicateApproval.data?.duplicate === true, JSON.stringify(duplicateApproval.data));
  const pointsBeforeProgressDuplicate = await call("/api/points/summary", { token: studentA.token });
  const progressAfterApproval = await call("/api/quran/progress", { method: "POST", token: admin, body: { student_id: studentA.id, date: today, activity: "memorization", memorized: "خمسة أسطر", notes: "متابعة الشيخ بعد اعتماد السجل اليومي" } });
  const pointsAfterProgressDuplicate = await call("/api/points/summary", { token: studentA.token });
  check("teacher progress does not award twice after daily approval", progressAfterApproval.status === 201 && pointsAfterProgressDuplicate.data?.totals?.achievement === pointsBeforeProgressDuplicate.data?.totals?.achievement && pointsAfterProgressDuplicate.data?.totals?.store === pointsBeforeProgressDuplicate.data?.totals?.store, JSON.stringify({before:pointsBeforeProgressDuplicate.data?.totals,after:pointsAfterProgressDuplicate.data?.totals,progress:progressAfterApproval.data}));
  const queueAfterApproval = await call("/api/quran/daily/pending?group_id=" + encodeURIComponent(groupId), { token: admin });
  check("approved memorization entries leave the pending queue", queueAfterApproval.status === 200 && queueAfterApproval.data?.length === 0, JSON.stringify(queueAfterApproval.data));
  const progressBeforeDaily = await call("/api/quran/progress", { method: "POST", token: admin, body: { student_id: studentB.id, date: today, activity: "memorization", memorized: "سطران موثقان", notes: "اعتماد الشيخ قبل تسجيل الطالب" } });
  check("teacher can record verified memorization before the student self-report", progressBeforeDaily.status === 201, JSON.stringify(progressBeforeDaily.data));
  const pointsBeforeResubmissionApproval = await call("/api/points/summary", { token: studentB.token });
  const rejectedHifz = await call("/api/quran/daily", { method: "POST", token: studentB.token, body: { kind: "hifz", amount: 2, unit: "سطر" } });
  check("second student self-report is pending", rejectedHifz.status === 201 && rejectedHifz.data?.entry?.approval_status === "pending" && rejectedHifz.data?.awards?.length === 0, JSON.stringify(rejectedHifz.data));
  const rejectHifz = await call("/api/quran/daily/decision", { method: "POST", token: admin, body: { student_id: studentB.id, entry_id: rejectedHifz.data.entry.id, decision: "rejected", note: "راجع موضع الخطأ قبل إعادة العرض" } });
  check("Sheikh can return a daily Quran entry with a reason", rejectHifz.status === 200 && rejectHifz.data?.entry?.approval_status === "rejected", JSON.stringify(rejectHifz.data));
  const rejectedToday = await call("/api/quran/today", { token: studentB.token });
  check("student sees the rejection reason", rejectedToday.status === 200 && rejectedToday.data?.logs?.hifz?.approval_status === "rejected" && rejectedToday.data?.logs?.hifz?.approval_note?.includes("راجع موضع الخطأ"), JSON.stringify(rejectedToday.data?.logs?.hifz));
  const resubmittedHifz = await call("/api/quran/daily", { method: "POST", token: studentB.token, body: { kind: "hifz", amount: 3, unit: "سطر", notes: "تم التصحيح" } });
  check("student can resubmit a rejected entry without creating a duplicate", resubmittedHifz.status === 200 && resubmittedHifz.data?.entry?.id === rejectedHifz.data.entry.id && resubmittedHifz.data?.entry?.approval_status === "pending", JSON.stringify(resubmittedHifz.data));
  const approveResubmitted = await call("/api/quran/daily/decision", { method: "POST", token: admin, body: { student_id: studentB.id, entry_id: rejectedHifz.data.entry.id, decision: "approved" } });
  const pointsAfterResubmissionApproval = await call("/api/points/summary", { token: studentB.token });
  check("corrected entry can be approved without duplicating prior teacher points", approveResubmitted.status === 200 && approveResubmitted.data?.entry?.approval_status === "approved" && (approveResubmitted.data?.awards||[]).length === 0 && pointsAfterResubmissionApproval.data?.totals?.achievement === pointsBeforeResubmissionApproval.data?.totals?.achievement && pointsAfterResubmissionApproval.data?.totals?.store === pointsBeforeResubmissionApproval.data?.totals?.store, JSON.stringify({decision:approveResubmitted.data, before:pointsBeforeResubmissionApproval.data?.totals, after:pointsAfterResubmissionApproval.data?.totals}));

  const duplicate = await call("/api/quran/daily", { method: "POST", token: studentA.token, body: { kind: "hifz", amount: 5, unit: "سطر", notes: "اختبار الحفظ" } });
  check("identical daily log is idempotent", duplicate.status === 200 && duplicate.data?.duplicate === true, JSON.stringify(duplicate.data));

  const conflicting = await call("/api/quran/daily", { method: "POST", token: studentA.token, body: { kind: "hifz", amount: 9, unit: "سطر" } });
  check("different amount for the same day is rejected", conflicting.status === 409, JSON.stringify(conflicting.data));

  const thabit = await call("/api/quran/daily", { method: "POST", token: studentA.token, body: { kind: "thabit", amount: 0.25, unit: "حزب", repetitions: 15 } });
  check("student logs consolidation with repetitions pending approval", thabit.status === 201 && Number(thabit.data?.entry?.repetitions) === 15 && thabit.data?.entry?.approval_status === "pending" && thabit.data?.awards?.length === 0, JSON.stringify(thabit.data));
  const thabitApproval = await call("/api/quran/daily/decision", { method: "POST", token: admin, body: { student_id: studentA.id, entry_id: thabit.data.entry.id, decision: "approved" } });
  check("Sheikh approval awards consolidation points", thabitApproval.status === 200 && thabitApproval.data?.entry?.approval_status === "approved" && thabitApproval.data?.awards?.length > 0, JSON.stringify(thabitApproval.data));

  // Build a five-day ward streak in chronological order, using only test records in local D1.
  for (let offset = -4; offset <= -1; offset += 1) {
    const priorWard = await call("/api/quran/daily", { method: "POST", token: studentA.token, body: { kind: "ward", day: academyDate(offset), amount: 1, unit: "حزب" } });
    check("student logs prior ward day " + offset, priorWard.status === 201, JSON.stringify(priorWard.data));
  }
  const ward = await call("/api/quran/daily", { method: "POST", token: studentA.token, body: { kind: "ward", amount: 2, unit: "حزب" } });
  check("student logs the daily portion", ward.status === 201 && Number(ward.data?.entry?.amount) === 2, JSON.stringify(ward.data));
  check("fifth consecutive ward day is counted automatically", ward.data?.streak?.days === 5 && ward.data?.streak?.milestone?.milestone_days === 5, JSON.stringify(ward.data?.streak));
  const streakView = await call("/api/points/streak", { token: studentA.token });
  const wardStreak = (streakView.data?.streaks || []).find(row => row.activity === "ward");
  const fiveDayBadge = (streakView.data?.badges || []).find(row => row.activity === "ward" && Number(row.milestone_days) === 5);
  check("student sees a five-day ward streak and badge", streakView.status === 200 && wardStreak?.current_days === 5 && fiveDayBadge?.points_awarded === 0, JSON.stringify(streakView.data));
  // Exercise the real 30-point Fajr ledger over four consecutive days.
  const fajrDays = [];
  for (const offset of [-5, -4, -3]) {
    const award = await call("/api/points/activity", { method: "POST", token: admin, body: { student_id: studentA.id, activity: "fajr", date: academyDate(offset) } });
    fajrDays.push(award);
    check("Fajr day " + (offset + 6) + " is awarded once", award.status === 201 && award.data?.streak?.days === offset + 6, JSON.stringify(award.data?.streak));
  }
  const fajrThirdDay = fajrDays[2];
  check("three 30-point Fajr days equal 90 base plus 45 streak bonus", Number(fajrThirdDay.data?.streak?.base_points) === 90 && Number(fajrThirdDay.data?.streak?.streak_bonus) === 45 && Number(fajrThirdDay.data?.streak?.base_points) + Number(fajrThirdDay.data?.streak?.streak_bonus) === 135 && fajrThirdDay.data?.streak?.bonus_rate === 0.5, JSON.stringify(fajrThirdDay.data?.streak));
  check("new student uses separate balance mode after local cutover snapshot", fajrThirdDay.data?.totals?.mode === "separate", JSON.stringify(fajrThirdDay.data?.totals));
  const firstFajrTotals = fajrDays[0].data?.totals || {};
  const thirdFajrTotals = fajrThirdDay.data?.totals || {};
  check("the 45-point streak bonus is excluded from the store balance", Number(thirdFajrTotals.achievement) - Number(firstFajrTotals.achievement) - (Number(thirdFajrTotals.store) - Number(firstFajrTotals.store)) === 45, JSON.stringify({ firstFajrTotals, thirdFajrTotals }));

  const fajrFourthDay = await call("/api/points/activity", { method: "POST", token: admin, body: { student_id: studentA.id, activity: "fajr", date: academyDate(-2) } });
  check("fourth Fajr day adds only 15 bonus points", fajrFourthDay.status === 201 && fajrFourthDay.data?.streak?.days === 4 && Number(fajrFourthDay.data?.streak?.base_points) === 120 && Number(fajrFourthDay.data?.streak?.streak_bonus) === 15, JSON.stringify(fajrFourthDay.data?.streak));
  const fourthFajrTotals = fajrFourthDay.data?.totals || {};
  check("the fourth-day 15-point bonus is achievement-only", Number(fourthFajrTotals.achievement) - Number(thirdFajrTotals.achievement) === 45 && Number(fourthFajrTotals.store) - Number(thirdFajrTotals.store) === 30, JSON.stringify({ thirdFajrTotals, fourthFajrTotals }));

  const duplicateFajr = await call("/api/points/activity", { method: "POST", token: admin, body: { student_id: studentA.id, activity: "fajr", date: academyDate(-2) } });
  check("duplicate Fajr entry cannot award the same base points or streak bonus twice", duplicateFajr.status === 201 && duplicateFajr.data?.streak?.duplicate === true && JSON.stringify(duplicateFajr.data?.totals) === JSON.stringify(fajrFourthDay.data?.totals), JSON.stringify(duplicateFajr.data));

  const fajrAward = await call("/api/points/activity", { method: "POST", token: admin, body: { student_id: studentA.id, activity: "fajr", date: today } });
  check("a missed calendar day resets Fajr to a new one-day streak", fajrAward.status === 201 && fajrAward.data?.streak?.days === 1 && Number(fajrAward.data?.streak?.base_points) === 30 && Number(fajrAward.data?.streak?.streak_bonus) === 0, JSON.stringify(fajrAward.data?.streak));

  const lateFajr = await call("/api/points/activity", { method: "POST", token: admin, body: { student_id: studentA.id, activity: "fajr", date: academyDate(-1) } });
  check("late Fajr record does not rewrite the current streak or grant retroactive streak bonus", lateFajr.status === 201 && lateFajr.data?.streak?.backdated === true && lateFajr.data?.streak?.days === 1 && !Number(lateFajr.data?.streak?.streak_bonus || 0), JSON.stringify(lateFajr.data?.streak));

  const futureFajr = await call("/api/points/activity", { method: "POST", token: admin, body: { student_id: studentA.id, activity: "fajr", date: academyDate(1) } });
  check("future Fajr activity is rejected", futureFajr.status === 400, JSON.stringify(futureFajr.data));
  const manualStreak = await call("/api/points/streak", { method: "POST", token: admin, body: { student_id: studentA.id, activity: "fajr", base_points: 30, date: today } });
  check("legacy manual streak award endpoint is disabled", manualStreak.status === 410, JSON.stringify(manualStreak.data));
  const attendanceSave = await call("/api/attendance", { method: "POST", token: admin, body: { group_id: groupId, date: today, items: [{ student_id: studentA.id, status: "present" }] } });
  check("present attendance automatically starts an attendance streak", attendanceSave.status === 200, JSON.stringify(attendanceSave.data));
  const attendanceStreakView = await call("/api/points/streak", { token: studentA.token });
  const attendanceStreak = (attendanceStreakView.data?.streaks || []).find(row => row.activity === "attendance");
  check("student can see the automatic attendance streak", attendanceStreakView.status === 200 && attendanceStreak?.current_days === 1, JSON.stringify(attendanceStreakView.data));
  const currentFajrStreak = (attendanceStreakView.data?.streaks || []).find(row => row.activity === "fajr");
  const retainedFajrBadge = (attendanceStreakView.data?.badges || []).find(row => row.activity === "fajr" && Number(row.milestone_days) === 3);
  check("student sees the reset Fajr streak while the three-day badge remains", currentFajrStreak?.current_days === 1 && Boolean(retainedFajrBadge), JSON.stringify(attendanceStreakView.data));
  const crossStudentStreak = await call("/api/points/streak?student_id=" + encodeURIComponent(studentB.id), { token: studentA.token });
  check("student query cannot override the student's own streak scope", crossStudentStreak.status === 200 && (crossStudentStreak.data?.streaks || []).some(row => row.activity === "fajr" && row.current_days === 1), JSON.stringify(crossStudentStreak.data));
  const staffStreakView = await call("/api/points/streak?student_id=" + encodeURIComponent(studentA.id), { token: admin });
  check("authorized staff can read the student's streak and badge history", staffStreakView.status === 200 && (staffStreakView.data?.badges || []).some(row => row.activity === "fajr" && Number(row.milestone_days) === 3), JSON.stringify(staffStreakView.data));

  const futureLog = await call("/api/quran/daily", { method: "POST", token: studentA.token, body: { kind: "ward", day: academyDate(2), amount: 1 } });
  check("future daily log is rejected", futureLog.status === 400, JSON.stringify(futureLog.data));

  // 5) Companion pairing + scoring
  const pairSelf = await call("/api/quran/companion/pair", { method: "POST", token: admin, body: { student_a: studentA.id, student_b: studentA.id } });
  check("pairing a student with themselves is rejected", pairSelf.status === 400, JSON.stringify(pairSelf.data));
  const pair = await call("/api/quran/companion/pair", { method: "POST", token: admin, body: { student_a: studentA.id, student_b: studentB.id } });
  check("staff pairs two students in the same group", pair.status === 201 && pair.data?.pair?.id, JSON.stringify(pair.data));

  const studentPair = await call("/api/quran/companion/pair", { method: "POST", token: studentA.token, body: { student_a: studentA.id, student_b: studentB.id } });
  check("students cannot pair themselves", studentPair.status === 403, JSON.stringify(studentPair.data));

  const companion = await call("/api/quran/companion", { token: studentA.token });
  check("companion read returns the partner", companion.status === 200 && companion.data?.paired === true && companion.data?.pair?.partner_id === studentB.id, JSON.stringify(companion.data));

  const session = await call("/api/quran/companion/session", { method: "POST", token: studentA.token, body: { reciter_id: studentA.id, listener_id: studentB.id, amount: "حزبان", errors: 2, hesitations: 1, prompts: 1, minutes: 20, expected_minutes: 20 } });
  const expectedScore = 50 - 4 + (20 - 2) + (15 - 3) + 15;
  check("companion session scores from the 50/20/15/15 rubric", session.status === 201 && session.data?.session?.score === expectedScore, JSON.stringify({ expectedScore, got: session.data }));
  check("companion session returns a grade label", session.data?.session?.grade === "ممتاز", JSON.stringify(session.data));

  const outsidePair = await call("/api/quran/companion/session", { method: "POST", token: studentA.token, body: { reciter_id: studentA.id, listener_id: studentA.id, amount: "حزب" } });
  check("session requires two distinct paired students", outsidePair.status === 400, JSON.stringify(outsidePair.data));

  const manualNoReason = await call("/api/quran/companion/session", { method: "POST", token: studentA.token, body: { reciter_id: studentA.id, listener_id: studentB.id, amount: "حزب", score: 10 } });
  check("large manual override without reason is rejected", manualNoReason.status === 400, JSON.stringify(manualNoReason.data));
  const manual = await call("/api/quran/companion/session", { method: "POST", token: studentA.token, body: { reciter_id: studentA.id, listener_id: studentB.id, amount: "حزب", score: 10, confirm_override: true, override_reason: "اختبار التجاوز اليدوي" } });
  check("manual override with a reason is accepted", manual.status === 201 && manual.data?.session?.score === 10, JSON.stringify(manual.data));

  // 6) Stations: student requests, staff decides, student cannot decide
  const station = await call("/api/quran/stations", { method: "POST", token: studentA.token, body: { stage: "15", scheduled_for: today, memorized_amount: "15 حزبًا" } });
  check("student requests a sheikh station", station.status === 201 && station.data?.id, JSON.stringify(station.data));
  const stationId = station.data.id;

  const studentDecision = await call("/api/quran/stations/decision", { method: "POST", token: studentA.token, body: { id: stationId, status: "approved", score: 100 } });
  check("student cannot approve their own station", studentDecision.status === 403, JSON.stringify(studentDecision.data));

  const approve = await call("/api/quran/stations/decision", { method: "POST", token: admin, body: { id: stationId, status: "approved", score: 92, errors: 3, notes: "اختبار الاعتماد" } });
  check("staff approves the station with a score", approve.status === 200 && approve.data?.status === "approved" && approve.data?.grade === "ممتاز", JSON.stringify(approve.data));

  const badStage = await call("/api/quran/stations", { method: "POST", token: studentA.token, body: { stage: "20", scheduled_for: today } });
  check("invalid station stage is rejected", badStage.status === 400, JSON.stringify(badStage.data));

  // 7) Summary aggregates the day's work
  const summary = await call("/api/quran/summary", { token: studentA.token });
  check("summary counts only approved Quran work", summary.status === 200 && Number(summary.data?.totals?.hifz?.days) === 3 && Number(summary.data?.totals?.thabit?.days) === 1 && Number(summary.data?.totals?.ward?.days) === 5 && Number(summary.data?.pending?.hifz||0) === 0 && Number(summary.data?.pending?.thabit||0) === 0, JSON.stringify({totals:summary.data?.totals,pending:summary.data?.pending}));
  check("summary reports the approved station", Number(summary.data?.stations?.approved) === 1, JSON.stringify(summary.data?.stations));
  check("summary reports the completed makeup", Number(summary.data?.makeups?.done) === 1, JSON.stringify(summary.data?.makeups));
  check("summary reports an active streak", Number(summary.data?.streak) >= 1, JSON.stringify(summary.data?.streak));

  // 8) Staff scope: a teacher outside the group cannot read or write the path
  const teacherCreate = await call("/api/teachers", { method: "POST", token: admin, body: { name: "معلم اختبار القرآن " + RUN, username: "quran-teacher-1-" + RUN, password: "QuranTeacher#2026" } });
  check("create test teacher", teacherCreate.status === 201, JSON.stringify(teacherCreate.data));
  const teacherFirst = await login("quran-teacher-1-" + RUN, "QuranTeacher#2026");
  await call("/api/me/password", { method: "POST", token: teacherFirst.token, body: { current_password: "QuranTeacher#2026", new_password: "QuranTeacher#2026b" } });
  const teacher = (await login("quran-teacher-1-" + RUN, "QuranTeacher#2026b")).token;
  const teacherRead = await call("/api/quran/path?student_id=" + encodeURIComponent(studentA.id), { token: teacher });
  check("teacher outside the group cannot read the path", teacherRead.status === 403, JSON.stringify(teacherRead.data));
  const teacherDaily = await call("/api/quran/daily", { method: "POST", token: teacher, body: { student_id: studentA.id, kind: "ward", amount: 1 } });
  check("teacher outside the group cannot log a portion", teacherDaily.status === 403, JSON.stringify(teacherDaily.data));
  const teacherApproval = await call("/api/quran/daily/decision", { method: "POST", token: teacher, body: { student_id: studentA.id, entry_id: hifz.data.entry.id, decision: "approved" } });
  check("teacher outside the group cannot approve another student's Quran work", teacherApproval.status === 403, JSON.stringify(teacherApproval.data));

  const report = { base: BASE, failures, passed: results.filter(row => row.ok).length, total: results.length, results };
  const outputPath = process.env.QURAN_TEST_REPORT || "";
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
