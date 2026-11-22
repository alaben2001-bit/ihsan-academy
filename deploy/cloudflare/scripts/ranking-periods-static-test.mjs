import fs from "node:fs";
import assert from "node:assert/strict";

const server = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../site/app.js", import.meta.url), "utf8");

const rankStart = server.indexOf('if(path==="/api/effort/ranking"&&method==="GET")');
const rankEnd = server.indexOf('if(path==="/api/attendance"&&method==="GET")', rankStart);
assert(rankStart >= 0 && rankEnd > rankStart, "ranking endpoint must exist as a bounded route");
const ranking = server.slice(rankStart, rankEnd);

for (const period of ['"weekly"', '"monthly"', '"yearly"']) {
  assert(ranking.includes(period), `ranking must support ${period}`);
}
for (const scope of ['"academy"', '"group"', '"team"']) {
  assert(ranking.includes(scope), `ranking must support ${scope}`);
}
for (const metric of ['"attendance"', '"wird"', '"thabit"', '"bring"', '"memorization"']) {
  assert(ranking.includes(metric), `ranking metric missing: ${metric}`);
}
assert(ranking.includes("kind='achievement'"), "ranking must use achievement points only");
assert(ranking.includes("reversed_at IS NULL"), "ranking must exclude reversed events");
assert(ranking.includes("event_type<>'store_redemption'"), "ranking must exclude store redemptions");
assert(ranking.includes("awarded_date>=? AND awarded_date<=?"), "ranking must use the selected period");
assert(ranking.includes("total_count:rankedRows.length"), "ranking must return the full scope count");
assert(ranking.includes("rankedRows.filter(row=>row.student_id===user.student_id)"), "student response must expose only the student's own row");
assert(ranking.includes("studentId!==user.student_id"), "student must not query another student's team ranking");

const profileStart = app.indexOf("async function studentProfile");
const profileEnd = app.indexOf("\nfunction printReportWindow", profileStart);
assert(profileStart >= 0 && profileEnd > profileStart, "student profile must exist");
const profile = app.slice(profileStart, profileEnd);
for (const scope of ['"academy"', '"group"', '"team"']) {
  assert(profile.includes(scope), `student profile ranking scope missing: ${scope}`);
}
for (const period of ['value="weekly"', 'value="monthly"', 'value="yearly"']) {
  assert(profile.includes(period), `student profile period missing: ${period}`);
}
assert(profile.includes("rank_change"), "student profile must show previous-period rank movement");
assert(profile.includes('/quran/summary'), "student profile must load the dedicated daily Quran log");
assert(profile.includes("سجل الحفظ اليومي"), "student profile must show daily memorization, تثبيت and ورد history");
const quranSummaryStart = server.indexOf('if(path==="/api/quran/summary"&&method==="GET")');
const quranSummaryEnd = server.indexOf('if(path==="/api/curriculum"&&method==="GET")', quranSummaryStart);
assert(quranSummaryStart >= 0 && quranSummaryEnd > quranSummaryStart, "daily Quran summary endpoint must exist");
assert(server.slice(quranSummaryStart, quranSummaryEnd).includes("FROM quran_daily"), "daily Quran summary must read the dedicated quran_daily ledger");

const rankingPageStart = app.indexOf("async function effortRankingPage");
const rankingPageEnd = app.indexOf("function bulkRosterPage", rankingPageStart);
assert(rankingPageStart >= 0 && rankingPageEnd > rankingPageStart, "ranking page must exist");
const rankingPage = app.slice(rankingPageStart, rankingPageEnd);
for (const scope of ['value="academy"', 'value="group"', 'value="team"']) {
  assert(rankingPage.includes(scope), `ranking page scope selector missing: ${scope}`);
}
assert(rankingPage.includes("URLSearchParams"), "ranking page must build encoded scope queries");

const adjustStart = server.indexOf('if(path==="/api/points/adjust"&&method==="POST")');
const adjustEnd = server.indexOf('if(path==="/api/points/streak"&&method==="GET")', adjustStart);
assert(adjustStart >= 0 && adjustEnd > adjustStart, "general points adjustment route must exist");
const adjustment = server.slice(adjustStart, adjustEnd);
assert(adjustment.includes("request_id"), "manual adjustment must require an idempotency key");
assert(adjustment.includes("totals.balance||0)+delta<0"), "manual adjustment must prevent negative balances");
assert(adjustment.includes("event_type:\"general_adjustment\""), "manual adjustment must use its own event type");
assert(!adjustment.includes('saveRecord(env,"quran_progress"'), "manual adjustment must not modify Quran progress history");

console.log("Ranking period and points-separation static checks passed.");
