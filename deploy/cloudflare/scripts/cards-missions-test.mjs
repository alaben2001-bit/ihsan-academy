// Local end-to-end checks for V71: student cards (three QR kinds), card scans,
// mission claims, store redemption idempotency, and card-scan rate limiting.
// Run against `wrangler dev` (local D1):
//   npx wrangler@4 dev --port 8788 --var BOOTSTRAP_SECRET:test-bootstrap-secret-1234
//   node scripts/cards-missions-test.mjs
// The script only writes inside the local .wrangler D1 state.

const BASE = process.env.CARDS_TEST_BASE || "http://127.0.0.1:8788";
const BOOTSTRAP_SECRET = process.env.CARDS_BOOTSTRAP_SECRET || "test-bootstrap-secret-1234";
const ADMIN = { name: "مدير اختبار البطاقات", email: "admin@test.local", password: "TestPassword#2026Strong" };

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
  const setCookie = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  return { status: response.status, data, setCookie };
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
    const assign = await call("/api/groups/" + encodeURIComponent(groupId), { method: "PATCH", token: admin, body: { name: groupName || "فوج اختبار البطاقات " + RUN, teacher_id: row.id } });
    if (assign.status !== 200) throw new Error("group teacher assignment failed: " + JSON.stringify(assign.data));
  }
  return { id: row.id, token: second.token };
}

function parseScanLink(link) {
  const marker = "#scan=";
  const index = String(link || "").indexOf(marker);
  if (index < 0) return null;
  const value = String(link).slice(index + marker.length);
  const parts = value.split(".");
  if (parts.length < 3) return null;
  return { kind: parts[0], cardId: parts[1], secret: parts.slice(2).join(".") };
}

async function resolveCard(kind, cardId, secret, token = "", task = "attendance") {
  return call("/api/cards/resolve", { method: "POST", token, body: { kind, task, card_id: cardId, secret } });
}

async function main() {
  await waitForServer();

  // 1) Setup: admin, one group with a student and a teacher, plus an outside teacher.
  const bootstrap = await call("/api/admin/bootstrap", { method: "POST", headers: { "x-bootstrap-secret": BOOTSTRAP_SECRET }, body: ADMIN });
  check("admin bootstrap (created or already exists)", [201, 409].includes(bootstrap.status), JSON.stringify(bootstrap.data));
  const adminLogin = await login(ADMIN.email, ADMIN.password);
  check("admin login returns a session token", adminLogin.status === 200 && adminLogin.token.length === 64, JSON.stringify(adminLogin.data));
  const admin = adminLogin.token;

  const group = await call("/api/groups", { method: "POST", token: admin, body: { name: "فوج اختبار البطاقات " + RUN } });
  check("create test group", group.status === 201 && group.data?.id, JSON.stringify(group.data));
  const groupId = group.data.id;

  const student = await makeStudent(admin, groupId, "طالب البطاقات " + RUN, "cards-student-" + RUN, "CardsStudent#2026");
  check("student session is active", student.token.length === 64);
  const teacherInside = await makeTeacher(admin, "شيخ فوج البطاقات " + RUN, "cards-teacher-in-" + RUN, "CardsTeacher#2026", groupId, group.data.name);
  const teacherOutside = await makeTeacher(admin, "شيخ خارج فوج البطاقات " + RUN, "cards-teacher-out-" + RUN, "CardsTeacher#2026");
  check("teacher inside the group can log in", teacherInside.token.length === 64);
  check("teacher outside the group can log in", teacherOutside.token.length === 64);

  // 2) Card creation: exactly one card per student, three independent tokens.
  const beforeCard = await call("/api/student-cards?student_id=" + encodeURIComponent(student.id), { token: admin });
  check("student onboarding provisions exactly one card", beforeCard.status === 200 && beforeCard.data?.card?.id === student.id, JSON.stringify(beforeCard.data));
  const created = await call("/api/student-cards", { method: "POST", token: admin, body: { student_id: student.id } });
  check("opening the provisioned card does not create a duplicate", [200, 201].includes(created.status) && created.data?.card?.id === student.id, JSON.stringify(created.data));
  check("card id equals the student id (one card per student)", created.data?.card?.id === student.id, JSON.stringify(created.data?.card));
  const kinds = Object.keys(created.data?.card?.tokens || {});
  check("card exposes exactly the three QR kinds", kinds.length === 3 && ["add_points", "profile", "login"].every(kind => kinds.includes(kind)), JSON.stringify(kinds));
  check("all three QR links are active", ["add_points", "profile", "login"].every(kind => typeof created.data?.links?.[kind] === "string" && created.data.links[kind].includes("#scan=" + kind + "." + student.id + ".")), JSON.stringify(created.data?.links));
  const again = await call("/api/student-cards", { method: "POST", token: admin, body: { student_id: student.id } });
  check("opening an existing card does not mint a second one", again.status === 200 && again.data?.created === false && again.data?.card?.id === student.id, JSON.stringify(again.data));

  const loginLink = parseScanLink(created.data.links.login);
  const profileLink = parseScanLink(created.data.links.profile);
  const addPointsLink = parseScanLink(created.data.links.add_points);
  check("scan links parse into kind/card/secret", loginLink && profileLink && addPointsLink && loginLink.cardId === student.id, JSON.stringify({ loginLink, profileLink, addPointsLink }));

  // 3) Login QR is anonymous, never logs in, and never returns a session.
  const anonymousLogin = await resolveCard("login", loginLink.cardId, loginLink.secret);
  check("login QR resolves without a session", anonymousLogin.status === 200 && anonymousLogin.data?.requires_password === true, JSON.stringify(anonymousLogin.data));
  check("login QR returns the name and username only", Boolean(anonymousLogin.data?.student?.name) && Boolean(anonymousLogin.data?.student?.username) && anonymousLogin.data?.student?.id === undefined, JSON.stringify(anonymousLogin.data?.student));
  check("login QR never issues a session cookie", anonymousLogin.setCookie.length === 0, JSON.stringify(anonymousLogin.setCookie));
  const wrongSecret = await resolveCard("login", loginLink.cardId, "0".repeat(48));
  check("a wrong secret is rejected", wrongSecret.status === 404, JSON.stringify(wrongSecret.data));
  const unknownKind = await resolveCard("owner", loginLink.cardId, loginLink.secret);
  check("an unknown QR kind is rejected", unknownKind.status === 400, JSON.stringify(unknownKind.data));

  // 4) Profile and add_points QRs require auth and group scope.
  const anonymousProfile = await resolveCard("profile", profileLink.cardId, profileLink.secret);
  check("profile QR is rejected without a session", anonymousProfile.status === 401, JSON.stringify(anonymousProfile.data));
  const outsideProfile = await resolveCard("profile", profileLink.cardId, profileLink.secret, teacherOutside.token);
  check("profile QR is rejected outside the group", outsideProfile.status === 403, JSON.stringify(outsideProfile.data));
  const insideProfile = await resolveCard("profile", profileLink.cardId, profileLink.secret, teacherInside.token);
  check("profile QR resolves for the group sheikh", insideProfile.status === 200 && insideProfile.data?.student?.id === student.id, JSON.stringify(insideProfile.data));
  const studentProfile = await resolveCard("profile", profileLink.cardId, profileLink.secret, student.token);
  check("profile QR resolves for the student themselves", studentProfile.status === 200 && studentProfile.data?.student?.id === student.id, JSON.stringify(studentProfile.data));
  const studentAddPoints = await resolveCard("add_points", addPointsLink.cardId, addPointsLink.secret, student.token);
  check("add_points QR is rejected for the student", studentAddPoints.status === 403, JSON.stringify(studentAddPoints.data));
  const beforeScanPoints = await call("/api/points/summary?student_id=" + encodeURIComponent(student.id), { token: admin });
  const teacherAddPoints = await resolveCard("add_points", addPointsLink.cardId, addPointsLink.secret, teacherInside.token);
  const afterScanPoints = await call("/api/points/summary?student_id=" + encodeURIComponent(student.id), { token: admin });
  check("add_points QR resolves for the group sheikh", teacherAddPoints.status === 200 && teacherAddPoints.data?.next === "points", JSON.stringify(teacherAddPoints.data));
  check("one card scan automatically records attendance and awards 30 points", teacherAddPoints.data?.attendance?.status === "present" && Number(afterScanPoints.data?.totals?.balance || 0) - Number(beforeScanPoints.data?.totals?.balance || 0) === 30, JSON.stringify({ attendance: teacherAddPoints.data?.attendance, before: beforeScanPoints.data?.totals, after: afterScanPoints.data?.totals }));
  const repeatScan = await resolveCard("add_points", addPointsLink.cardId, addPointsLink.secret, teacherInside.token);
  const afterRepeatScanPoints = await call("/api/points/summary?student_id=" + encodeURIComponent(student.id), { token: admin });
  check("repeated scan the same day does not award duplicate attendance points", repeatScan.status === 200 && Number(afterRepeatScanPoints.data?.totals?.balance || 0) === Number(afterScanPoints.data?.totals?.balance || 0), JSON.stringify(afterRepeatScanPoints.data?.totals));
  const beforeHifzPoints = await call("/api/points/summary?student_id=" + encodeURIComponent(student.id), { token: admin });
  const hifzScan = await resolveCard("add_points", addPointsLink.cardId, addPointsLink.secret, teacherInside.token, "hifz");
  const afterHifzPoints = await call("/api/points/summary?student_id=" + encodeURIComponent(student.id), { token: admin });
  check("memorization scan awards 20 points without marking attendance again", hifzScan.status === 200 && Array.isArray(hifzScan.data?.hifz_awards) && hifzScan.data.hifz_awards.some(x => x.status === "awarded") && Number(afterHifzPoints.data?.totals?.balance || 0) - Number(beforeHifzPoints.data?.totals?.balance || 0) === 20 && hifzScan.data?.attendance === null, JSON.stringify({awards:hifzScan.data?.hifz_awards,attendance:hifzScan.data?.attendance,before:beforeHifzPoints.data?.totals,after:afterHifzPoints.data?.totals}));
  const hifzRepeat = await resolveCard("add_points", addPointsLink.cardId, addPointsLink.secret, teacherInside.token, "hifz");
  const afterHifzRepeat = await call("/api/points/summary?student_id=" + encodeURIComponent(student.id), { token: admin });
  check("repeated memorization scan does not duplicate 20 points", hifzRepeat.status === 200 && Number(afterHifzRepeat.data?.totals?.balance || 0) === Number(afterHifzPoints.data?.totals?.balance || 0), JSON.stringify(afterHifzRepeat.data?.totals));
  const adminAddPoints = await resolveCard("add_points", addPointsLink.cardId, addPointsLink.secret, admin);
  check("add_points QR resolves for the administrator", adminAddPoints.status === 200 && adminAddPoints.data?.next === "points", JSON.stringify(adminAddPoints.data));

  // 5) Reissue invalidates the previous secret; revoke disables one kind only.
  const reissued = await call("/api/student-cards/" + encodeURIComponent(student.id) + "/reissue", { method: "POST", token: admin, body: { kind: "login" } });
  const newLoginLink = parseScanLink(reissued.data?.links?.login);
  check("reissue returns a fresh login link", reissued.status === 200 && newLoginLink && newLoginLink.secret !== loginLink.secret, JSON.stringify(reissued.data));
  const oldLogin = await resolveCard("login", loginLink.cardId, loginLink.secret);
  check("the previous login secret no longer resolves", oldLogin.status === 404, JSON.stringify(oldLogin.data));
  const newLogin = await resolveCard("login", newLoginLink.cardId, newLoginLink.secret);
  check("the new login secret resolves", newLogin.status === 200 && newLogin.data?.requires_password === true, JSON.stringify(newLogin.data));
  const revoked = await call("/api/student-cards/" + encodeURIComponent(student.id) + "/revoke", { method: "POST", token: admin, body: { kind: "profile", reason: "اختبار إلغاء الرمز" } });
  check("revoke disables only the requested kind", revoked.status === 200 && revoked.data?.card?.tokens?.profile?.active === false && revoked.data?.card?.tokens?.login?.active === true, JSON.stringify(revoked.data?.card?.tokens));
  const revokedProfile = await resolveCard("profile", profileLink.cardId, profileLink.secret, teacherInside.token);
  check("a revoked profile secret is rejected", revokedProfile.status === 404, JSON.stringify(revokedProfile.data));
  const shortReason = await call("/api/student-cards/" + encodeURIComponent(student.id) + "/revoke", { method: "POST", token: admin, body: { kind: "login", reason: "" } });
  check("revoke requires a written reason", shortReason.status === 400, JSON.stringify(shortReason.data));

  // 6) Bulk creation and print for a whole group.
  const bulk = await call("/api/student-cards/bulk", { method: "POST", token: admin, body: { group_id: groupId } });
  check("bulk card creation covers the group", bulk.status === 200 && bulk.data?.count >= 1 && (bulk.data?.cards || []).some(row => row.student.id === student.id), JSON.stringify({ count: bulk.data?.count }));
  const studentBulk = await call("/api/student-cards/bulk", { method: "POST", token: student.token, body: { group_id: groupId } });
  check("students cannot bulk-print cards", studentBulk.status === 403, JSON.stringify(studentBulk.data));
  const outsideBulk = await call("/api/student-cards/bulk", { method: "POST", token: teacherOutside.token, body: { group_id: groupId } });
  check("an outside teacher cannot bulk-print the group", outsideBulk.status === 403, JSON.stringify(outsideBulk.data));
  const print = await call("/api/student-cards/" + encodeURIComponent(student.id) + "/print", { token: admin });
  check("print endpoint returns the card and links", print.status === 200 && print.data?.card?.id === student.id && Boolean(print.data?.links), JSON.stringify(print.data?.card));

  // 7) Missions are derived from real facts; claims use the existing points engine.
  const missions = await call("/api/missions", { token: student.token });
  check("missions load five story milestones and four daily missions", missions.status === 200 && (missions.data?.story || []).length === 5 && (missions.data?.side || []).length === 4, JSON.stringify({ story: (missions.data?.story || []).length, side: (missions.data?.side || []).length }));
  check("attendance mission reflects the automatic QR scan", missions.data?.side?.find(item => item.id === "side-attendance")?.done === true && missions.data?.side?.find(item => item.id === "side-attendance")?.claimable === true, JSON.stringify(missions.data?.side));
  check("unearned daily missions remain incomplete", missions.data?.side?.filter(item => item.id !== "side-attendance").every(item => item.done === false && item.claimable === false), JSON.stringify(missions.data?.side));
  const notDoneClaim = await call("/api/missions/claim", { method: "POST", token: student.token, body: { mission_id: "side-quran" } });
  check("claiming an incomplete mission is refused", notDoneClaim.status === 409, JSON.stringify(notDoneClaim.data));
  const unknownMission = await call("/api/missions/claim", { method: "POST", token: student.token, body: { mission_id: "invented-mission" } });
  check("claiming an unknown mission is refused", unknownMission.status === 400, JSON.stringify(unknownMission.data));
  const staffMissions = await call("/api/missions", { token: admin });
  check("missions are student-only", staffMissions.status === 403, JSON.stringify(staffMissions.data));

  const reading = await call("/api/points/reading", { method: "POST", token: student.token, body: { surah: "سورة الملك", portion: "صفحتان بتدبّر" } });
  check("recording a reading word succeeds", [200, 201].includes(reading.status), JSON.stringify(reading.data));
  const missionsAfterReading = await call("/api/missions", { token: student.token });
  const readingMission = (missionsAfterReading.data?.side || []).find(item => item.id === "side-reading");
  check("the reading mission becomes claimable from the real log", readingMission?.done === true && readingMission?.claimable === true, JSON.stringify(readingMission));
  const beforeClaim = await call("/api/points/summary", { token: student.token });
  const claim = await call("/api/missions/claim", { method: "POST", token: student.token, body: { mission_id: "side-reading" } });
  const awardRows = Array.isArray(claim.data?.awards) ? claim.data.awards : [];
  const awardedAchievement = awardRows.filter(row => row.kind === "achievement" && row.status === "awarded").reduce((total, row) => total + Number(row.points || 0), 0);
  check("claiming a completed mission succeeds", claim.status === 200 && claim.data?.ok === true && awardedAchievement > 0, JSON.stringify(claim.data?.awards));
  const afterClaim = await call("/api/points/summary", { token: student.token });
  check("the claim adds points through the existing engine", Number(afterClaim.data?.totals?.achievement || 0) === Number(beforeClaim.data?.totals?.achievement || 0) + awardedAchievement, JSON.stringify({ before: beforeClaim.data?.totals, after: afterClaim.data?.totals, awards: claim.data?.awards }));
  const repeatClaim = await call("/api/missions/claim", { method: "POST", token: student.token, body: { mission_id: "side-reading" } });
  check("the same mission cannot be claimed twice in a day", repeatClaim.status === 409, JSON.stringify(repeatClaim.data));

  // 8) Store redemption is idempotent by request_id and stock is deducted once.
  const item = await call("/api/store/items", { method: "POST", token: admin, body: { name: "مكافأة اختبار البطاقات " + RUN, description: "اختبار", cost: 2, stock: 5, max_per_student: 2 } });
  check("admin creates a real store item", item.status === 201 && item.data?.item?.id, JSON.stringify(item.data));
  const itemId = item.data?.item?.id;
  const requestId = "cards-redeem-" + RUN;
  const firstRedeem = await call("/api/store/redeem", { method: "POST", token: student.token, body: { item_id: itemId, request_id: requestId } });
  check("first redemption succeeds", firstRedeem.status === 201 && firstRedeem.data?.ok === true, JSON.stringify(firstRedeem.data));
  const secondRedeem = await call("/api/store/redeem", { method: "POST", token: student.token, body: { item_id: itemId, request_id: requestId } });
  check("repeating the same request_id returns the same redemption", secondRedeem.status === 200 && secondRedeem.data?.duplicate === true && secondRedeem.data?.redemption?.id === firstRedeem.data?.redemption?.id, JSON.stringify(secondRedeem.data));
  const itemsAfter = await call("/api/store/items", { token: admin });
  const stockRow = (itemsAfter.data?.items || []).find(row => row.id === itemId);
  check("duplicate redemption deducts stock only once", Number(stockRow?.stock) === 4, JSON.stringify(stockRow));
  const redemptions = await call("/api/store/redemptions", { token: student.token });
  check("duplicate redemption creates only one order", (redemptions.data || []).filter(row => row.item_id === itemId).length === 1, JSON.stringify(redemptions.data));

  // 9) Card-scan rate limiting kicks in and reports a retry delay.
  let sawRateLimit = false, retryAfter = 0;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const hit = await resolveCard("login", loginLink.cardId, "f".repeat(48));
    if (hit.status === 429) { sawRateLimit = true; retryAfter = Number(hit.data?.retry_after || 0); break; }
  }
  check("repeated bad card scans are rate limited", sawRateLimit, "no 429 within 24 attempts");
  check("rate limit reports a retry delay", sawRateLimit && retryAfter > 0, JSON.stringify({ retryAfter }));

  const report = { base: BASE, failures, passed: results.filter(row => row.ok).length, total: results.length, results };
  const outputPath = process.env.CARDS_TEST_REPORT || "";
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
