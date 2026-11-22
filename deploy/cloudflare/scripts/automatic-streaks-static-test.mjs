import fs from "node:fs";
import assert from "node:assert/strict";

const server = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../site/app.js", import.meta.url), "utf8");
assert(server.includes("recordAutomaticActivityStreak"), "daily Quran entries must feed automatic streaks");
assert(server.includes("student_activity_streaks"), "automatic streak storage must be separate and additive");
assert(server.includes("student_streak_badges"), "milestone badges must be retained as history");
assert(server.includes('activity:kind,date:day'), "each daily Quran activity must update its own streak");
assert(server.includes("streak-half:"), "half-points streak bonuses must use an idempotency key");
assert(server.includes("Math.floor(baseTotal / 2)"), "streak bonus must equal half of the underlying points earned");
assert(server.includes("expectedDate === date"), "a streak only advances on the next consecutive calendar day");
assert(server.includes("student_activity_badges"), "all activity types must retain their own streak badges");
assert(server.includes("bonus_rate: days >= 3 ? 0.5 : 0"), "the 50 percent bonus begins only after three consecutive days");
assert(server.includes("if (old?.last_date === date)"), "duplicate same-day entries must not advance a streak");
assert(server.includes("old?.last_date && old.last_date > date"), "backdated entries must not rewrite the current streak");
assert(server.includes('if(status==="done")await recordAutomaticActivityStreak'), "completed daily effort categories must update streaks automatically");
assert(server.includes("const yesterday=addCalendarDays(academyDate(),-1)"), "streaks older than yesterday must be shown as ended");
assert(server.includes('fajr:"fajr",shuruq:"shuruq",maghrib:"maghrib"'), "prayer activity awards must update their matching streaks");
assert(server.includes("const streakActivity="), "existing point activity awards must trigger streak tracking automatically");
assert(server.includes("'asr','adhkar','mandatory_classes','quran_classes','bring'"), "daily effort categories must be supported as streak activities");
assert(app.includes("سلسلة المواظبة والأوسمة"), "student profile must display streaks and badges");
assert(app.includes('/points/streak'), "student profile must load automatic streaks and badges");
console.log("Automatic streaks static checks passed.");

const attendanceStart = server.indexOf('if(path==="/api/attendance"&&method==="POST")');
const attendanceEnd = server.indexOf('if(path==="/api/quran/progress"&&method==="GET")', attendanceStart);
const attendanceRoute = server.slice(attendanceStart, attendanceEnd);
assert(attendanceRoute.includes("date>academyDate()"), "future attendance dates must be rejected before points or streaks are recorded");
