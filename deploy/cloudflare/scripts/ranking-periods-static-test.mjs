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

const adjustStart = server.indexOf('if(path==="/api/points/adjust"&&method==="POST")');
const adjustEnd = server.indexOf('if(path==="/api/points/streak"&&method==="GET")', adjustStart);
assert(adjustStart >= 0 && adjustEnd > adjustStart, "general points adjustment route must exist");
const adjustment = server.slice(adjustStart, adjustEnd);
assert(adjustment.includes("request_id"), "manual adjustment must require an idempotency key");
assert(adjustment.includes("totals.balance||0)+delta<0"), "manual adjustment must prevent negative balances");
assert(adjustment.includes("event_type:\"general_adjustment\""), "manual adjustment must use its own event type");
assert(!adjustment.includes('saveRecord(env,"quran_progress"'), "manual adjustment must not modify Quran progress history");

console.log("Ranking period and points-separation static checks passed.");
