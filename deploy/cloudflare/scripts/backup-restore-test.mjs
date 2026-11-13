// Local end-to-end drill for the full backup export/restore (v4).
// Run against `wrangler dev` with a fresh local D1 database:
//   npx wrangler@4 dev --port 8788 --var BOOTSTRAP_SECRET:test-bootstrap-secret-1234
//   node scripts/backup-restore-test.mjs
// The drill only touches the local .wrangler D1 state.

const BASE = process.env.BACKUP_TEST_BASE || "http://127.0.0.1:8788";
const BOOTSTRAP_SECRET = process.env.BACKUP_BOOTSTRAP_SECRET || "test-bootstrap-secret-1234";
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

  const bootstrap = await call("/api/admin/bootstrap", { method: "POST", headers: { "x-bootstrap-secret": BOOTSTRAP_SECRET }, body: ADMIN });
  check("admin bootstrap (created or already exists)", [201, 409].includes(bootstrap.status), JSON.stringify(bootstrap.data));
  const adminLogin = await login(ADMIN.email, ADMIN.password);
  check("admin login returns a session token", adminLogin.status === 200 && adminLogin.token.length === 64, JSON.stringify(adminLogin.data));
  const admin = adminLogin.token;

  const group = await call("/api/groups", { method: "POST", token: admin, body: { name: "فوج اختبار النسخ " + RUN } });
  check("create test group", group.status === 201 && group.data?.id, JSON.stringify(group.data));
  const groupId = group.data.id;

  const studentA = await makeStudent(admin, groupId, "طالب النسخ الأول " + RUN, "backup-student-1-" + RUN, "BackupStudent#2026");
  const studentB = await makeStudent(admin, groupId, "طالب النسخ الثاني " + RUN, "backup-student-2-" + RUN, "BackupStudent#2026");
  check("two student sessions are active", studentA.token.length === 64 && studentB.token.length === 64);

  // Seed economy: reading award + store redemption (debit event).
  const reading = await call("/api/points/reading", { method: "POST", token: studentA.token, body: { surah: "الفاتحة", portion: "صفحة", reflection: "اختبار النسخ" } });
  check("student logs daily reading for points", reading.status === 201 && (reading.data?.awards || []).some(a => a.kind === "store" && a.status === "awarded"), JSON.stringify(reading.data));
  const item = await call("/api/store/items", { method: "POST", token: admin, body: { name: "مادة اختبار النسخ " + RUN, cost: 2, stock: 5 } });
  check("admin creates a store item", item.status === 201 && item.data?.item?.id, JSON.stringify(item.data));
  const itemId = item.data.item.id;
  const redeem = await call("/api/store/redeem", { method: "POST", token: studentA.token, body: { item_id: itemId } });
  check("student redeems the item", redeem.status === 201 && redeem.data?.redemption?.id, JSON.stringify(redeem.data));
  const redemptionId = redeem.data.redemption.id;

  // Seed Quran path: enrollment, three daily kinds, pair session, station, makeup.
  const enroll = await call("/api/quran/path", { method: "POST", token: studentA.token, body: { hifz_plan: "plan_b", hifz_category: "30", hifz_amount: "5", hifz_unit: "سطر", ward_ahzab: 2, start_date: today } });
  check("student enrolls in the Quran path", enroll.status === 200, JSON.stringify(enroll.data));
  for (const [kind, amount, unit] of [["hifz", 5, "سطر"], ["thabit", 0.25, "حزب"], ["ward", 2, "حزب"]]) {
    const log = await call("/api/quran/daily", { method: "POST", token: studentA.token, body: { kind, amount, unit, repetitions: kind === "thabit" ? 15 : 0 } });
    check("student logs " + kind, log.status === 201, JSON.stringify(log.data));
  }
  const pair = await call("/api/quran/companion/pair", { method: "POST", token: admin, body: { student_a: studentA.id, student_b: studentB.id } });
  check("staff pairs the two students", pair.status === 201, JSON.stringify(pair.data));
  const session = await call("/api/quran/companion/session", { method: "POST", token: studentA.token, body: { reciter_id: studentA.id, listener_id: studentB.id, amount: "حزبان", errors: 2, hesitations: 1, prompts: 1, minutes: 20, expected_minutes: 20 } });
  check("companion session is stored", session.status === 201, JSON.stringify(session.data));
  const station = await call("/api/quran/stations", { method: "POST", token: studentA.token, body: { stage: "15", scheduled_for: today, memorized_amount: "15 حزبًا" } });
  check("student requests a station", station.status === 201, JSON.stringify(station.data));
  const makeup = await call("/api/quran/makeups", { method: "POST", token: studentA.token, body: { kind: "hifz", due_date: today, amount: "خمسة أسطر", reason: "interruption", reason_note: "اختبار النسخ" } });
  check("student files a makeup", makeup.status === 201, JSON.stringify(makeup.data));

  // Seed competitions: create, announce, register, judge, generate and approve results.
  const createdCompetition = await call("/api/competitions", { method: "POST", token: admin, body: { title: "مسابقة النسخ " + RUN, description: "اختبار النسخ الاحتياطي", kind: "quran_hifz", season: "test", registration_starts_at: today, registration_ends_at: today, starts_at: today, ends_at: today } });
  check("admin creates a competition", createdCompetition.status === 201 && createdCompetition.data?.id, JSON.stringify(createdCompetition.data));
  const competitionId = createdCompetition.data.id;
  const announce = await call("/api/competitions/" + encodeURIComponent(competitionId) + "/status", { method: "POST", token: admin, body: { status: "announced" } });
  check("competition moves to announced", announce.status === 200, JSON.stringify(announce.data));
  const openRegistration = await call("/api/competitions/" + encodeURIComponent(competitionId) + "/status", { method: "POST", token: admin, body: { status: "registration" } });
  check("competition opens registration", openRegistration.status === 200, JSON.stringify(openRegistration.data));
  const register = await call("/api/competitions/" + encodeURIComponent(competitionId) + "/register", { method: "POST", token: studentA.token, body: { note: "اختبار النسخ" } });
  check("student registers in the competition", register.status === 201 && register.data?.registration?.id, JSON.stringify(register.data));
  const registrationId = register.data.registration.id;
  const judging = await call("/api/competitions/" + encodeURIComponent(competitionId) + "/status", { method: "POST", token: admin, body: { status: "judging" } });
  check("competition moves to judging", judging.status === 200, JSON.stringify(judging.data));
  const score = await call("/api/competitions/" + encodeURIComponent(competitionId) + "/registrations/" + encodeURIComponent(registrationId) + "/score", { method: "POST", token: admin, body: { criteria: [{ id: "hifz", score: 45 }, { id: "adau", score: 18 }, { id: "tajweed", score: 13 }, { id: "adab", score: 14 }], note: "اختبار النسخ" } });
  check("admin scores the registration", score.status === 200 && Number(score.data?.total) > 0, JSON.stringify(score.data));
  const generated = await call("/api/competitions/" + encodeURIComponent(competitionId) + "/results/generate", { method: "POST", token: admin, body: {} });
  check("admin generates results", generated.status === 200 && (generated.data?.results || []).length === 1, JSON.stringify(generated.data));
  const approved = await call("/api/competitions/" + encodeURIComponent(competitionId) + "/results/approve", { method: "POST", token: admin, body: {} });
  check("admin approves results once", approved.status === 200 && approved.data?.status === "published", JSON.stringify(approved.data));
  const event = await call("/api/competition-events", { method: "POST", token: admin, body: { competition_id: competitionId, title: "حدث النسخ " + RUN, event_date: today, kind: "result" } });
  check("admin adds a competition event", event.status === 201 && event.data?.id, JSON.stringify(event.data));
  const eventId = event.data.id;
  const term = await call("/api/competition-terms", { method: "POST", token: admin, body: { kind: "quran_hifz", title: "شرط النسخ " + RUN, body: "نص شرط اختبار النسخ", source: "اختبار" } });
  check("admin adds a reference term", term.status === 201 && term.data?.id, JSON.stringify(term.data));
  const termId = term.data.id;

  // Export.
  const exported = await call("/api/admin/backup/full-export", { token: admin });
  const backup = exported.data || {};
  const data = backup.data || {};
  check("full export returns v4", exported.status === 200 && backup.format === "ihsan-academy-full-backup-v4", JSON.stringify({ status: exported.status, format: backup.format }));
  check("export includes point rules and events", (data.point_rules || []).length >= 7 && (data.point_events || []).length >= 2, JSON.stringify({ rules: (data.point_rules || []).length, events: (data.point_events || []).length }));
  check("export includes store items and redemptions", (data.store_items || []).some(x => x.id === itemId) && (data.store_redemptions || []).some(x => x.id === redemptionId), JSON.stringify({ items: (data.store_items || []).length, redemptions: (data.store_redemptions || []).length }));
  check("export includes the Quran path", (data.quran_paths || []).some(x => x.student_id === studentA.id), JSON.stringify((data.quran_paths || []).length));
  check("export includes three daily logs", (data.quran_daily || []).filter(x => x.student_id === studentA.id).length === 3, JSON.stringify((data.quran_daily || []).filter(x => x.student_id === studentA.id)));
  check("export includes pair, session, station and makeup", (data.quran_pairs || []).length >= 1 && (data.quran_pair_sessions || []).length >= 1 && (data.quran_stations || []).length >= 1 && (data.quran_makeups || []).length >= 1, JSON.stringify({ pairs: (data.quran_pairs || []).length, sessions: (data.quran_pair_sessions || []).length, stations: (data.quran_stations || []).length, makeups: (data.quran_makeups || []).length }));
  check("export includes competitions and categories", (data.competitions || []).some(x => x.id === competitionId) && (data.competition_categories || []).length >= 5, JSON.stringify({ competitions: (data.competitions || []).length, categories: (data.competition_categories || []).length }));
  check("export includes registration, score and result", (data.competition_registrations || []).some(x => x.id === registrationId) && (data.competition_scores || []).some(x => x.registration_id === registrationId) && (data.competition_results || []).some(x => x.registration_id === registrationId), JSON.stringify({ registrations: (data.competition_registrations || []).length, scores: (data.competition_scores || []).length, results: (data.competition_results || []).length }));
  check("export includes competition event and term", (data.competition_events || []).some(x => x.id === eventId) && (data.competition_reference_terms || []).some(x => x.id === termId), JSON.stringify({ events: (data.competition_events || []).length, terms: (data.competition_reference_terms || []).length }));

  // Mutate after the backup, then restore.
  const planChange = await call("/api/quran/path", { method: "POST", token: studentA.token, body: { hifz_plan: "plan_c", hifz_category: "45", hifz_amount: "3", hifz_unit: "سطر", ward_ahzab: 4, start_date: today } });
  check("student changes the plan after the backup", planChange.status === 200, JSON.stringify(planChange.data));
  const approve = await call("/api/store/redemptions/" + encodeURIComponent(redemptionId) + "/decision", { method: "POST", token: admin, body: { decision: "approved", note: "قبل الاستعادة" } });
  check("admin approves the redemption after the backup", approve.status === 200, JSON.stringify(approve.data));
  const titleChange = await call("/api/competitions/" + encodeURIComponent(competitionId), { method: "PATCH", token: admin, body: { title: "عنوان مغيّر بعد النسخة " + RUN } });
  check("admin changes the competition title after the backup", titleChange.status === 200, JSON.stringify(titleChange.data));

  const restore = await call("/api/admin/backup/restore", { method: "POST", token: admin, body: { ...backup, confirm_restore: "RESTORE-IHSAN-ACADEMY" } });
  check("restore accepts the v4 file", restore.status === 200 && restore.data?.restored?.quran_daily >= 3, JSON.stringify(restore.data));
  check("restore reports economy counts", Number(restore.data?.restored?.point_events) >= 2 && Number(restore.data?.restored?.store_redemptions) >= 1, JSON.stringify(restore.data?.restored));
  check("restore reports competition counts", Number(restore.data?.restored?.competitions) >= 1 && Number(restore.data?.restored?.competition_registrations) >= 1 && Number(restore.data?.restored?.competition_results) >= 1, JSON.stringify(restore.data?.restored));

  const pathAfter = await call("/api/quran/path", { token: studentA.token });
  check("restore reverts the plan to the backed-up value", pathAfter.data?.path?.hifz_plan === "plan_b" && pathAfter.data?.path?.ward_ahzab === 2, JSON.stringify(pathAfter.data?.path));
  const dailyAfter = await call("/api/quran/today", { token: studentA.token });
  check("restore keeps the daily logs", Boolean(dailyAfter.data?.logs?.hifz) && Boolean(dailyAfter.data?.logs?.thabit) && Boolean(dailyAfter.data?.logs?.ward), JSON.stringify(dailyAfter.data?.logs));
  const redemptionsAfter = await call("/api/store/redemptions?status=pending", { token: admin });
  check("restore reverts the redemption decision", (redemptionsAfter.data || []).some(x => x.id === redemptionId), JSON.stringify(redemptionsAfter.data));
  const stationAfter = await call("/api/quran/stations", { token: studentA.token });
  check("restore keeps the station", (stationAfter.data || []).some(x => x.student_id === studentA.id), JSON.stringify(stationAfter.data));
  const makeupAfter = await call("/api/quran/makeups", { token: studentA.token });
  check("restore keeps the makeup", (makeupAfter.data || []).some(x => x.student_id === studentA.id), JSON.stringify(makeupAfter.data));
  const competitionAfter = await call("/api/competitions/" + encodeURIComponent(competitionId), { token: admin });
  check("restore reverts the competition title", competitionAfter.status === 200 && competitionAfter.data?.title === "مسابقة النسخ " + RUN, JSON.stringify(competitionAfter.data?.title));
  const competitionResultsAfter = await call("/api/competitions/" + encodeURIComponent(competitionId) + "/results", { token: admin });
  check("restore keeps the competition result", (competitionResultsAfter.data || []).some(x => x.registration_id === registrationId && x.status === "published"), JSON.stringify(competitionResultsAfter.data));
  const eventAfter = await call("/api/competition-events?competition_id=" + encodeURIComponent(competitionId), { token: admin });
  check("restore keeps the competition event", (eventAfter.data || []).some(x => x.id === eventId), JSON.stringify(eventAfter.data));
  const termAfter = await call("/api/competition-terms?kind=quran_hifz", { token: admin });
  check("restore keeps the reference term", (termAfter.data || []).some(x => x.id === termId), JSON.stringify(termAfter.data));

  // Backward compatibility: a v2 file (without the new arrays) still restores.
  const legacy = JSON.parse(JSON.stringify(backup));
  legacy.format = "ihsan-academy-full-backup-v2";
  for (const key of ["point_rules", "point_events", "store_items", "store_redemptions", "quran_paths", "quran_daily", "quran_pairs", "quran_pair_sessions", "quran_stations", "quran_makeups", "competition_categories", "competitions", "competition_registrations", "competition_judges", "competition_scores", "competition_results", "competition_events", "competition_reference_terms"]) delete legacy.data[key];
  const restoreV2 = await call("/api/admin/backup/restore", { method: "POST", token: admin, body: { ...legacy, confirm_restore: "RESTORE-IHSAN-ACADEMY" } });
  check("restore still accepts v2 files", restoreV2.status === 200 && Number(restoreV2.data?.restored?.quran_daily) === 0 && Number(restoreV2.data?.restored?.competitions) === 0, JSON.stringify(restoreV2.data));

  // Guards.
  const noConfirm = await call("/api/admin/backup/restore", { method: "POST", token: admin, body: { ...backup } });
  check("restore requires the confirmation token", noConfirm.status === 400, JSON.stringify(noConfirm.data));
  const wrongFormat = await call("/api/admin/backup/restore", { method: "POST", token: admin, body: { ...backup, format: "ihsan-academy-full-backup-v1", confirm_restore: "RESTORE-IHSAN-ACADEMY" } });
  check("restore rejects unknown formats", wrongFormat.status === 400, JSON.stringify(wrongFormat.data));
  const studentRestore = await call("/api/admin/backup/restore", { method: "POST", token: studentA.token, body: { ...backup, confirm_restore: "RESTORE-IHSAN-ACADEMY" } });
  check("student cannot restore a backup", studentRestore.status === 403, JSON.stringify(studentRestore.data));

  const report = { base: BASE, failures, passed: results.filter(row => row.ok).length, total: results.length, results };
  const outputPath = process.env.BACKUP_TEST_REPORT || "";
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
