import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "site/app.js"), "utf8");
const server = fs.readFileSync(path.join(root, "src/index.js"), "utf8");
const checks = [];
function check(name, condition) {
  checks.push({ name, ok: Boolean(condition) });
  console.log((condition ? "PASS " : "FAIL ") + name);
}

const ruleStart = app.indexOf("const ruleRows=rules.map");
const ruleEnd = app.indexOf("v.innerHTML=html;", ruleStart);
const ruleUi = app.slice(ruleStart, ruleEnd);
const activityStart = server.indexOf('if(path==="/api/points/activity"&&method==="POST")');
const activityEnd = server.indexOf('if(path==="/api/points/summary"&&method==="GET")', activityStart);
const activity = server.slice(activityStart, activityEnd);
const awardStart = server.indexOf("async function awardPointsForEvent");
const awardEnd = server.indexOf("async function awardAttendancePoints", awardStart);
const award = server.slice(awardStart, awardEnd);
const ethicsStart = server.indexOf('if(path==="/api/points/ethics"&&method==="POST")');
const ethicsEnd = server.indexOf('if(path==="/api/points/referrals"&&method==="GET")', ethicsStart);
const ethics = server.slice(ethicsStart, ethicsEnd);
const streakStart = server.indexOf('if(path==="/api/points/streak"&&method==="POST")');
const streakEnd = server.indexOf('if(path==="/api/points/ethics"&&method==="GET")', streakStart);
const streak = server.slice(streakStart, streakEnd);
const referralStart = server.indexOf('if(path==="/api/points/referrals"&&method==="POST")');
const referralEnd = server.indexOf("const pointEventReverseMatch", referralStart);
const referral = server.slice(referralStart, referralEnd);
const rulesStart = server.indexOf('if(path==="/api/points/rules"&&method==="POST")');
const rulesEnd = server.indexOf('if(path==="/api/points/award"&&method==="POST")', rulesStart);
const rules = server.slice(rulesStart, rulesEnd);

check("Sheikh can configure bonus percentage in rule UI", /data-rule-bonus/.test(ruleUi) && /زيادة %/.test(ruleUi));
check("rule save sends bonus_percent to API", /bonus_percent:Number\(tr\.querySelector\("\[data-rule-bonus\]"\)\.value\)/.test(app));
check("server validates bonus percentage from 0 to 300", /bonusPercent<0\|\|bonusPercent>300/.test(rules));
check("only Sheikh account can award point activities", /if\(user\.role!=="admin"\)return fail\(403,"اعتماد منح النقاط اليدوي للشيخ وحده"\)/.test(activity));
check("QR scanner offers only attendance and hifz tasks", /\{id:"attendance",label:"الحضور",hint:"30 نقطة"/.test(app) && /\{id:"hifz",label:"الحفظ",hint:"20 نقطة"/.test(app) && !/scan-point-picker|data-scan-pre-activity/.test(app));
check("QR scanner remembers selected tasks between visits", /ihsan_scan_task_type/.test(app) && /safeStore\.set\("ihsan_scan_task_type"/.test(app));
check("daily scan uses current date without manual date selection", /id="scan-task-date" type="hidden"/.test(app));
check("add-points QR resolution is limited to authorized group staff", /kind==="add_points"&&!\["admin","teacher","director","supervisor"\]\.includes\(scanner\.role\)/.test(server));
check("add-points QR scan automatically records present attendance", /status:"present",note:"تسجيل حضور آلي بمسح بطاقة الطالب"/.test(server));
check("add-points QR scan awards attendance through the once-per-day engine", /awardAttendancePoints\(env,\{groupId:student\.group_id,date,studentIds:\[student\.id\],awardedBy:scanner\.id\}\)/.test(server));
check("support activity uses the support_others rule", /support:\{eventType:\"support_others\"/.test(activity));
check("support activity requires a valid original achievement amount", /activity===\"support\"&&\(!Number\.isInteger\(basePoints\)\|\|basePoints<1\|\|basePoints>1000\)/.test(activity));
check("bonus formula applies configured percentage to original points", /Math\.round\(baseAmount\*\(1\+Number\(rule\.bonus_percent\)\/100\)\)/.test(award));
check("30 percent of a 100-point achievement produces 130 points", Math.round(100 * (1 + 30 / 100)) === 130);
check("manual award rejects missing or malformed request_id", server.includes('معرّف الحركة مطلوب لمنع تكرار المنح'));
check("support event is idempotent per student/day", /:"manual:"\+activity\+":"\+date\+":"\+s\.id/.test(activity) && /idx_point_events_unique_event/.test(server));
check("ethics warnings suspend multiplier at three", /warnings\+\+;if\(warnings>=3\)status=\"suspended\"/.test(ethics));
check("deduction starts after the third warning and is Sheikh-approved", /warnings>3\)[^]*?points:-deduction/.test(ethics));
check("permanent multiplier forfeiture exists and cannot be restored", /action===\"forfeit\"/ .test(ethics) && /status===\"forfeited\"\)return fail\(409/.test(ethics));
check("legacy manual streak endpoint is disabled without awarding points", /return fail\(410,"تم إيقاف الاعتماد اليدوي للاستمرارية/.test(streak) && !/insertPointEvent/.test(streak));
check("Sheikh interface no longer exposes a manual streak award form", !app.includes('id="scan-streak-form"') && !app.includes("اعتماد يوم الاستمرارية"));
check("Sheikh scan panel renders automatic streaks and badges", app.includes("streakData.streaks") && app.includes("streakData.badges") && app.includes("streakBadgeRows"));
check("automatic streak bonus begins after three days at 50 percent", /if\s*\(days >= 3 && baseTotal > 0\)/.test(server) && /bonus_rate: days >= 3 \? 0\.5 : 0/.test(server) && /Math\.floor\(baseTotal\s*\/\s*2\)/.test(server));
check("automatic streak bonus is credited to achievement points only", /kind:\s*"achievement",\s*points:\s*bonus/.test(server));
check("referral reward requires seven days of stability", /Number\(elapsed\?\.days\|\|0\)<7/.test(referral));
check("referral reward is 20 points and idempotent", /points:20/.test(referral) && /event_key:\"referral:\"\+id/.test(referral));
check("no invented sample rewards remain in the store UI", !app.includes("STORE_SUGGESTIONS") && !app.includes("data-store-suggest"));
check("store catalog remains owner-entered through the real item form", /id=\"store-item-form\"/.test(app) && /كتالوج الأكاديمية المعتمد فقط/.test(app));

const failed = checks.filter(item => !item.ok);
console.log("\\n" + (checks.length - failed.length) + "/" + checks.length + " points-system checks passed.");
if (failed.length) process.exitCode = 1;
