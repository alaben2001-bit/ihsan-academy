// Local end-to-end checks for the student journey wizard and the honest store.
// Run against `wrangler dev` with a fresh local D1 database:
//   npx wrangler@4 dev --port 8788 --var BOOTSTRAP_SECRET:test-bootstrap-secret-1234
//   node scripts/journey-store-test.mjs
// The script only writes inside the local .wrangler D1 state.

const BASE = process.env.JOURNEY_TEST_BASE || "http://127.0.0.1:8788";
const BOOTSTRAP_SECRET = process.env.JOURNEY_BOOTSTRAP_SECRET || "test-bootstrap-secret-1234";
const ADMIN = { name: "مدير اختبار الرحلة", email: "admin@test.local", password: "TestPassword#2026Strong" };

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

async function makeTeacher(admin, name, username, password, groupId, groupName = null) {
  const create = await call("/api/teachers", { method: "POST", token: admin, body: { name, username, password } });
  if (create.status !== 201) throw new Error("teacher creation failed: " + JSON.stringify(create.data));
  const first = await login(username, password);
  if (!first.token) throw new Error("teacher login failed: " + JSON.stringify(first.data));
  const change = await call("/api/me/password", { method: "POST", token: first.token, body: { current_password: password, new_password: password + "b" } });
  if (change.status !== 200) throw new Error("teacher password change failed: " + JSON.stringify(change.data));
  const second = await login(username, password + "b");
  const teachers = await call("/api/teachers", { token: admin });
  const row = (teachers.data || []).find(teacher => teacher.username === username);
  if (!row) throw new Error("teacher row was not returned");
  if (groupId) {
    const assign = await call("/api/groups/" + encodeURIComponent(groupId), { method: "PATCH", token: admin, body: { name: groupName || "فوج اختبار الرحلة والمتجر " + RUN, teacher_id: row.id } });
    if (assign.status !== 200) throw new Error("group teacher assignment failed: " + JSON.stringify(assign.data));
  }
  return { id: row.id, token: second.token };
}

async function journeySave(token, key, value) {
  return call("/api/journey", { method: "POST", token, body: { key, value } });
}

async function main() {
  await waitForServer();

  // 1) Setup: admin, one group, two students, two teachers (inside/outside the group)
  const bootstrap = await call("/api/admin/bootstrap", { method: "POST", headers: { "x-bootstrap-secret": BOOTSTRAP_SECRET }, body: ADMIN });
  check("admin bootstrap (created or already exists)", [201, 409].includes(bootstrap.status), JSON.stringify(bootstrap.data));
  const adminLogin = await login(ADMIN.email, ADMIN.password);
  check("admin login returns a session token", adminLogin.status === 200 && adminLogin.token.length === 64, JSON.stringify(adminLogin.data));
  const admin = adminLogin.token;

  const group = await call("/api/groups", { method: "POST", token: admin, body: { name: "فوج اختبار الرحلة والمتجر " + RUN } });
  check("create test group", group.status === 201 && group.data?.id, JSON.stringify(group.data));
  const groupId = group.data.id;

  const studentA = await makeStudent(admin, groupId, "طالب الرحلة الأولى " + RUN, "journey-student-1-" + RUN, "JourneyStudent#2026");
  const studentB = await makeStudent(admin, groupId, "طالب الرحلة الثانية " + RUN, "journey-student-2-" + RUN, "JourneyStudent#2026");
  check("two student sessions are active", studentA.token.length === 64 && studentB.token.length === 64);
  const teacherInside = await makeTeacher(admin, "شيخ فوج الرحلة " + RUN, "journey-teacher-in-" + RUN, "JourneyTeacher#2026", groupId);
  const teacherOutside = await makeTeacher(admin, "شيخ خارج الفوج " + RUN, "journey-teacher-out-" + RUN, "JourneyTeacher#2026");
  check("teacher inside the group is assigned and can log in", teacherInside.token.length === 64);
  check("teacher outside the group can log in", teacherOutside.token.length === 64);

  const pointsBeforeJourney = await call("/api/points/summary", { token: studentA.token });
  check("student starts with no journey points", pointsBeforeJourney.status === 200 && Number(pointsBeforeJourney.data?.totals?.achievement || 0) === 0 && Number(pointsBeforeJourney.data?.totals?.store || 0) === 0, JSON.stringify(pointsBeforeJourney.data?.totals));

  // 2) An honest, empty store: no invented catalog
  const emptyStore = await call("/api/store/items", { token: studentA.token });
  check("student store read succeeds before any catalog", emptyStore.status === 200 && emptyStore.data?.recommendations, JSON.stringify(emptyStore.data));
  check("empty store is reported honestly", emptyStore.data?.recommendations?.empty === true && (emptyStore.data?.items || []).length === 0, JSON.stringify(emptyStore.data));
  check("empty store shows no affordable or locked fakes", (emptyStore.data?.recommendations?.affordable || []).length === 0 && (emptyStore.data?.recommendations?.locked || []).length === 0 && emptyStore.data?.recommendations?.nearest === null, JSON.stringify(emptyStore.data?.recommendations));
  if ((emptyStore.data?.items || []).length > 0) {
    console.error("FATAL: the journey/store suite needs a clean database with an empty store catalog. Run it before the other suites (journey → points → quran → backup → role → competitions) or on a dedicated clean D1.");
    process.exit(1);
  }

  // 3) Journey start, validation, isolation, and resumability
  const journeyStart = await call("/api/journey", { token: studentA.token });
  check("journey starts clean with eight questions", journeyStart.status === 200 && (journeyStart.data?.questions || []).length === 8 && Number(journeyStart.data?.answered) === 0 && journeyStart.data?.complete === false, JSON.stringify(journeyStart.data));
  check("journey reports the student still needs onboarding", journeyStart.data?.needs_onboarding === true && journeyStart.data?.enrolled === false, JSON.stringify(journeyStart.data));

  const badKey = await call("/api/journey", { method: "POST", token: studentA.token, body: { key: "unknown_question", value: "x" } });
  check("unknown journey question is rejected", badKey.status === 400, JSON.stringify(badKey.data));
  const badValue = await call("/api/journey", { method: "POST", token: studentA.token, body: { key: "memorized", value: "invented" } });
  check("answer outside the allowed options is rejected", badValue.status === 400, JSON.stringify(badValue.data));
  const adminStart = await call("/api/journey", { method: "POST", token: admin, body: { key: "memorized", value: "none" } });
  check("staff cannot answer a student journey for them", adminStart.status === 403, JSON.stringify(adminStart.data));
  const spoofStart = await call("/api/journey", { method: "POST", token: studentA.token, body: { student_id: studentB.id, key: "memorized", value: "none" } });
  check("student cannot open a journey for another student", spoofStart.status === 403, JSON.stringify(spoofStart.data));
  const crossJourney = await call("/api/journey?student_id=" + encodeURIComponent(studentB.id), { token: studentA.token });
  check("student cannot read another student's journey", crossJourney.status === 403, JSON.stringify(crossJourney.data));

  const firstAnswer = await journeySave(studentA.token, "memorized", "15_30");
  check("first journey answer is saved and returned", firstAnswer.status === 200 && Number(firstAnswer.data?.answered) === 1 && firstAnswer.data?.answers?.memorized === "15_30", JSON.stringify(firstAnswer.data));
  check("journey save response keeps the question list for the wizard", (firstAnswer.data?.questions || []).length === 8, JSON.stringify({ questions: (firstAnswer.data?.questions || []).length }));
  const resumed = await call("/api/journey", { token: studentA.token });
  check("journey resumes from the saved answer", Number(resumed.data?.answered) === 1 && resumed.data?.answers?.memorized === "15_30", JSON.stringify(resumed.data));

  await journeySave(studentB.token, "memorized", "none");
  const incompleteApply = await call("/api/journey/apply", { method: "POST", token: studentB.token, body: { variant: "light", acknowledge_over_budget: true } });
  check("applying before answering all questions is rejected", incompleteApply.status === 409, JSON.stringify(incompleteApply.data));

  const remaining = [
    ["riwaya", "hafs"],
    ["daily_minutes", "30"],
    ["goal", "increase"],
    ["mastery", "good"],
    ["difficulty", "none"],
    ["ward", "auto"],
    ["rest_day", "5"]
  ];
  let last = null;
  for (const [key, value] of remaining) last = await journeySave(studentA.token, key, value);
  check("all eight answers complete the journey", last?.status === 200 && last.data?.complete === true && Number(last.data?.answered) === 8, JSON.stringify(last?.data));
  const recommendation = last?.data?.recommendation;
  check("recommendation exposes three plan variants", (recommendation?.variants || []).length === 3 && recommendation?.recommended_variant, JSON.stringify(recommendation));
  check("recommendation maps the declared memorization to category 15", recommendation?.category === "15" && recommendation?.recommended?.hifz_category === "15" && recommendation?.recommended?.thabit_amount === 0.125, JSON.stringify(recommendation?.recommended));
  check("recommendation labels the thabit reference as an unapproved proposal", recommendation?.thabit_reference_status === "proposal" && recommendation?.approval_required === true, JSON.stringify(recommendation));
  check("recommendation prices the plan in time, not money", recommendation?.price?.money === "لا رسوم مالية" && recommendation?.price?.days_per_week === 5 && Number(recommendation?.price?.daily_minutes) > 0, JSON.stringify(recommendation?.price));
  check("a 30-minute budget selects the light plan after all variants exceed it", recommendation?.recommended_variant === "light" && Number(recommendation?.recommended?.over_by) > 0, JSON.stringify({ variant: recommendation?.recommended_variant, over_by: recommendation?.recommended?.over_by }));

  const overBudget = await call("/api/journey/apply", { method: "POST", token: studentA.token, body: { variant: "balanced" } });
  check("over-budget plan requires explicit acknowledgement", overBudget.status === 409, JSON.stringify(overBudget.data));

  const apply = await call("/api/journey/apply", { method: "POST", token: studentA.token, body: { variant: "light", acknowledge_over_budget: true, rest_day: null, note: "بدأت بالخطة الخفيفة وأريد مراجعة الشيخ" } });
  check("student applies the light plan after acknowledgement", apply.status === 200 && apply.data?.status === "applied" && apply.data?.approval_status === "pending", JSON.stringify(apply.data));
  check("applying creates the existing Quran path and plan", apply.data?.path?.hifz_plan === "plan_c" && apply.data?.path?.hifz_category === "15" && apply.data?.plan?.path_id === "khatma", JSON.stringify({ path: apply.data?.path, plan: apply.data?.plan }));
  check("explicit no-rest-day is preserved instead of the default", apply.data?.path?.rest_day === null && apply.data?.applied_plan?.rest_day === null, JSON.stringify({ pathRest: apply.data?.path?.rest_day, planRest: apply.data?.applied_plan?.rest_day }));

  const pathAfter = await call("/api/quran/path", { token: studentA.token });
  check("the Quran path reports enrollment after applying", pathAfter.status === 200 && pathAfter.data?.enrolled === true && pathAfter.data?.path?.hifz_plan === "plan_c", JSON.stringify(pathAfter.data));
  const planAfter = await call("/api/quran/plan", { token: studentA.token });
  check("the weekly Quran plan is saved through the existing plan API", planAfter.status === 200 && planAfter.data?.path_id === "khatma" && String(planAfter.data?.weekly_goal || "").includes("حفظ"), JSON.stringify(planAfter.data));

  const duplicateStart = await call("/api/journey", { method: "POST", token: studentA.token, body: { key: "rest_day", value: "5" } });
  check("an applied journey cannot be edited as a new draft", duplicateStart.status === 409, JSON.stringify(duplicateStart.data));
  const duplicateApply = await call("/api/journey/apply", { method: "POST", token: studentA.token, body: { variant: "light", acknowledge_over_budget: true } });
  check("an applied journey cannot be applied twice", duplicateApply.status === 409, JSON.stringify(duplicateApply.data));

  // 4) Review permissions and the changes-requested loop
  const studentReview = await call("/api/journey/review?status=pending", { token: studentA.token });
  check("students cannot list journey reviews", studentReview.status === 403, JSON.stringify(studentReview.data));
  const studentDecision = await call("/api/journey/review", { method: "POST", token: studentA.token, body: { student_id: studentA.id, decision: "approved" } });
  check("students cannot approve their own plan", studentDecision.status === 403, JSON.stringify(studentDecision.data));

  const outsideList = await call("/api/journey/review?status=pending", { token: teacherOutside.token });
  check("teacher outside the group sees no journey from it", outsideList.status === 200 && !(outsideList.data?.items || []).some(row => row.student_id === studentA.id), JSON.stringify(outsideList.data));
  const outsideDecision = await call("/api/journey/review", { method: "POST", token: teacherOutside.token, body: { student_id: studentA.id, decision: "approved" } });
  check("teacher outside the group cannot approve the plan", outsideDecision.status === 403, JSON.stringify(outsideDecision.data));

  const insideList = await call("/api/journey/review?status=pending", { token: teacherInside.token });
  const insideRow = (insideList.data?.items || []).find(row => row.student_id === studentA.id);
  check("teacher inside the group sees the pending journey", insideList.status === 200 && insideRow, JSON.stringify(insideList.data));
  check("review includes the student's eight answered questions", (insideRow?.answers_summary || []).length === 8, JSON.stringify(insideRow?.answers_summary));
  check("review includes plan cost and budget fit", Number(insideRow?.plan?.estimated_daily_minutes) > 0 && insideRow?.plan?.fits === false, JSON.stringify(insideRow?.plan));

  const noNote = await call("/api/journey/review", { method: "POST", token: teacherInside.token, body: { student_id: studentA.id, decision: "changes_requested" } });
  check("changes requested without a note is rejected", noNote.status === 400, JSON.stringify(noNote.data));
  const changes = await call("/api/journey/review", { method: "POST", token: teacherInside.token, body: { student_id: studentA.id, decision: "changes_requested", note: "ابدأ بوجه واحد وثبّت قبل الزيادة" } });
  check("teacher requests a documented change", changes.status === 200 && changes.data?.approval_status === "changes_requested" && changes.data?.status === "in_progress", JSON.stringify(changes.data));

  const afterChanges = await call("/api/journey", { token: studentA.token });
  check("student sees the review note and can revise", afterChanges.data?.approval_status === "changes_requested" && String(afterChanges.data?.review_note || "").includes("ثبّت"), JSON.stringify(afterChanges.data));

  const reviseAnswer = await journeySave(studentA.token, "rest_day", "5");
  check("student can revise answers after changes are requested", reviseAnswer.status === 200 && reviseAnswer.data?.complete === true, JSON.stringify(reviseAnswer.data));
  const reapply = await call("/api/journey/apply", { method: "POST", token: studentA.token, body: { variant: "light", acknowledge_over_budget: true, rest_day: 5 } });
  check("student reapplies with the revised rest day", reapply.status === 200 && reapply.data?.approval_status === "pending" && reapply.data?.applied_plan?.rest_day === 5 && Number(reapply.data?.revision) === 2, JSON.stringify(reapply.data));

  const approve = await call("/api/journey/review", { method: "POST", token: teacherInside.token, body: { student_id: studentA.id, decision: "approved", note: "اعتمدت الخطة مع المتابعة" } });
  check("teacher approves the revised plan", approve.status === 200 && approve.data?.approval_status === "approved" && approve.data?.status === "applied", JSON.stringify(approve.data));
  const approvedList = await call("/api/journey/review?status=approved", { token: teacherInside.token });
  check("approved tab lists the approved journey", (approvedList.data?.items || []).some(row => row.student_id === studentA.id), JSON.stringify(approvedList.data));
  const pathApproved = await call("/api/quran/path", { token: studentA.token });
  check("approval does not overwrite the saved rest day", pathApproved.data?.path?.rest_day === 5, JSON.stringify(pathApproved.data?.path));

  const pointsAfterJourney = await call("/api/points/summary", { token: studentA.token });
  check("journey approval does not create hidden economy points", Number(pointsAfterJourney.data?.totals?.achievement || 0) === Number(pointsBeforeJourney.data?.totals?.achievement || 0) && Number(pointsAfterJourney.data?.totals?.store || 0) === Number(pointsBeforeJourney.data?.totals?.store || 0), JSON.stringify({ before: pointsBeforeJourney.data?.totals, after: pointsAfterJourney.data?.totals }));

  // 5) Store catalog: real items only, honest availability, stock and limits
  const badCost = await call("/api/store/items", { method: "POST", token: admin, body: { name: "مادة بتكلفة صفر", cost: 0 } });
  check("store item with a zero cost is rejected", badCost.status === 400, JSON.stringify(badCost.data));
  const badStock = await call("/api/store/items", { method: "POST", token: admin, body: { name: "مادة بمخزون سالب", cost: 10, stock: -1 } });
  check("store item with negative stock is rejected", badStock.status === 400, JSON.stringify(badStock.data));
  const teacherCreateItem = await call("/api/store/items", { method: "POST", token: teacherInside.token, body: { name: "مادة من غير المدير", cost: 10 } });
  check("only the admin can add store items", teacherCreateItem.status === 403, JSON.stringify(teacherCreateItem.data));

  const affordable = await call("/api/store/items", { method: "POST", token: admin, body: { name: "مصحف اختبار " + RUN, description: "مكافأة اختبار محلية", cost: 20, stock: 2, max_per_student: 1, icon: "📖", sort_order: 1 } });
  const expensive = await call("/api/store/items", { method: "POST", token: admin, body: { name: "هدية كبرى اختبار " + RUN, cost: 1000, stock: 5, sort_order: 2 } });
  const soldOutItem = await call("/api/store/items", { method: "POST", token: admin, body: { name: "مادة نافدة اختبار " + RUN, cost: 5, stock: 0, sort_order: 3 } });
  const hiddenItem = await call("/api/store/items", { method: "POST", token: admin, body: { name: "مادة مخفية اختبار " + RUN, cost: 1, stock: 9, active: false, sort_order: 4 } });
  check("admin creates real store items", [affordable, expensive, soldOutItem, hiddenItem].every(result => result.status === 201 && result.data?.item?.id), JSON.stringify([affordable.data, expensive.data, soldOutItem.data, hiddenItem.data]));
  const affordableId = affordable.data.item.id, expensiveId = expensive.data.item.id, soldOutId = soldOutItem.data.item.id, hiddenId = hiddenItem.data.item.id;

  const catalog = await call("/api/store/items", { token: studentA.token });
  const catalogIds = (catalog.data?.items || []).map(item => item.id);
  check("student catalog hides inactive items", catalog.status === 200 && !catalogIds.includes(hiddenId) && catalogIds.includes(affordableId), JSON.stringify(catalogIds));
  check("sold-out items are reported but not offered", (catalog.data?.recommendations?.sold_out || []).includes(soldOutItem.data.item.name) && !(catalog.data?.recommendations?.affordable || []).some(item => item.id === soldOutId), JSON.stringify(catalog.data?.recommendations));
  check("with a zero balance only the real nearest item is shown", (catalog.data?.recommendations?.affordable || []).length === 0 && catalog.data?.recommendations?.nearest?.id === affordableId && Number(catalog.data?.recommendations?.nearest?.missing) === 20, JSON.stringify(catalog.data?.recommendations));

  const award = await call("/api/points/award", { method: "POST", token: admin, body: { student_id: studentA.id, achievement_points: 100, store_points: 50, reason: "اختبار الرحلة والمتجر", request_id: "journey-store-award-" + RUN } });
  check("store balance is funded through the existing points ledger", award.status === 201 && Number(award.data?.totals?.store) === 50 && Number(award.data?.totals?.achievement) === 100, JSON.stringify(award.data));

  const funded = await call("/api/store/items", { token: studentA.token });
  check("funded student sees the affordable real item", (funded.data?.recommendations?.affordable || []).some(item => item.id === affordableId), JSON.stringify(funded.data?.recommendations));
  check("nearest locked item reports the exact missing balance", funded.data?.recommendations?.nearest?.id === expensiveId && Number(funded.data?.recommendations?.nearest?.missing) === 950, JSON.stringify(funded.data?.recommendations?.nearest));

  const redeemSoldOut = await call("/api/store/redeem", { method: "POST", token: studentA.token, body: { item_id: soldOutId } });
  check("redeeming a sold-out item is rejected", redeemSoldOut.status === 409, JSON.stringify(redeemSoldOut.data));
  const redeemHidden = await call("/api/store/redeem", { method: "POST", token: studentA.token, body: { item_id: hiddenId } });
  check("redeeming a hidden item is rejected", redeemHidden.status === 404, JSON.stringify(redeemHidden.data));
  const redeemExpensive = await call("/api/store/redeem", { method: "POST", token: studentA.token, body: { item_id: expensiveId } });
  check("redeeming beyond the balance is rejected", redeemExpensive.status === 409, JSON.stringify(redeemExpensive.data));

  const redeem = await call("/api/store/redeem", { method: "POST", token: studentA.token, body: { item_id: affordableId, note: "أحتاج المصحف للمراجعة" } });
  check("student requests a real in-stock reward", redeem.status === 201 && redeem.data?.redemption?.status === "pending" && Number(redeem.data?.balance) === 30, JSON.stringify(redeem.data));
  const redemptionId = redeem.data?.redemption?.id;

  const afterRedeem = await call("/api/store/items", { token: studentA.token });
  const affordableAfter = (afterRedeem.data?.items || []).find(item => item.id === affordableId);
  check("redeeming updates the per-student used count", Number(affordableAfter?.used) === 1 && Number(affordableAfter?.stock) === 1, JSON.stringify(affordableAfter));
  check("maxed item disappears from redeemable recommendations", (afterRedeem.data?.recommendations?.maxed || []).includes(affordableAfter?.name) && !(afterRedeem.data?.recommendations?.affordable || []).some(item => item.id === affordableId), JSON.stringify(afterRedeem.data?.recommendations));
  const redeemAgain = await call("/api/store/redeem", { method: "POST", token: studentA.token, body: { item_id: affordableId } });
  check("redeeming beyond max_per_student is rejected", redeemAgain.status === 409, JSON.stringify(redeemAgain.data));

  const studentDecide = await call("/api/store/redemptions/" + encodeURIComponent(redemptionId) + "/decision", { method: "POST", token: studentA.token, body: { decision: "approved" } });
  check("students cannot decide their own redemption", studentDecide.status === 403, JSON.stringify(studentDecide.data));
  const approveRedeem = await call("/api/store/redemptions/" + encodeURIComponent(redemptionId) + "/decision", { method: "POST", token: teacherInside.token, body: { decision: "approved", note: "متوفر" } });
  check("teacher inside the group approves the redemption", approveRedeem.status === 200 && approveRedeem.data?.status === "approved", JSON.stringify(approveRedeem.data));
  const fulfillRedeem = await call("/api/store/redemptions/" + encodeURIComponent(redemptionId) + "/decision", { method: "POST", token: teacherInside.token, body: { decision: "fulfilled", note: "سُلّم" } });
  check("teacher marks the redemption as fulfilled", fulfillRedeem.status === 200 && fulfillRedeem.data?.status === "fulfilled", JSON.stringify(fulfillRedeem.data));
  const refulfill = await call("/api/store/redemptions/" + encodeURIComponent(redemptionId) + "/decision", { method: "POST", token: teacherInside.token, body: { decision: "rejected", note: "محاولة إعادة قرار" } });
  check("a fulfilled redemption cannot be changed", refulfill.status === 409, JSON.stringify(refulfill.data));
  const studentRedemptions = await call("/api/store/redemptions", { token: studentA.token });
  check("student sees the final redemption status", (studentRedemptions.data || []).some(row => row.id === redemptionId && row.status === "fulfilled"), JSON.stringify(studentRedemptions.data));

  // 6) Rejection refunds the balance and restores stock
  const awardB = await call("/api/points/award", { method: "POST", token: admin, body: { student_id: studentB.id, achievement_points: 0, store_points: 20, reason: "اختبار استرجاع الرفض", request_id: "journey-store-refund-" + RUN } });
  check("second student is funded for the refund test", awardB.status === 201 && Number(awardB.data?.totals?.store) === 20, JSON.stringify(awardB.data));
  const refundItem = await call("/api/store/items", { method: "POST", token: admin, body: { name: "مادة استرجاع اختبار " + RUN, cost: 10, stock: 2, sort_order: 5 } });
  const refundItemId = refundItem.data?.item?.id;
  check("refund test item is created with stock", refundItem.status === 201 && refundItemId, JSON.stringify(refundItem.data));
  const redeemB = await call("/api/store/redeem", { method: "POST", token: studentB.token, body: { item_id: refundItemId } });
  check("second student redeems and stock decreases", redeemB.status === 201 && Number(redeemB.data?.balance) === 10, JSON.stringify(redeemB.data));
  const refundRedemptionId = redeemB.data?.redemption?.id;
  const rejectNoNote = await call("/api/store/redemptions/" + encodeURIComponent(refundRedemptionId) + "/decision", { method: "POST", token: teacherInside.token, body: { decision: "rejected" } });
  check("rejecting a redemption without a reason is rejected", rejectNoNote.status === 400, JSON.stringify(rejectNoNote.data));
  const reject = await call("/api/store/redemptions/" + encodeURIComponent(refundRedemptionId) + "/decision", { method: "POST", token: teacherInside.token, body: { decision: "rejected", note: "غير متوفر حاليًا" } });
  check("teacher rejects the redemption with a documented reason", reject.status === 200 && reject.data?.status === "rejected", JSON.stringify(reject.data));
  const balanceB = await call("/api/points/summary", { token: studentB.token });
  check("rejection returns the reserved store balance", Number(balanceB.data?.totals?.store) === 20, JSON.stringify(balanceB.data?.totals));
  const refundCatalog = await call("/api/store/items", { token: studentB.token });
  const refundRow = (refundCatalog.data?.items || []).find(item => item.id === refundItemId);
  check("rejection restores the item stock", Number(refundRow?.stock) === 2 && Number(refundRow?.used) === 0, JSON.stringify(refundRow));

  // 7) Admin edit/hide lifecycle and student visibility
  const edit = await call("/api/store/items", { method: "POST", token: admin, body: { id: affordableId, name: "مصحف اختبار معدل " + RUN, description: "تعديل اختبار", cost: 30, stock: 5, max_per_student: 2, active: true, icon: "📖", sort_order: 1 } });
  check("admin edits an existing store item in place", edit.status === 200 && Number(edit.data?.item?.cost) === 30 && Number(edit.data?.item?.stock) === 5, JSON.stringify(edit.data));
  const editedCatalog = await call("/api/store/items", { token: studentA.token });
  const editedRow = (editedCatalog.data?.items || []).find(item => item.id === affordableId);
  check("student sees the edited cost and stock", Number(editedRow?.cost) === 30 && Number(editedRow?.stock) === 5, JSON.stringify(editedRow));

  const hide = await call("/api/store/items", { method: "POST", token: admin, body: { id: affordableId, name: "مصحف اختبار معدل " + RUN, description: "تعديل اختبار", cost: 30, stock: 5, max_per_student: 2, active: false, icon: "📖", sort_order: 1 } });
  check("admin hides an item from students", hide.status === 200 && Number(hide.data?.item?.active) === 0, JSON.stringify(hide.data));
  const hiddenCatalog = await call("/api/store/items", { token: studentA.token });
  check("hidden item is absent from the student catalog", !(hiddenCatalog.data?.items || []).some(item => item.id === affordableId), JSON.stringify((hiddenCatalog.data?.items || []).map(item => item.id)));
  const adminCatalog = await call("/api/store/items", { token: admin });
  check("admin catalog still includes hidden items for management", (adminCatalog.data?.items || []).some(item => item.id === affordableId && Number(item.active) === 0), JSON.stringify((adminCatalog.data?.items || []).map(item => ({ id: item.id, active: item.active }))));

  const applyVariantInvalid = await call("/api/journey/apply", { method: "POST", token: studentB.token, body: { variant: "unknown" } });
  check("unknown plan variant is rejected", applyVariantInvalid.status === 409 || applyVariantInvalid.status === 400, JSON.stringify(applyVariantInvalid.data));

  // 8) Moving a student between groups moves plan-review scope to the current sheikh
  const groupB = await call("/api/groups", { method: "POST", token: admin, body: { name: "فوج نقل الرحلة " + RUN } });
  check("create a destination group for the transfer", groupB.status === 201 && groupB.data?.id, JSON.stringify(groupB.data));
  const groupBId = groupB.data.id;
  const teacherNew = await makeTeacher(admin, "شيخ الفوج الجديد " + RUN, "journey-teacher-new-" + RUN, "JourneyTeacher#2026", groupBId, groupB.data.name);
  check("new group teacher can log in", teacherNew.token.length === 64);
  const move = await call("/api/students/" + encodeURIComponent(studentA.id), { method: "PATCH", token: admin, body: { group_id: groupBId } });
  check("admin moves the student to the new group", move.status === 200 && move.data?.group_id === groupBId, JSON.stringify(move.data));

  const oldGroupReview = await call("/api/journey/review?status=approved", { token: teacherInside.token });
  check("old group teacher no longer sees the transferred plan", oldGroupReview.status === 200 && !(oldGroupReview.data?.items || []).some(row => row.student_id === studentA.id), JSON.stringify(oldGroupReview.data));
  const oldGroupDecision = await call("/api/journey/review", { method: "POST", token: teacherInside.token, body: { student_id: studentA.id, decision: "approved" } });
  check("old group teacher cannot decide the transferred plan", oldGroupDecision.status === 403, JSON.stringify(oldGroupDecision.data));
  const newGroupReview = await call("/api/journey/review?status=approved", { token: teacherNew.token });
  const transferredRow = (newGroupReview.data?.items || []).find(row => row.student_id === studentA.id);
  check("new group teacher sees the transferred plan with the current group", newGroupReview.status === 200 && transferredRow && transferredRow.group_id === groupBId && transferredRow.group_name === groupB.data.name, JSON.stringify(newGroupReview.data));
  const newGroupDecision = await call("/api/journey/review", { method: "POST", token: teacherNew.token, body: { student_id: studentA.id, decision: "approved", note: "اعتماد بعد انتقال الطالب" } });
  check("new group teacher can decide the transferred plan", newGroupDecision.status === 200 && newGroupDecision.data?.approval_status === "approved", JSON.stringify(newGroupDecision.data));

  const report = { base: BASE, failures, passed: results.filter(row => row.ok).length, total: results.length, results };
  const outputPath = process.env.JOURNEY_TEST_REPORT || "";
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
