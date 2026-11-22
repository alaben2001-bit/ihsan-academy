import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validDateOnly, academyDate, addCalendarDays } from "../src/index.js";

const [backend, app, index, serviceWorker, migration, initialMigration, style, about, privacy, robots, sitemap, redirects, competitionsMigration, rateLimitsMigration, qrScript] = await Promise.all([
  readFile("src/index.js", "utf8"),
  readFile("site/app.js", "utf8"),
  readFile("site/index.html", "utf8"),
  readFile("site/service-worker.js", "utf8"),
  readFile("migrations/0003_temporary_student_passwords.sql", "utf8"),
  readFile("migrations/0001_initial.sql", "utf8"),
  readFile("site/style.css", "utf8"),
  readFile("site/about.html", "utf8"),
  readFile("site/privacy.html", "utf8"),
  readFile("site/robots.txt", "utf8"),
  readFile("site/sitemap.xml", "utf8"),
  readFile("site/_redirects", "utf8"),
  readFile("migrations/0006_competitions.sql", "utf8"),
  readFile("migrations/0008_rate_limits.sql", "utf8"),
  readFile("site/qr.js", "utf8"),
]);

assert.equal(validDateOnly("2024-02-29"), true, "valid leap-day due dates must be accepted");
assert.equal(validDateOnly("2026-02-29"), false, "invalid leap-day due dates must be rejected");
assert.equal(validDateOnly("2026-02-31"), false, "out-of-range calendar days must be rejected");
assert.equal(validDateOnly("2026-13-01"), false, "out-of-range months must be rejected");
assert.equal(validDateOnly("2026-00-10"), false, "zero months must be rejected");
assert.equal(validDateOnly("not-a-date"), false, "non-date values must be rejected");
assert.equal(validDateOnly(""), false, "empty dates must be rejected");
assert.equal((initialMigration.match(/CREATE TABLE IF NOT EXISTS login_attempts/g)||[]).length, 1, "the initial D1 schema must declare the login-attempt table only once");
assert.equal(academyDate(new Date("2026-10-20T22:30:00.000Z")), "2026-10-20", "Algeria local date must remain the same before local midnight");
assert.equal(academyDate(new Date("2026-10-20T23:30:00.000Z")), "2026-10-21", "Algeria local date must advance after midnight even when UTC is still on the prior date");
assert.equal(addCalendarDays("2026-10-20", 14), "2026-11-03", "two-week test due dates must advance by calendar days");
assert.ok(!backend.includes("nowIso().slice(0,10)"), "date-only school workflows must not derive their day from UTC");

// Calendar validation must reject impossible dates in every editable attendance/Quran record.
assert.match(backend, /if\(!validDateOnly\(date\)\|\|date>academyDate\(\)\|\|!items\.length\|\|items\.length>200/, "attendance must validate calendar dates and reject future entries");
assert.match(backend, /if\(!validDateOnly\(date\)\)return fail\(400,"صيغة التاريخ غير صحيحة"\)/, "Quran progress creation must validate real calendar dates");
assert.match(backend, /if\(date>academyDate\(\)\)return fail\(400,"لا يمكن تسجيل متابعة القرآن بتاريخ مستقبلي"\)/, "Quran progress creation must reject future dates at the API");
assert.match(app, /if\(day>today\)return toast\("لا يمكن تسجيل متابعة بتاريخ مستقبلي",true\)/, "the active Quran roster page must reject future dates before loading or saving");
assert.match(backend, /String\(row\.date\)>academyDate\(\)/, "Quran progress edits must reject future dates too");
assert.match(backend, /if\(!validDateOnly\(String\(row\.date\|\|""\)\)/, "Quran progress edits must validate real calendar dates");
assert.match(backend, /if\(!value\|\|typeof value!=="object"\|\|Array\.isArray\(value\)\)throw new Error\("invalid_json"\)/, "API bodies must be JSON objects, not nulls, arrays, or primitives");
assert.match(backend, /const seenStudentIds=new Set\(\);for\(const item of items\)/, "attendance must detect duplicate student rows before database writes");
assert.match(backend, /seenStudentIds\.has\(studentId\)/, "duplicate attendance rows must be rejected instead of silently overwriting one another");
assert.doesNotMatch(backend, /!\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(date\)/, "date-shaped strings must not be mistaken for valid calendar dates");

// A full backup must preserve first-login password enforcement and linked Google accounts.
assert.match(backend, /must_change_password,created_at FROM users ORDER BY created_at/, "full backup must preserve forced password changes");
assert.match(backend, /google_identities:googleIdentities\.results\|\|\[\]/, "full backup must preserve linked Google identities");
assert.match(backend, /must_change_password=excluded\.must_change_password/, "restore must retain forced password changes");
assert.match(backend, /INSERT INTO users \(id,display_name,identity_normalized,password_hash,role,active\) SELECT \?,\?,\?,\?, 'admin',1 WHERE NOT EXISTS \(SELECT 1 FROM users WHERE role='admin'\)/, "initial administrator creation must be atomic against concurrent bootstrap requests");
assert.match(backend, /for\(const x of googleIdentities\)statements\.push/, "restore must retain verified Google account links");

// A full backup must also preserve the learning economy and the Quran path, otherwise a restore silently loses them.
assert.match(backend, /point_events:pointEvents\.results\|\|\[\]/, "full backup must preserve point events");
assert.match(backend, /store_redemptions:storeRedemptions\.results\|\|\[\]/, "full backup must preserve store redemptions");
assert.match(backend, /quran_daily:quranDaily\.results\|\|\[\]/, "full backup must preserve daily Quran logs");
assert.match(backend, /quran_stations:quranStations\.results\|\|\[\]/, "full backup must preserve sheikh stations");
assert.match(backend, /quran_makeups:quranMakeups\.results\|\|\[\]/, "full backup must preserve makeups");
assert.match(backend, /competitions:competitions\.results\|\|\[\]/, "full backup must preserve competitions");
assert.match(backend, /competition_results:competitionResults\.results\|\|\[\]/, "full backup must preserve competition results");
assert.match(backend, /format:"ihsan-academy-full-backup-v4"/, "full export must advertise the v4 format");
assert.match(backend, /"ihsan-academy-full-backup-v2","ihsan-academy-full-backup-v3","ihsan-academy-full-backup-v4"/, "restore must accept v4 and legacy v2/v3 files");
assert.match(backend, /INSERT INTO quran_daily \(id,student_id,day,kind/, "restore must write daily Quran logs");
assert.match(backend, /INSERT INTO point_events \(id,student_id,group_id,rule_id/, "restore must write point events");
assert.match(backend, /INSERT INTO competitions \(id,school_id,title/, "restore must write competitions");
assert.match(backend, /INSERT INTO competition_results \(id,competition_id,registration_id/, "restore must write competition results");
assert.match(backend, /competition_categories:competitionCategories\.length,competitions:competitions\.length/, "restore must report competition counts");

assert.match(app, /const localDateISO=/, "browser date inputs must use the local calendar date");
assert.match(app, /const head=\(a,b\)=>.*esc\(a\).*esc\(b\)/, "shared section headings must escape dynamic text before inserting HTML");
assert.match(app, /كلمة المرور الأولية الموحدة 12345678/, "student account creation must clearly show the agreed unified first-login password");
assert.match(app, /timeZone:"Africa\/Algiers"/, "browser date helpers must use the same Algeria timezone as the backend");


// Regression guardrails for cookie-only browser sessions and CSRF.
assert.match(backend, /__Host-ihsan_session=.*HttpOnly; SameSite=Strict/, "sessions must use Secure, HttpOnly, SameSite cookies");
assert.match(backend, /__Host-ihsan_csrf=/, "sessions must issue a separate CSRF cookie");
assert.match(backend, /csrfIsValid\(request\)/, "cookie-authenticated mutations must validate CSRF");
assert.match(backend, /X-CSRF-Token/, "the backend must explicitly allow the CSRF header");
assert.match(backend, /const requestSessionToken = request => bearerSessionToken\(request\) \|\| cookieSessionToken\(request\)/, "authenticated requests must accept cookie sessions");
assert.equal((backend.match(/return sessionResponse\(/g)||[]).length, 3, "password, Google and self-signup must all issue cookie sessions");
assert.doesNotMatch(backend, /return json\(\{token,user:safeUser/, "raw session tokens must not be returned to the browser");
assert.doesNotMatch(app, /safeStore\.set\(["']ihsan_token["']/, "the UI must not store reusable bearer tokens");
assert.match(app, /credentials:"same-origin"/, "API requests must send same-origin cookies");
assert.match(app, /h\["x-csrf-token"\]=csrf/, "mutating API requests must send the CSRF token");
const indexAppVersion = index.match(/(?:src|href)="\/app\.js\?v=([\w-]+)"/)?.[1];
assert.ok(indexAppVersion, "the current frontend asset version must be explicit");
const cacheVersion = (serviceWorker.match(/const ASSET_VERSION = "([^"]+)"/) || [])[1];
assert.ok(/^ihsan-academy-pwa-v\d+-\d{8}-\d+$/.test((serviceWorker.match(/const CACHE = "([^"]+)"/) || [])[1] || ""), "the PWA cache must be invalidated with the frontend build");
assert.equal(indexAppVersion, cacheVersion, "the app script and service worker must use the same cache-busting version");
assert.equal((serviceWorker.match(/const ASSET_VERSION = "([^"]+)"/) || [])[1], (serviceWorker.match(/const CACHE = "ihsan-academy-pwa-v\d+-(\d{8}-\d+)"/) || [])[1], "the service worker cache name must identify its asset version");
assert.ok(index.includes("/startup.js?v=" + indexAppVersion), "startup script must use the current frontend asset version");
for (const page of [about, privacy]) {
  assert.ok(page.includes("/style.css?v=" + indexAppVersion), "public pages must use the current stylesheet version");
}
assert.equal((index.match(/\/style\.css\?v=/g) || []).length, 1, "the page must load exactly one consolidated stylesheet");
assert.doesNotMatch(index, /telegram-interface|ihsan-dark-theme|ihsan-emerald-pro/, "removed theme layers must not be referenced again");
assert.doesNotMatch(index, /<script(?![^>]*(?:\bsrc=|type="application\/ld\+json"))[^>]*>/, "inline scripts are blocked by the CSP and must stay external");
assert.match(style, /\.doc-page/, "shared documentation styles for about/privacy must exist");
assert.match(style, /\.daily-nourishment-grid/, "daily supplication and learning cards must retain their styling");

// Regression guards for the responsive shell and task-first scanner.
const shellStart = app.indexOf("function shell(){");
const shellEnd = app.indexOf('const actionBar=$("#top-actions")', shellStart);
assert.ok(shellStart >= 0 && shellEnd > shellStart, "the authenticated shell must exist");
assert.ok(app.slice(shellStart, shellEnd).includes("mobilePrimaryMarkup()+mobileMoreMarkup()"), "the mobile navigation and complete More drawer must be rendered inside the authenticated shell");
assert.ok(app.includes("function mobilePrimaryItems(){") && app.includes("function mobileMoreMarkup(){"), "mobile navigation must be defined from the role-filtered item list");
assert.ok(app.includes("'+navMarkup()+'"), "the mobile More drawer must reuse the complete role-aware navigation");
const scanStart = app.indexOf("async function scanPage(v){");
const scanEnd = app.indexOf("\nfunction studentsForScanCheck", scanStart);
assert.ok(scanStart >= 0 && scanEnd > scanStart, "the QR scan page must exist");
const scanUi = app.slice(scanStart, scanEnd);
assert.ok(!scanUi.includes('id="scan-task-group"'), "QR scanning must not ask the operator to choose a group");
assert.ok(scanUi.includes("data-scan-task"), "QR scan must display selectable task tiles");
assert.ok(app.includes("authorizedRoster.find(st=>String(st.id)===String(student.id))"), "QR scan must validate the student against the permission-scoped roster");
assert.ok(style.includes(".mobile-primary-nav") && style.includes(".mobile-more-dialog"), "the mobile bar and drawer must be styled");
assert.ok(style.includes("prefers-reduced-motion:reduce"), "new animations must respect reduced-motion preferences");

// These are static regression guardrails, not a replacement for live role-by-role acceptance tests.
assert.match(backend, /const INITIAL_STUDENT_PASSWORD = "12345678"/, "student onboarding must use the agreed initial password");
assert.match(backend, /reason:"already_linked"/, "bulk onboarding must not reset accounts already linked to student records");
assert.match(backend, /ambiguous_existing_account/, "ambiguous orphan accounts must be skipped rather than linked to the wrong student");
assert.match(backend, /uniqueStudentIdentity\(env,st\.display_name/, "onboarding must resolve unique student usernames");
assert.match(backend, /must_change_password=1/, "new/reset accounts must be marked for a first-login password change");
assert.match(backend, /VALUES\(\?,\?,\?,\?, 'teacher',1,1\)/, "new teacher accounts must require a first-login password change");
assert.match(backend, /VALUES\(\?,\?,\?,\?,\?,1,1\)/, "new director and supervisor accounts must require a first-login password change");
assert.match(backend, /must_change_password=0/, "a successful password change must clear the first-login requirement");
assert.match(backend, /if\(user\.must_change_password && !\["\/api\/me","\/api\/me\/password","\/api\/logout"\]\.includes\(path\)\)/, "protected API routes must be blocked until password change");
assert.match(backend, /حساب Google غير مربوط بحساب الأكاديمية/, "Google sign-in must require explicit account linking");
assert.match(backend, /if\(path==="\/api\/auth\/google\/link"&&method==="POST"\)/, "authenticated users must have an explicit Google linking endpoint");
assert.match(backend, /FROM google_identities gi JOIN users u ON u.id=gi.user_id WHERE gi.google_sub=\?/, "Google login must resolve an already-linked Google subject, not create duplicate accounts");
assert.match(app, /id="settings-google-link"/, "users must be able to link Google from account settings");
assert.match(app, /api\("\/auth\/google\/link"/, "the UI must send Google linking to the authenticated endpoint");
assert.match(backend, /تهيئة حسابات الطلاب الجماعية للمدير العام فقط/, "bulk account setup must be admin-only");
assert.match(backend, /if\(path==="\/api\/assignments"&&method==="GET"\)/, "assignment list API must exist");
assert.match(backend, /if\(path==="\/api\/gradebook"&&method==="GET"\)/, "gradebook endpoint must exist");
assert.match(backend, /اختر الفوج لعرض سجله التعليمي/, "staff gradebook requests must select a group");
assert.match(backend, /canManageGroup\(env,user,groupId\)/, "gradebook must validate access to the selected group");
assert.match(app, /async function gradebookPage\(v\)/, "the gradebook UI must be available");
assert.doesNotMatch(app, /"gradebook","السجل التعليمي(?: والترتيب)?"/, "the legacy staff gradebook must not appear in sidebar navigation");
assert.match(app, /"gradebook","تقدمي ودرجاتي"/, "student navigation must expose personal progress");

assert.match(backend, /if\(path==="\/api\/assignments"&&method==="POST"\)/, "assignment creation API must exist");
assert.equal((backend.match(/!validDateOnly\(dueDate\)/g)||[]).length, 2, "assignment creation and edit must both validate real calendar dates");
assert.match(backend, /if\(path==="\/api\/assignment-submit"&&method==="POST"\)/, "student assignment submission API must exist");
assert.match(backend, /if\(previous\?\.status==="reviewed"\)return fail\(409,"تمت مراجعة هذا الواجب بالفعل/, "a student must not overwrite a reviewed grade by resubmitting");
assert.match(app, /إن احتجت إلى تعديل الإجابة، تواصل مع معلمك ليعيد فتح الواجب/, "the student UI must explain why a reviewed response is locked");
assert.match(backend, /assignmentMatch&&method==="PATCH"/, "assignment updates must be supported");
assert.match(backend, /assignmentMatch&&method==="DELETE"/, "assignment deletion must be supported");
assert.match(backend, /لا يمكن حذف واجب له تسليمات محفوظة/, "assignment deletion must preserve existing submissions");
assert.match(app, /data-assignment-edit=/, "staff must have an assignment edit control");
assert.match(app, /data-assignment-delete=/, "staff must have an assignment delete control");

assert.match(backend, /if\(path==="\/api\/assignment-review"&&method==="POST"\)/, "teacher assignment review API must exist");
assert.match(backend, /if\(b\.reopen===true\)/, "authorized staff must be able to reopen a reviewed assignment");
assert.match(backend, /review_history:|submission\.review_history=history\.slice\(-10\)/, "reopening must preserve the previous review history");
assert.match(backend, /review_history:Array\.isArray\(previous\?\.review_history\)\?previous\.review_history:\[\]/, "resubmitting a reopened assignment must retain earlier reviews");
assert.match(app, /data-assignment-reopen=/, "staff must have a visible reopen control for reviewed submissions");

assert.match(backend, /canManageGroup\(env,user,assignment\.group_id\)/, "assignment submissions and grading must be group-scoped");
assert.match(app, /async function assignmentsPage\(v\)/, "the assignment workflow must have a UI page");
assert.match(app, /"assignments","واجباتي"/, "students must have a visible navigation entry for assignments");
assert.match(backend, /if\(path==="\/api\/messages\/recipients"&&method==="GET"\)/, "message recipient list API must exist");
assert.match(backend, /if\(path==="\/api\/messages"&&method==="POST"\)/, "private message send API must exist");
assert.match(backend, /if\(path==="\/api\/messages\/read"&&method==="POST"\)/, "private message read-state API must exist");
assert.match(backend, /messageRecipientRows\(env,user\)/, "message recipients must be filtered by role and scope");
assert.match(backend, /map\(row=>\(\{id:row\.id,name:row\.display_name,role:row\.role\}\)\)/, "admin recipient entries must expose the display name used by the inbox");
assert.match(backend, /message\.recipient_user_id!==user\.id/, "only message recipients may mark messages read");
assert.match(app, /async function messagesPage\(v\)/, "private messaging needs an inbox UI");
assert.match(app, /"messages","الرسائل"/, "private messaging must be reachable in navigation");
assert.match(app, /data-week-part="memorization"/, "the Quran plan must let users set weekly memorization targets");
assert.match(app, /data-week-part="revision"/, "the Quran plan must let users set weekly revision targets");
assert.match(app, /data-week-part="understanding"/, "the Quran plan must let users set weekly understanding targets");
assert.match(app, /data-week-part="application"/, "the Quran plan must let users set weekly application targets");
assert.match(app, /weekly_targets:\[0,1,2,3\]\.map/, "the UI must save four structured weekly targets rather than one repeated field");
assert.match(backend, /frequency_days:14,recurring,series_id:seriesId/, "recurring tests must record their two-week cadence");
assert.match(backend, /if\(!latest\.due_date\|\|latest\.due_date>=today\)continue/, "a recurring test must remain open through its due date");
assert.match(backend, /status:"archived",archived_at:rolloverAt,archived_by:"system",archive_reason:"recurring_rollover"/, "the prior recurring cycle must be archived while preserving its results");
assert.match(backend, /status:"published",archived_at:null,archived_by:null,archive_reason:null/, "the newly generated recurring cycle must be published and unarchived");

assert.match(backend, /item\.status==="archived"\|\|!item\.recurring\|\|!item\.series_id/, "archived test series must stop generating future instances");
assert.match(backend, /parsed\.value\.action==="archive"/, "staff must be able to archive tests while preserving their records");
assert.match(backend, /const savedAttempts=attempts\.filter\(item=>targetIds\.has\(item\.test_id\)\)/, "tests with saved student attempts must not be permanently deleted");
assert.match(app, /data-test-archive=/, "staff must see an archive action instead of destructive deletion");
assert.match(app, /الاختبارات المؤرشفة/, "staff must be able to view archived tests and their preserved results");
assert.match(backend, /day:academyDate\(\),submitted_at:nowIso\(\)/, "quiz attempts must store the school-local day for heart penalties");
assert.match(backend, /a\.day\|\|\(a\.submitted_at\?academyDate\(new Date\(a\.submitted_at\)\):""\)/, "older quiz attempts must be classified by school-local date when calculating daily hearts");



assert.match(app, /function showPasswordChange\(forced=false\)/, "the UI must support a forced password-change dialog");
assert.match(app, /if\(S\.user\?\.must_change_password\)\{renderTopActions\(\);showPasswordChange\(true\)\}/, "the UI must open the mandatory dialog after login");
assert.match(app, /12345678/, "the interface must communicate the agreed shared first-login password");
assert.match(migration, /must_change_password INTEGER NOT NULL DEFAULT 0/, "the D1 migration must add the password-change flag");
const appVersion = index.match(/app\.js\?v=([\w-]+)/)?.[1];
assert.ok(appVersion, "the app asset must have a versioned URL");
assert.ok(serviceWorker.includes(appVersion), "service-worker cache version must match the app assets");

assert.ok(backend.includes('if(path==="/api/admin/roster-add"&&method==="POST")'), "bulk roster insertion must be admin-only");
assert.ok(backend.includes('collection=\'student_profiles\''), "student profile fields must use the existing flexible D1 records store");
assert.ok(backend.includes('studentProfileMatch&&method==="PATCH"'), "student academic profile updates must have a dedicated API route");
assert.ok(backend.includes('if(count>0){skipped++;continue}'), "bulk roster insertion must skip every already-existing normalized student name");
assert.ok(backend.includes('findDuplicateStudentByName(env,name)'), "new student creation and public signup must reject an existing normalized student name");
assert.ok(backend.includes('WHERE id=? AND user_id IS NULL'), "student account linking must be single-writer and prevent a second account racing onto one student");
assert.ok(!app.includes('id="roster-add-form"'), "the requested obsolete roster insertion form must stay removed from the UI");
assert.doesNotMatch(app, /async function postsPage\(v\)/, "the removed Sheikh Library screen must not remain in the frontend");
assert.doesNotMatch(backend, /path===\"\/api\/posts\"/, "the removed Sheikh Library API must not remain exposed");

assert.doesNotMatch(app, /"tests","posts","notifications"/, "the removed Sheikh Library must not appear in staff or student navigation");
assert.match(app, /القسم غير متاح/, "stale or unknown navigation state must show a recovery message rather than remain loading");
assert.doesNotMatch(app, /\["school-managers","مديرو المدارس"\]/, "the obsolete school managers navigation entry must stay removed");
assert.doesNotMatch(app, /if\(S\.tab==="school-managers"\)return schoolManagers\(v\);/, "the removed school managers screen must not be reachable from the app dispatcher");
assert.doesNotMatch(app, /id="staff-form"/, "the old director/supervisor account-creation form must not reappear in the main interface");
assert.doesNotMatch(app, /api\("\/admin\/staff",\{method:"POST"/, "the obsolete manager/supervisor account-creation form must not be reachable in the UI");
assert.match(backend, /if\(path==="\/api\/admin\/staff"&&method==="POST"\)/, "the backend must create scoped director and supervisor accounts");
assert.match(backend, /must_change_password\) VALUES\(\?,\?,\?,\?,\?,1,1\)/, "director and supervisor accounts must require a first-login password change");
assert.ok(!app.includes('id="roster-add-form"'), "the obsolete nominal roster import form must remain removed from the UI");
assert.match(app, /function playUiSound\(kind="click"\)/, "optional non-musical UI sound effects must be implemented");
assert.ok(app.includes('id="settings-ui-sounds"') && app.includes('id="settings-sound-preview"'), "sound settings must provide a toggle and preview control");
assert.match(app, /ihsan_ui_sounds/, "sound preference must be persisted locally");
assert.match(backend, /if\(path==="\/api\/admin\/roster-add"&&method==="POST"\)/, "nominal roster import must use the Cloudflare API");
assert.match(backend, /if\(count>0\)\{skipped\+\+;continue\}/, "retries and repeated roster names must never create duplicate student profiles");

assert.ok(app.includes('id="student-profile-form"'), "staff must be able to edit student academic and guardian profile fields");
assert.match(app, /<details class="move-control"><summary class="btn secondary">نقل الفوج<\/summary><div class="move-control-options"><label class="field">الفوج الجديد<select data-move-student=/, "student group choices must stay hidden until the move control is opened");
assert.match(app, /<option value="" selected disabled>اختر الفوج الجديد<\/option>/, "student transfer must require an explicit destination instead of defaulting to the first group");
assert.match(app, /data-save-move=/, "student transfer must retain a separate confirmation action");
assert.match(style, /\.move-control-options\{display:grid/, "the expandable group picker must have a dedicated layout");
assert.match(style, /move-control>summary\{display:inline-flex/, "the transfer disclosure must keep a usable button-sized target");
assert.doesNotMatch(app, /id="roster-add-form"/, "no line-by-line roster import control should be exposed");
assert.match(app, /const dailySupplications=\[/, "student and staff dashboard must include source-labelled rotating supplications");
assert.match(app, /const dailyWisdom=\[/, "dashboard must include educational benefits that are clearly not presented as scripture");
assert.match(app, /sourceLine\.hidden=!source/, "welcome dialog must display source or composition labels for supplications");
assert.match(app, /function showRotatingEntryPrayer\(\)/, "entry prayer must rotate with sourced supplications on refresh");
assert.ok(app.includes('setup?"إنشاء حساب المدير":"تسجيل الدخول"'), "the authentication form should use the clear sign-in action label");
assert.match(app, /safeStore\.setSession\("ihsan_last_mode","school"\)/, "the selected school workspace must be persisted across reloads");
assert.match(app, /allah:'<path d="M12 21v-9"/, "knowledge/Allah area must use a botanical icon rather than a sparkle");
assert.match(app, /prophet:'<path d="M7 3\.5/, "Prophet biography area must use a manuscript icon rather than a sparkle");
assert.match(app, /daily-nourishment-grid/, "the dashboard must render daily supplication and learning-benefit cards");
assert.match(app, /\$\("#open-school"\)\.onclick=openSchoolModule/, "the platform chooser must open the Quran school workspace");
assert.match(app, /\$\("#open-ihsan"\)\.onclick=openIhsanTeaser/, "the second platform must open a preview-only teaser, not a live workspace");
assert.match(app, /const IHSAN_PREVIEW_ONLY=true/, "the second platform must remain explicitly locked behind a preview flag");
assert.match(app, /const IHSAN_PREVIEW_SECTIONS=\[/, "the second platform preview must list section titles only");
assert.match(app, /function openIhsanTeaser\(\)/, "the second platform teaser must be implemented");
assert.doesNotMatch(app, /S\.mode="ihsan";S\.tab="all";shell\(\);await page\(\)/, "direct access to the locked second platform must be blocked");
assert.match(app, /if\(S\.mode==="ihsan"\)\{S\.mode="hub";moduleChooser\(false\);return\}/, "the page router must redirect any locked second-platform state to the hub");
assert.match(app, /if\(savedMode==="ihsan"\)\{safeStore\.setSession\("ihsan_last_mode","hub"\)/, "a saved locked mode must be cleared on startup");
assert.match(style, /\.ihsan-teaser\{/, "the second platform teaser must have dedicated styling");
assert.match(app, /safeStore\.setSession\("ihsan_last_mode","school"\)/, "the selected school workspace must be persisted across reloads");
const styleVersion = index.match(/style\.css\?v=([\w-]+)/)?.[1];
assert.ok(styleVersion && serviceWorker.includes(styleVersion), "service-worker cache must match the stylesheet asset version");
assert.match(app, /title:"وداع اليوم بدعاء من القرآن"/, "logout dialog must rotate in authentic Quranic supplications");
assert.match(app, /title:"دعاء نبوي في طلب العلم النافع"/, "logout dialog must include a sourced prophetic supplication");
assert.match(app, /kind:"دعاء بصياغة الأكاديمية"/, "composed supplications must be labelled as academy-written rather than attributed to revelation");
assert.match(app, /source:prayer\.source\|\|\(prayer\.kind\?prayer\.kind/, "the prayer dialog must show a source or composition label");
assert.match(app, /const evidenceByTab=\{/, "each core learning garden must expose a sourced evidence card");
assert.match(app, /سورة الحشر، الآية 22/, "the Allah knowledge card must cite its Quranic evidence");
assert.match(app, /سورة الأحزاب، الآية 21/, "the Prophet biography card must cite its Quranic evidence");
assert.match(app, /صحيح مسلم، حديث 2699/, "the knowledge-seeking hadith must include its source");
assert.match(app, /صحيح مسلم، حديث 2594/, "the kindness hadith must include its source");
assert.match(app, /curriculum-evidence-text/, "the learning curriculum must render scripture evidence as a distinct readable card");
assert.match(app, /تسجيل الخروج/, "the exit dialog must use a neutral action label rather than a student-only journey label");
assert.match(app, /\["hifzprogram","الحال المرتحل"\]/, "the Ihsan learning navigation must expose the Quran memorization program");






assert.doesNotMatch(app, /14\\.5 ساعة/, "the concise overview must defer catch-up details to the daily and weekly plans");
assert.match(app, /data-lesson="hifzprogram"/, "the Quran memorization program must be reachable from the curriculum tiles");
assert.match(app, /hifz-program-stack/, "the memorization program must render its dedicated responsive sections");
assert.ok(app.includes('["hifzprogram","الحال المرتحل"]'), "Ihsan navigation must include the al-Hall al-Murtahil Quran program");





assert.ok(app.includes("مدينة الفاتحين") && app.includes("مدينة المصابرة") && app.includes("مدينة الثبات") && app.includes("مدينة الهدى") && app.includes("مدينة التقوى") && app.includes("مدينة الصادقين") && app.includes("مدينة الأبرار"), "all optional Quran journey city milestones must be present");
assert.ok(app.includes("ليس بالقوي"), "the educational title must not imply authentication of the weakly graded al-Hall al-Murtahil report");

assert.match(app, /ستُعرض لاحقًا في المهام اليومية والخطة الأسبوعية/, "overview must reserve detailed instructions for daily and weekly tasks");
assert.match(app, /hifz-milestone-grid/, "overview must retain a concise visual milestone map");
assert.doesNotMatch(app, /8 س و45 د|10 س و50 د|12 س و55 د|47 س و30 د/, "the overview must not disclose full weekly workload tables");
assert.doesNotMatch(app, /190 دقيقة، أي 3 ساعات و10 دقائق/, "daily arithmetic belongs in the later task plan, not the overview");
assert.match(style, /color:#173c30 !important/, "note text must contrast with its note background");
assert.match(style, /background:#edf6f0 !important/, "regular notes must use a clear light background");
assert.match(style, /hifz-program-note--info/, "informational notes must have a distinct color treatment");
assert.match(style, /hifz-program-note--important/, "important notes must have a distinct color treatment");
assert.match(app, /function showAcademyAbout\(\)/, "the app must provide a reusable academy overview dialog");
assert.match(app, /id="academy-about-open"/, "the global toolbar must expose academy information");
assert.match(app, /id="about-open-welcome"/, "the pre-login welcome screen must expose academy vision and features");
assert.match(app, /id="about-open-hub"/, "the interface chooser must expose academy overview before either interface is entered");
assert.doesNotMatch(app, /id="settings-about-open"/, "academy overview belongs on the pre-login screens, not the signed-in settings");
assert.match(app, /بناء إنسانٍ يعرف ربَّه/, "the overview must state the academy's educational vision");
assert.match(app, /برنامج «الحال المرتحل»/, "the overview must explain the Quran memorization program");
assert.match(app, /ستظهر في المهام اليومية والخطط الأسبوعية ذات الصلة/, "the overview must keep operational details in later tasks");
assert.match(style, /\.academy-about-dialog/, "the overview dialog must have dedicated responsive styling");
assert.match(style, /\.academy-about-grid/, "academy features must appear as readable information cards");
assert.doesNotMatch(app, /settings-about-section|settings-about-open/, "signed-in settings must not duplicate the academy overview entry");

assert.match(app, /const knowledgeVerses=\[/, "the welcome screen must use a maintained list of Quranic knowledge verses");
assert.match(app, /rotateKnowledgeVerses\(\)/, "Quranic knowledge verses must rotate automatically on the welcome screen");
assert.doesNotMatch(app, /knowledge-verse-next/, "the manual next-verse button must stay removed while explanatory release notes may mention its removal");
assert.match(app, /Math\.floor\(Math\.random\(\)\*choices\.length\)/, "a random welcome verse must be selected from the non-repeating candidates");
assert.match(app, /ihsan_last_knowledge_verse_index/, "the welcome verse must remember the previous selection across sessions");
assert.match(app, /filter\(index=>index!==previous\)/, "the welcome verse must avoid repeating the immediately previous verse");
for (const reference of ["سورة طه، الآية 114","سورة العلق، الآية 5","سورة الزمر، الآية 9","سورة المجادلة، الآية 11","سورة فاطر، الآية 28","سورة الإسراء، الآية 36"]) assert.ok(app.includes(reference), "missing Quranic verse reference: "+reference);
assert.match(style, /\.knowledge-verse-text/, "rotating Quranic verses must be styled readably");
assert.match(style, /body:has\(\.auth-layout\) \.knowledge-verse\{display:flex!important\}/, "rotating verses must remain visible in mobile sign-in layout");


assert.match(app, /appearance-demo-icon/, "icon appearance choices must each show a visual style sample");
assert.match(app, /appearance-size-demo/, "icon size choices must demonstrate small, medium and large sizes");
assert.match(app, /appearance-live-preview/, "settings must include a live preview of icons as they appear in the student UI");
assert.match(app, /data-icon-style="framed"/, "the framed icon style must remain selectable");
assert.match(app, /data-icon-size="large"/, "the large icon size must remain selectable");
assert.match(style, /\.appearance-demo-icon\[data-demo-style="bold"\]/, "bold style sample must look distinct from soft and framed samples");
assert.match(style, /\.appearance-size-demo\[data-demo-size="large"\] svg/, "size samples must visually distinguish large icons");
assert.match(style, /\.appearance-live-item \.nav-icon/, "live preview must reflect current icon style and size settings");


assert.match(backend, /if\(path==="\/api\/admin\/student-team-supervisors"&&method==="POST"\)/, "the admin must be able to assign team supervisors from existing student records");
assert.match(backend, /SELECT id,display_name,group_id FROM students WHERE id=\? AND group_id=\? AND active=1/, "a team supervisor must be an active student in the selected group");
assert.match(app, /id="student-supervisors-form"/, "the combined groups screen must expose student supervisor assignment");
assert.match(app, /data-edit-supervision=/, "saved student supervision assignments must be editable");
assert.match(app, /name="team_name"/, "each group may contain multiple distinctly named student teams");
assert.match(app, /const groupHead=assignments\.find\(a=>a\.group_id===groupId\)/, "the chief supervisor selection must remain consistent at group level");
assert.match(backend, /const groupId=clean\(b\.group_id,80\),teamName=clean\(b\.team_name,80\)/, "team assignment must persist a distinct team name");
assert.match(backend, /WHERE id=\? AND group_id=\? AND active=1\"\)\.bind\(headId,groupId\)/, "the chief supervisor must be an active student in the same group");
assert.match(backend, /اسم هذه الفرقة مستخدم في الفوج/, "team names must be unique within a group");

assert.match(backend, /if\(path==="\/api\/student-teams"&&method==="GET"\)/, "team page API must return scoped teams and membership data");
assert.match(backend, /collection='student_team_memberships'/, "team membership must be persisted separately from supervisor assignments");
assert.match(backend, /الطالب ضمن فرقة أخرى؛ يجب تقديم طلب نقل رسمي والموافقة عليه/, "students must not be assigned to two teams without an approved transfer");
assert.match(backend, /if\(path==="\/api\/student-team-transfer-requests"&&method==="POST"\)/, "students must be able to submit formal team transfer requests");
assert.match(backend, /head_supervisor_student_id===actor.id/, "only the assigned chief supervisor may decide student transfer requests");

assert.match(backend, /if\(path==="\/api\/student-team-supervisor-requests"&&method==="POST"\)/, "students must be able to request approval to become team supervisors");
assert.match(backend, /supervisorRequestDecision=path\.match/, "the chief supervisor must be able to approve or reject supervisor requests");
assert.match(backend, /لا يمكن تعيين الطالب مشرفًا قبل اعتماد طلبه من كبير المشرفين/, "new team supervisors must be approved before assignment");
assert.match(app, /id="request-team-supervisor"/, "students must have a visible way to request team supervisor status");
assert.match(app, /data-supervisor-decision="approve"/, "the chief supervisor must be able to approve supervisor applications");

assert.match(app, /async function teamsPage\(v\)/, "the teams and transfer screen must be available in the app");
assert.match(app, /id="team-member-form"/, "team supervisors and staff must be able to assign students to teams");
assert.match(app, /id="team-transfer-form"/, "students must be able to submit formal transfer requests");
assert.match(app, /data-transfer-decision="approve"/, "the chief supervisor must have a visible transfer approval action");




assert.match(app, /اسم الدخول للطالب \(الاسم الكامل افتراضيًا\)/, "individual student account creation must use the full name by default");
assert.match(backend, /INITIAL_STUDENT_PASSWORD/, "the shared initial password must be enforced by the backend rather than a browser-generated random value");
assert.match(app, /id="admin-focus-toggle"/, "the director account must be able to switch between daily teaching and administration");
assert.match(app, /makeGroup\("الرئيسية والطلاب"/, "admin daily focus must present a concise administration entry point");
assert.match(app, /makeGroup\("الترتيب الأسبوعي\/الشهري"/, "admin navigation must expose one weekly/monthly ranking entry");
assert.doesNotMatch(app, /sheikh-combined-ranking|combined-rank-group|combined-rank-period|combined-rank-results|loadCombinedStudentRanking/, "the broken duplicate home ranking and its delegated event handler must stay removed");
assert.match(app, /الترتيب الأسبوعي\/الشهري/, "staff must retain a visible path to the official effort ranking");
assert.match(app, /S\.tab==="effort-ranking"\)return effortRankingPage\(v\)/, "the official effort ranking must remain routed");
assert.match(app, /if\(S\.user\.role==="teacher"\)return \[\["home","الرئيسية"\].*?\["reports","التقارير"\]/, "teacher navigation items must expose the existing reports page");
assert.match(app, /makeGroup\("المتابعة والتقويم",\["gradebook","reports","notifications","messages"\]\)/, "the teacher navigation group must include reports");
assert.match(app, /if\(S\.tab==="reports"\)return reportsPage\(v\)/, "the reports navigation entry must continue to open the existing reports page");
assert.match(app, /if\(S\.tab==="home"\)return await home\(v\);if\(S\.tab==="teams"\)return await teamsPage\(v\);if\(S\.tab==="groups"\)return groups\(v\)/, "primary home, teams, and groups navigation must remain available");
assert.match(app, /أيام التقدم في القرآن: <strong>'\+Number\(gam\.stats\?\.quran_days\|\|0\)/, "Quran activity days must not be mislabeled as dawn attendance");
assert.doesNotMatch(app, /القلوب المتبقية اليوم|gam\.hearts/, "the student dashboard must not imply an unenforced daily hearts limit");
const quranFunction = app.slice(app.indexOf("async function quran(v){"), app.indexOf("\nconst EFFORT_TASKS=", app.indexOf("async function quran(v){")));
assert.match(quranFunction, /await quranRosterPage\(\$\("#quran-staff-body"\)\)/, "staff Quran tracking must delegate to the active roster page");
assert.doesNotMatch(quranFunction, /quranMode|qform|qhistory|thumn_from/, "unreachable legacy Quran recording code must stay removed");
assert.match(app, /function honorificDisplayName\(name,role\)/, "staff names must use the shared Sheikh honorific formatter");
assert.match(app, /const displayUserName=honorificDisplayName\(S\.user\.name,S\.user\.role\)/, "the signed-in director, teacher and administrator names must use the shared honorific formatter");
assert.match(app, /id="quran-roster-load"/, "staff Quran tracking must load the active group roster");
assert.match(app, /id="quran-roster-save"/, "staff Quran tracking must save entries from the active roster page");
assert.match(app, /data-quran-amount/, "the active Quran roster must retain per-student memorization or revision entry");
assert.match(app, /id="settings-open-notifications"/, "settings must provide a direct path to notifications");
assert.doesNotMatch(app, /id="settings-done"/, "appearance preferences apply immediately without a Done button");


assert.match(app, /const dailyWisdomForSheikh=\[/, "teaching advice must be separated from student etiquette advice");
assert.match(app, /const wisdomPool=\["admin","teacher","director","supervisor"\]\.includes\(S\.user\.role\)\?dailyWisdomForSheikh:dailyWisdom/, "daily educational guidance must match the user's role");
assert.match(app, /if\(S\.tab==="home"\)return await home\(v\);if\(S\.tab==="teams"\)return await teamsPage\(v\);if\(S\.tab==="groups"\)return groups\(v\);/, "only current, supported panels must be reachable from the active page router");
assert.match(app, /async function pointsPage\(v\)/, "the learning-economy screen must be reachable from the app");
assert.match(backend, /path==="\/api\/points\/summary"/, "the backend must expose the points summary endpoint");
assert.match(app, /async function tasksPage\(v\)/, "the unified student tasks screen must be reachable from the app");
assert.match(backend, /path==="\/api\/tasks"/, "the backend must expose the unified tasks endpoint");
assert.match(app, /async function contentPage\(v\)/, "the hadith and mutoon screen must be reachable from the app");
assert.match(backend, /path==="\/api\/content"/, "the backend must expose the sourced content endpoint");
assert.match(app, /async function competitionsPage\(v\)/, "the competitions screen must be reachable from the app");
assert.match(backend, /path==="\/api\/competitions"/, "the backend must expose the competitions endpoint");
assert.match(backend, /COMPETITION_STATUS_FLOW/, "competition lifecycle transitions must be server-enforced");
assert.match(backend, /competitionEligibility\(env,user,competition\)/, "registration must enforce age, hizb and riwaya eligibility");
assert.match(backend, /competitionCanManage\(env,user,competition\)/, "competition management and awards must be permission-gated");
assert.match(backend, /competitionCanJudge\(env,user,competition,registration\)/, "judging must be scoped to assigned judges or managed groups");
assert.match(backend, /eventKey:"competition:"\+competitionId\+":"\+row\.student_id\+":award"/, "competition awards must be idempotent per student and competition");
assert.match(backend, /sourceCollection:"competition_results"/, "competition awards must reference their approved result");
assert.match(backend, /if\(list\.some\(row=>\["approved","published"\]\.includes\(row\.status\)\)\)return fail\(409,"النتائج معتمدة مسبقًا"\)/, "approved competition results must not be awarded twice");
assert.doesNotMatch(backend, /auto_?correct|ai_?correct/i, "competitions must not claim automatic recitation correction");
assert.match(backend, /CREATE TABLE IF NOT EXISTS competition_reference_terms/, "competition terms must be editable reference data, not hardcoded seasonal rules");
assert.match(backend, /memorized_hizb/, "competition eligibility must use the explicit memorized-hizb field when present");
assert.match(app, /data-competition-tab/, "the competitions screen must expose role-aware tabs");
assert.match(app, /data-register-form=/, "students must register from the competitions screen");
assert.match(app, /data-score-form/, "judges must score criteria from the competitions screen");
assert.match(app, /data-panel-generate/, "results generation must be available to authorized staff");
assert.match(app, /data-panel-approve/, "result approval must be an explicit staff action");
assert.match(app, /data-event-form=/, "the competition calendar must be editable from the UI");
assert.match(app, /data-term-save/, "reference terms must be editable from the UI");
for (const table of ["competition_categories", "competitions", "competition_registrations", "competition_judges", "competition_scores", "competition_results", "competition_events", "competition_reference_terms"]) {
  assert.match(competitionsMigration, new RegExp("CREATE TABLE IF NOT EXISTS " + table), "0006 must create " + table);
}
assert.match(competitionsMigration, /INSERT OR IGNORE INTO point_rules[^;]*competition_award/, "0006 must seed the competition award rule");
assert.doesNotMatch(competitionsMigration, /DELETE FROM academy_records/, "the legacy competition import must never delete old records");


assert.doesNotMatch(app, /class="auth-entry-nourishment"/, "the login screen must stay clean without rotating dua cards");
assert.doesNotMatch(app, /class="auth-entry-card"/, "the login screen must not include educational benefit cards");

assert.match(app, /console\.warn\("تنبيه أمني من أكاديمية الإحسان:/, "the academy must show an Arabic anti-self-XSS warning in the browser console");
assert.match(app, /لا تُدخل أو تلصق أي شيفرة لا تفهمها/, "the Arabic console warning must advise users not to paste unknown code");

const healthStart = backend.indexOf('if (path === "/api/health"');
const healthEnd = backend.indexOf('if (path === "/api/setup/status"', healthStart);
const healthBlock = healthStart >= 0 && healthEnd > healthStart ? backend.slice(healthStart, healthEnd) : "";
assert.ok(healthBlock && !healthBlock.includes("COUNT(*) AS n FROM users") && !healthBlock.includes("users:users?.n"), "public health checks must not disclose account totals");


assert.match(app, /function enqueueOfflineWrite\(/, "offline writes must enter an explicit local queue");
assert.match(app, /function mergeOfflineQueue\(/, "cached reads must merge queued attendance and Quran records");
assert.match(app, /async function flushOfflineQueue\(quiet=true\)/, "queued records must sync when connectivity returns");
assert.match(app, /function showAcademyUpdateNotice\(\)/, "the installed app must announce an available update");
assert.match(app, /id="settings-notifications-enable"/, "notification permission must be a user-controlled setting");
assert.match(app, /id="settings-notifications-test"/, "notification settings must provide a test action");
assert.match(app, /release-history-section/, "settings must expose the feature and release history");
assert.match(app, /const retainedActions=\$\("#top-actions"\),retainedHeader=document\.querySelector\("header\.topbar"\)/, "the global action bar must survive page rerenders");
assert.match(app, /const sortOptions=\[\["points","النتيجة العامة"\]/, "the ranking must support multiple sorting domains");
assert.match(app, /كل الأفواج/, "the manager must be offered an all-groups ranking option");
assert.match(backend, /const scopeAll=user\.role==="admin"&&url\.searchParams\.get\("scope"\)==="all"/, "only the general admin may request all-groups ranking");
assert.match(backend, /group_name:st\.group_name\|\|""/, "overall ranking must include group names");
assert.match(backend, /يتعارض معرّف الفوج مع سجل موجود؛ لم تُغيّر البيانات/, "offline retries must not overwrite an existing unrelated group");
assert.match(backend, /يتعارض معرّف التسجيل مع سجل آخر؛ لم تُغيّر البيانات/, "offline Quran retry must not overwrite another record");
assert.doesNotMatch(app, /data-appearance-mode="dark"|data-appearance-palette="dark"/, "the interface must not expose a dark appearance mode");
assert.match(style, /\.academy-update-notice/, "the update banner must have responsive styling");
assert.match(style, /\.release-history-item/, "the in-app release history must be styled");
const releaseVersion = index.match(/app\.js\?v=([\w-]+)/)?.[1];
assert.ok(releaseVersion, "frontend cache busting must use the latest asset version");
for (const asset of ["app.js", "style.css", "startup.js", "fonts.css"]) {
  assert.ok(index.includes(`/${asset}?v=${releaseVersion}`), `${asset} cache busting must match the release version`);
}
assert.ok(serviceWorker.includes(releaseVersion), "service worker cache namespace must match this release");
assert.match(app, /secondary:""/, "welcome dua must have one Continue button rather than Later");
assert.match(app, /primary:"متابعة"/, "the rotating welcome dua must use the requested Continue label");
assert.match(app, /function rememberOfflineUser\(\)/, "offline startup may only rely on the minimal stored profile, never the password");


assert.match(app, /function startOfflineFromCache\(\)/, "startup must enter a cached offline session after a network failure");
assert.match(app, /function isOfflineNetworkError\(error\)/, "offline fallback must distinguish network failures from authorization errors");
assert.match(app, /age>30\*24\*60\*60\*1000/, "the local offline profile must expire after 30 days");
assert.match(app, /if\(offlineSessionActive\|\|!S\.user\?\.id\)return;/, "offline use must not renew the local profile expiry timestamp");
assert.match(app, /if\(offlineSessionActive\)\{offlineSessionActive=false;rememberOfflineUser\(\)\}/, "a successful online API response must refresh the profile timestamp and end offline mode");
assert.match(app, /safeStore\.remove\(offlineUserKey\(\)\);clearSessionToken\(\);auth\(false\)/, "logout must remove the local offline profile");

assert.match(app, /صيانة 22 أكتوبر 2026 · منشورة/, "the feature history must reflect the successful production deployment");
assert.match(app, /اجتازت فحوص الكود والبناء والنشر/, "the feature history must separate deployment success from pending hands-on acceptance testing");
assert.doesNotMatch(app, /أين أدبك مع فضيلة الشيخ/, "student education should model respectful manners instead of scolding students");
assert.match(app, /جامع بيان العلم وفضله/, "student adab guidance must cite the reported scholarly example as an athar, not a Prophetic hadith");
assert.match(app, /حلية طالب العلم/, "student adab guidance must cite a recognized reference on etiquette of learning");
assert.match(style, /body :is\(\.small,small,\.muted,/, "font scaling must include ordinary muted secondary text, not only small-muted combinations");
assert.match(style, /table th,table td/, "font scaling must include report table contents");
assert.match(app, /ihsan_last_dashboard_dua_index/, "the dashboard dua must rotate on every refresh");
assert.match(app, /filter\(index=>index!==previousDuaIndex\)/, "the dashboard dua must avoid immediately repeating the prior dua");
assert.match(app, /سنن أبي داود \(1522\)، والنسائي \(1303\)؛ صححه الألباني/, "the remembrance dua must show its source and grading");
assert.doesNotMatch(about, /rel="canonical"/, "the internal about page must not publish a canonical URL");
assert.doesNotMatch(privacy, /rel="canonical"/, "the internal privacy page must not publish a canonical URL");
assert.match(index, /منصة داخلية للمسجلين المعتمدين/, "the home page must present itself as the internal platform for approved members");
assert.match(index, /<meta name="robots" content="noindex/, "the internal platform must not be indexable");
for (const [name, page] of [["about", about], ["privacy", privacy]]) {
  for (const asset of ["fonts.css", "style.css"]) {
    assert.ok(page.includes(`/${asset}?v=${releaseVersion}`), `${name} page ${asset} version must match the release`);
  }
}
assert.doesNotMatch(about, /fonts\.googleapis\.com|rel="stylesheet" href="\/ihsan-dark-theme\.css/, "about page must use the self-hosted consolidated stylesheet");
assert.doesNotMatch(privacy, /fonts\.googleapis\.com|<style>/, "privacy page must use the self-hosted consolidated stylesheet");
assert.match(index, /class="boot-splash"/, "the initial HTML must show a compact neutral splash while the app initializes");
assert.match(index, /<strong>أكاديمية الإحسان<\/strong>/, "the initial splash must identify the academy without stale public-page content");
assert.match(app, /id="signup-form"/, "visitors must retain the self-service signup entry point after the app initializes");
assert.match(app, /يبقى طلبك قيد الاعتماد/, "visitors must learn that join requests wait for authorized approval after the login interface initializes");
assert.match(index, /<a class="skip-link" href="#app">/, "the home page must provide a keyboard skip link");
assert.match(about, /<a class="skip-link" href="#main-content">/, "the about page must provide a keyboard skip link");
assert.match(about, /حساب طالب يُسند إلى فوج بعد اعتماد الشيخ أو الإدارة/, "the about page must explain the approval-based open signup accurately");
assert.match(privacy, /PBKDF2-SHA-256/, "the privacy page must describe the implemented password-hashing method");
assert.match(privacy, /حتى 12 ساعة عادةً، أو حتى 30 يومًا/, "the privacy page must describe the implemented session durations");
assert.match(privacy, /لا تحدد هذه النسخة مدة احتفاظ زمنية منشورة/, "the privacy page must disclose the missing published retention period");
assert.doesNotMatch(privacy, /يُحفظ رمز جلسة في تخزين المتصفح|لا تُباع البيانات الشخصية للإعلانات/, "the privacy page must not claim unsupported browser token storage or advertising promises");
assert.match(robots, /Disallow: \//, "the internal platform robots.txt must keep crawlers out");
assert.doesNotMatch(robots, /Allow: \//, "the internal platform robots.txt must not advertise an allow-all crawl");
assert.doesNotMatch(sitemap, /<url>/, "the internal sitemap must not advertise indexable URLs");
assert.match(redirects, /\/about\.html\s+\/about\s+301/, "existing static path redirects must remain intact");

// Journey and store guardrails: reuse existing storage and show only real catalog rows.
assert.match(backend, /collection='student_journey'/, "journey state must use the existing academy_records store");
assert.doesNotMatch(backend, /CREATE TABLE IF NOT EXISTS student_journey/, "journey must not add a duplicate table");
assert.match(backend, /saveQuranPathForStudent\(env,user,student/, "journey apply must reuse the existing Quran path writer");
assert.match(backend, /saveQuranPlanForStudent\(env,user,student/, "journey apply must reuse the existing Quran plan writer");
assert.match(backend, /storeRecommendationPayload\(enriched,balance\)/, "student store reads must derive recommendations from real store rows");
assert.match(backend, /if\(path==="\/api\/store\/items"&&method==="POST"\)\{\s*if\(user\.role!=="admin"\)return fail\(403,"إدارة المتجر للمدير فقط"\)/, "store creation and edits must remain admin-only");
assert.doesNotMatch(app, /const STORE_SUGGESTIONS=|data-store-suggest/, "the store must not invent sample rewards or point costs");
assert.match(app, /لا توجد مواد افتراضية/, "the admin store must clearly require the owner's approved catalog");
assert.match(app, /async function quranPlansReviewPage\(v\)/, "staff must have a journey review screen");
assert.match(style, /\.journey-shell\{/, "the student journey must have dedicated responsive styling");
assert.match(style, /\.store-terms\{/, "store redemption terms must be visibly styled");
assert.match(style, /prefers-reduced-motion:reduce\)\{\s*\.journey-meter/, "journey and store motion must respect reduced-motion preferences");

// Mobile identity and administration access must never disappear.
assert.match(app, /id="identity-open"/, "the workspace header must expose the signed-in identity");
assert.match(app, /function identitySheet\(\)/, "tapping the identity chip must open an account sheet");
assert.match(app, /id="identity-switch-module"/, "the account sheet must offer the school/Ihsan module switch");
assert.match(app, /id="identity-admin-focus"/, "the account sheet must let an admin switch between daily and full administration");
assert.match(app, /function adminFocusIsFull\(\)\{return safeStore\.get\("ihsan_admin_focus"\)!=="daily"\}/, "admin tools must be visible by default, not hidden behind an unset preference");
assert.match(app, /class="module-user-line"/, "the hub must state who is signed in and with which role");
assert.doesNotMatch(style, /\.workspace-heading>p,\.workspace-search,\.workspace-user\{display:none\}/, "mobile CSS must not hide the signed-in identity");
assert.match(style, /\.workspace-user\{display:flex;margin-inline-start:auto/, "the signed-in identity must remain visible on mobile");
assert.match(style, /\.identity-sheet\{/, "the mobile account sheet must have dedicated styling");
assert.match(app, /S\.groups=\[\.\.\.S\.groups,\{\.\.\.created,description:"",level:"عام"\}\]/, "creating a group must update local state instead of reloading every roster");

// Teacher accounts are deactivated, never hard-deleted, and only when unassigned.
assert.match(backend, /teacherMatch&&method==="DELETE"/, "teacher accounts must have a deactivation endpoint");
assert.match(backend, /UPDATE users SET active=0 WHERE id=\?"\)\.bind\(target\.id\)\.run\(\)/, "teacher deactivation must preserve the user row and its history");
assert.match(backend, /لا يمكن تعطيل حساب المعلم قبل إعادة تعيين أفواجه/, "teachers assigned to active groups must not be deactivated");
assert.match(backend, /teacher_deactivate/, "teacher deactivation must be audited");
assert.match(app, /data-delete-teacher=/, "admin must have a teacher deactivation control");
assert.match(app, /تعطيل الحساب/, "teacher deactivation must be labelled honestly");

// The global chief supervisor is one existing student supervising every group's team supervisors.
assert.match(backend, /GLOBAL_CHIEF_COLLECTION = "student_chief_supervisors"/, "the global chief must reuse the existing academy_records store");
assert.doesNotMatch(backend, /CREATE TABLE IF NOT EXISTS student_chief_supervisors/, "the global chief must not add a duplicate table");
assert.match(backend, /if\(path==="\/api\/admin\/chief-supervisors"&&method==="POST"\)/, "the admin must be able to appoint a global chief");
assert.match(backend, /isGlobalChiefStudent\(env,actor\.id\)/, "global chief decisions must bypass the same-group restriction");
assert.match(backend, /is_global_chief:isGlobalChief/, "the teams API must tell the global chief that cross-group scope is available");
assert.match(app, /id="chief-appoint-form"/, "the admin must have a visible global-chief appointment form");
assert.match(app, /data-chief-revoke=/, "the admin must be able to revoke a global-chief appointment");

// Content review states, attribution, and duas/adhkar drafts.
assert.match(backend, /duas: "dua_items", adhkar: "adhkar_items"/, "duas and adhkar must reuse the existing content store");
assert.match(backend, /const CONTENT_STATUSES = \["draft", "needs_source", "pending_review", "approved", "published", "archived"\]/, "content must support the documented review states");
assert.match(backend, /const CONTENT_ATTRIBUTIONS = \{/, "content must record how text relates to its author");
assert.match(backend, /if\(path==="\/api\/admin\/content\/seed-duas"&&method==="POST"\)/, "admins must be able to insert documented duas drafts");
assert.match(backend, /status:"pending_review"/, "seeded duas must wait for sheikh review, never publish automatically");
assert.match(app, /const KINDS=\{hadith:"الحديث النبوي",mutoon:"المتون العلمية",duas:"الأدعية المأثورة",adhkar:"الأذكار"\}/, "the content screen must expose duas and adhkar alongside hadith and mutoon");
assert.match(app, /data-content-kind="'\+key\+'"/, "content kind tabs must be rendered from the supported kinds");
assert.match(app, /id="seed-duas"/, "the admin must have a visible duas draft seed action");
assert.match(app, /pending_review:"بانتظار مراجعة الشيخ"/, "content statuses must be shown in plain Arabic");

// V71: student cards with three independent QR kinds, card scans, missions, and
// server-side rate limiting. All state reuses existing tables/records stores.
assert.match(backend, /collection='student_cards'/, "student cards must reuse the existing academy_records store");
assert.doesNotMatch(backend, /CREATE TABLE IF NOT EXISTS student_cards/, "student cards must not add a duplicate table");
assert.match(backend, /async function ensureStudentCard\(env, student, actorId = null\)/, "every student must have an idempotent card ensure function");
assert.match(backend, /id: student\.id, student_id: student\.id/, "the canonical card id and student_id must both use the immutable student id");
assert.match(backend, /ORDER BY CASE WHEN id=\? THEN 0 ELSE 1 END LIMIT 2/, "card lookup must inspect enough matches to detect duplicate records");
assert.match(backend, /if \(matches\.length > 1\) throw new Error\("student_card_duplicate_records"\)/, "duplicate cards must fail closed instead of choosing an arbitrary QR identity");
assert.match(backend, /card\.id !== card\.student_id \|\| card\.id !== matches\[0\]\.id/, "card id and student id must match the immutable canonical student identity");
assert.match(backend, /const CARD_KINDS = \{/, "card QR kinds must be declared explicitly");
assert.match(backend, /add_points: \{ label: "إضافة نقاط", ttlDays: 90, requiresAuth: true \}/, "the add-points QR must expire after 90 days");
assert.match(backend, /profile: \{ label: "الملف الشخصي", ttlDays: 365, requiresAuth: true \}/, "the profile QR must expire after 365 days");
assert.match(backend, /login: \{ label: "الدخول السريع", ttlDays: 365, requiresAuth: false \}/, "the login QR must expire after 365 days and stay anonymous");
assert.match(backend, /tokens\[kind\] = \{ hash: await hashToken\(secret\), secret, issued_at: now/, "card tokens must store a hash for verification and the secret for reprint");
assert.ok(backend.indexOf('path === "/api/cards/resolve"') > 0 && backend.indexOf('path === "/api/cards/resolve"') < backend.indexOf('const user=await currentUser(request,env); if(!user)return fail(401'), "card resolution must run before the login gate so the login QR can be read anonymously");
assert.match(backend, /requires_password:true,student:\{name:student\.name,username:student\.username/, "the login QR must return only a name and username, never a session");
assert.match(backend, /if\(kind==="add_points"&&!\["admin","teacher","director","supervisor"\]\.includes\(scanner\.role\)\)return fail\(403/, "authorized staff roles may scan add-points cards");
assert.match(backend, /if\(!await canAccessStudentCard\(env,scanner,student\)\)return fail\(403,"هذه البطاقة خارج صلاحيتك"\)/, "card scans must respect group scope");
assert.match(backend, /if\(path==="\/api\/student-cards\/bulk"&&method==="POST"\)/, "staff must be able to bulk-create group cards");
assert.match(backend, /student-cards\\\/\(\[\^\/\]\+\)\\\/reissue/, "cards must support reissue");
assert.match(backend, /student-cards\\\/\(\[\^\/\]\+\)\\\/revoke/, "cards must support revoke");
assert.match(backend, /if\(reason\.length<3\)return fail\(400,"اكتب سبب إلغاء الرمز"\)/, "revoking a card token must require a written reason");
assert.match(backend, /student_card_reissue/, "card reissue must be audited");
assert.match(backend, /student_card_revoke/, "card revoke must be audited");
assert.match(backend, /student_card_print/, "card printing must be audited");
assert.match(backend, /status:"present",note:"تسجيل حضور آلي بمسح بطاقة الطالب"/, "add-points card scans must automatically record attendance");
assert.match(backend, /if\(kind==="add_points"&&task==="attendance"\)/, "attendance is automatic only for attendance scans");
assert.match(backend, /eventType:"hifz_no_errors",eventKey:"hifz:"\+date\+":"\+student\.id/, "memorization scans award the idempotent 20-point hifz event");
assert.match(backend, /achievement_points=20,store_points=20,max_per_day=1/, "memorization awards must be worth 20 points");
assert.match(backend, /awardAttendancePoints\(env,\{groupId:student\.group_id,date,studentIds:\[student\.id\],awardedBy:scanner\.id\}\)/, "attendance scans must award points through the idempotent attendance engine");
assert.match(rateLimitsMigration, /CREATE TABLE IF NOT EXISTS rate_limits/, "0008 must create the rate-limit table");
assert.match(backend, /CREATE TABLE IF NOT EXISTS rate_limits/, "the worker must create the rate-limit table lazily when the migration is missing");
assert.match(backend, /async function rateLimit\(env, bucket, key, limit, windowSeconds\)/, "server-side rate limiting must be implemented");
assert.match(backend, /rateLimit\(env,"card-resolve:"\+kind,kind==="login"\?cardId:rateLimitKey\(request\),kind==="login"\?12:300,600\)/, "card scans must be rate limited per card for login codes and per IP otherwise");
assert.match(backend, /rateLimit\(env,"store-redeem",user\.student_id,20,600\)/, "store redemption must be rate limited per student");
assert.match(backend, /rateLimit\(env,"mission-claim",user\.student_id,10,600\)/, "mission claims must be rate limited per student");
assert.match(backend, /requestId=clean\(b\.request_id,80\)/, "store redemption must accept an idempotency key");
assert.match(backend, /redemptionId="rdm-"\+\(await hashToken\("redeem:"\+user\.student_id\+":"\+requestId\)\)\.slice\(0,32\)/, "the redemption id must be derived from the request id to prevent double deduction");
assert.match(backend, /if\(existing\)return json\(\{ok:true,duplicate:true/, "a repeated redemption request must return the existing order");
assert.match(backend, /rule-mission-side/, "a mission-side rule must seed into the existing points engine");
assert.match(backend, /eventType:"mission_side",eventKey:"mission:"\+missionId\+":"\+today\+":"\+user\.student_id/, "mission claims must use the existing award engine with a daily key");
assert.match(backend, /collection='student_missions'/, "mission claims must reuse the existing academy_records store");
assert.doesNotMatch(backend, /CREATE TABLE IF NOT EXISTS student_missions/, "missions must not add a duplicate table");
assert.match(backend, /image_url/, "store items must expose the optional product image");
assert.match(app, /"cards","بطاقات الطلاب"/, "staff navigation must expose the student cards screen");
assert.match(app, /function cardQrSheet\(links,actions\)/, "cards must render a shared three-QR sheet");
assert.match(app, /function cardQrFigure\(kind,links\)/, "each QR kind must render as a labelled figure");
assert.match(app, /function readScanHash\(\)/, "the app must parse #scan= links");
assert.match(app, /async function processPendingScan\(\)/, "scanned cards must route after login or immediately when signed in");
assert.match(app, /safeStore\.setSession\("ihsan_scan_notice"/, "an anonymous login scan must show a sign-in notice");
assert.match(app, /class="notice scan-notice"/, "the sign-in screen must display the scan notice");
assert.match(app, /const missionStory=\(missions\?\.story/, "the world page must render mission story milestones");
assert.match(app, /data-mission-claim=/, "the world page must let students claim completed daily missions");
assert.match(app, /document\.body\.dataset\.print="cards"/, "bulk card printing must use the dedicated print mode");
assert.match(app, /document\.body\.dataset\.print="card"/, "single card printing must use the dedicated print mode");
assert.match(style, /\.card-qr-grid\{/, "the three QR codes must have a responsive grid");
assert.match(style, /\.student-card-print\{/, "bulk cards must have a print-friendly card style");
assert.match(style, /body\[data-print="cards"\]/, "bulk card print mode must have dedicated print rules");
assert.match(style, /\.mission-story,\.mission-side\{/, "mission cards must have dedicated styling");
assert.match(style, /@media print\{[\s\S]*body\[data-print="card"\]/, "single card printing must hide the surrounding app shell");
assert.match(qrScript, /global\.IhsanQR = \{ matrix/, "the dependency-free QR encoder must expose the IhsanQR global");
assert.ok(index.includes("/qr.js?v=" + releaseVersion), "the QR encoder must be loaded with the current asset version");
assert.ok(serviceWorker.includes("/qr.js?v="), "the QR encoder must be cached by the service worker");

assert.match(app, /function idempotentFormRequestId\(form,payload\)/, "manual point forms must reuse a stable idempotency key while retrying");
assert.match(app, /form\.dataset\.idempotencyPayload===signature/, "a retry key must be reused only for an identical point payload");
assert.match(app, /form\.dataset\.submitting==="1"/, "manual point forms must ignore duplicate submissions while a request is active");
assert.match(app, /request_id:idempotentFormRequestId\(form,payload\)/, "manual award and adjustment forms must reuse their request key");
assert.match(app, /request_id:idempotentFormRequestId\(manualForm,payload\)/, "QR manual awards must reuse their request key across retries");
assert.match(app, /function storeItemImage\(item\)/, "student rewards must support real product imagery");
assert.match(app, /store-reco-card--locked/, "locked rewards must retain visual product-card presentation");
assert.match(app, /safeUrl=\/\^\(https:/, "external reward imagery must use HTTPS");
assert.doesNotMatch(app, /promote-level|sheikh-level|\/students\/level/, "level progression must stay deferred until the academy approves a levels system");
assert.match(app, /نموذج تجريبي قيد المراجعة · غير معتمد نهائيًا/, "Quran plan preview must be clearly marked experimental");
assert.match(app, /نموذج تجريبي · قيد المراجعة/, "Quran path choices must be marked experimental");
assert.match(app, /هذه الخطة نموذج تجريبي قابل للمراجعة/, "printed Quran schedules must carry the experimental warning");
assert.match(app, /status:"تجريبية"/, "development history must not claim the Quran plans are approved");
assert.match(app, /سلسلة المواظبة والأوسمة/, "existing achievement badges and streaks must remain available");

console.log("Security regression guardrails passed.");

assert.match(backend, /if\(user\.role!=="admin"\)return fail\(403,"اعتماد منح النقاط اليدوي للشيخ وحده"\)/, "manual point awards must be restricted to the Sheikh admin account");
assert.match(backend, /student_point_streaks/, "Masjid Al-Rahma streaks must persist in D1");
assert.match(backend, /return fail\(410,"تم إيقاف الاعتماد اليدوي للاستمرارية/, "manual streak awards must be disabled to prevent duplicate rewards");
assert.doesNotMatch(app, /scan-streak-form|اعتماد يوم الاستمرارية/, "manual streak award form must not be shown");
assert.match(app, /streakData\.streaks[\s\S]*streakData\.badges[\s\S]*streakBadgeRows/, "Sheikh panel must render activity streaks and badges");
assert.match(backend, /student_ethics/, "Masjid Al-Rahma ethics warnings must persist in D1");
assert.match(backend, /student_referrals/, "student referrals must be tracked before awarding the seven-day bonus");
assert.match(backend, /hifz_no_errors.*hifz_tajweed/, "the two memorization point values must be mutually exclusive");
assert.match(backend, /bonus_percent/, "the 30% support bonus must be configurable and audited");
assert.match(app, /رصيد النقاط الموحد/, "students must see one unified points balance");
assert.match(app, /الفجر · 30/, "the Sheikh scan panel must expose the new point activities");
assert.match(index, /ihsan-rules\.html/, "the Cloudflare entry page must link to the printable Ihsan rules");

assert.doesNotMatch(app, /points_awarded\|\|0/, "badge UI must not show zero-point labels");

assert.match(backend, /path === "\/api\/auth\/google\/signup"/, "new account creation must use the dedicated Google-verified endpoint");
assert.match(backend, /claims\.email_verified===true\|\|claims\.email_verified==="true"/, "Google identities must have a verified email claim");
assert.match(backend, /INSERT INTO google_identities \(google_sub,user_id,email,linked_at\)/, "Google signup must persist the verified subject-to-account link");
assert.match(backend, /findDuplicateStudentByName\(env,name\)/, "Google signup must not create duplicate student profiles");
assert.match(backend, /path === "\/api\/auth\/google\/reset-password"/, "password recovery must use a separate Google proof endpoint");
assert.match(backend, /rateLimit\(env,"google-password-reset"/, "Google password recovery must be rate limited");
assert.match(backend, /DISABLE_LEGACY_PASSWORD_SIGNUP==="true"/, "production must reject unverified manual signup requests");
assert.match(app, /id="google-signup"/, "signup must provide a Google identity button");
assert.match(app, /\/auth\/google\/signup/, "signup UI must submit the Google credential to the verified endpoint");
assert.doesNotMatch(app, /<label class="field">البريد الإلكتروني<input name="email" type="email" required maxlength="200"/, "signup must not ask users to type an unverified email");
assert.doesNotMatch(app, /<label class="field">كلمة المرور \(10 أحرف على الأقل\)<input name="password"/, "signup must not create password-only accounts with unverified identities");
assert.match(app, /id="forgot-password"/, "login must expose account recovery");
assert.match(app, /\/auth\/google\/reset-password/, "account recovery UI must call the Google-verified reset endpoint");
assert.match(app, /function showGooglePasswordRecovery\(\)/, "account recovery must require a Google identity and new password");
assert.match(index, /name="robots" content="noindex, nofollow, noarchive"/, "the private student platform must remain excluded from public indexing");
assert.match(serviceWorker, /"\/manifest\.json"/, "the installable PWA manifest must remain in the offline shell");

