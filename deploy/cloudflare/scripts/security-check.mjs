import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validDateOnly, academyDate, addCalendarDays } from "../src/index.js";

const [backend, app, index, serviceWorker, migration, style] = await Promise.all([
  readFile("src/index.js", "utf8"),
  readFile("site/app.js", "utf8"),
  readFile("site/index.html", "utf8"),
  readFile("site/service-worker.js", "utf8"),
  readFile("migrations/0003_temporary_student_passwords.sql", "utf8"),
  readFile("site/style.css", "utf8"),
]);

assert.equal(validDateOnly("2024-02-29"), true, "valid leap-day due dates must be accepted");
assert.equal(validDateOnly("2026-02-29"), false, "invalid leap-day due dates must be rejected");
assert.equal(validDateOnly("2026-02-31"), false, "out-of-range calendar days must be rejected");
assert.equal(validDateOnly("2026-13-01"), false, "out-of-range months must be rejected");
assert.equal(validDateOnly("2026-00-10"), false, "zero months must be rejected");
assert.equal(validDateOnly("not-a-date"), false, "non-date values must be rejected");
assert.equal(validDateOnly(""), false, "empty dates must be rejected");
assert.equal(academyDate(new Date("2026-10-20T22:30:00.000Z")), "2026-10-20", "Algeria local date must remain the same before local midnight");
assert.equal(academyDate(new Date("2026-10-20T23:30:00.000Z")), "2026-10-21", "Algeria local date must advance after midnight even when UTC is still on the prior date");
assert.equal(addCalendarDays("2026-10-20", 14), "2026-11-03", "two-week test due dates must advance by calendar days");
assert.ok(!backend.includes("nowIso().slice(0,10)"), "date-only school workflows must not derive their day from UTC");
assert.match(app, /const localDateISO=/, "browser date inputs must use the local calendar date");
assert.match(app, /timeZone:"Africa\/Algiers"/, "browser date helpers must use the same Algeria timezone as the backend");


// Regression guardrails for cookie-only browser sessions and CSRF.
assert.match(backend, /__Host-ihsan_session=.*HttpOnly; SameSite=Strict/, "sessions must use Secure, HttpOnly, SameSite cookies");
assert.match(backend, /__Host-ihsan_csrf=/, "sessions must issue a separate CSRF cookie");
assert.match(backend, /csrfIsValid\(request\)/, "cookie-authenticated mutations must validate CSRF");
assert.match(backend, /X-CSRF-Token/, "the backend must explicitly allow the CSRF header");
assert.match(backend, /const requestSessionToken = request => bearerSessionToken\(request\) \|\| cookieSessionToken\(request\)/, "authenticated requests must accept cookie sessions");
assert.equal((backend.match(/return sessionResponse\(/g)||[]).length, 2, "password and Google login must both issue cookie sessions");
assert.doesNotMatch(backend, /return json\(\{token,user:safeUser/, "raw session tokens must not be returned to the browser");
assert.doesNotMatch(app, /safeStore\.set\(["']ihsan_token["']/, "the UI must not store reusable bearer tokens");
assert.match(app, /credentials:"same-origin"/, "API requests must send same-origin cookies");
assert.match(app, /h\["x-csrf-token"\]=csrf/, "mutating API requests must send the CSRF token");
assert.match(index, /app\.js\?v=20261021-\d+/, "the current frontend asset version must be explicit");
assert.match(serviceWorker, /ihsan-academy-pwa-v\d+-20261021-\d+/, "the PWA cache must be invalidated with the frontend build");
assert.match(style, /\.daily-nourishment-grid/, "daily supplication and learning cards must retain their styling");

// These are static regression guardrails, not a replacement for live role-by-role acceptance tests.
assert.ok(backend.includes('const temporaryPassword=()=>"Ih!"+hex(crypto.getRandomValues(new Uint8Array(10)))'), "temporary passwords must be randomly generated");
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
assert.match(app, /"gradebook","السجل التعليمي"/, "staff navigation must expose gradebook");
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
assert.doesNotMatch(app, /12345678/, "the interface must not encourage a shared student password");
assert.match(migration, /must_change_password INTEGER NOT NULL DEFAULT 0/, "the D1 migration must add the password-change flag");
const appVersion = index.match(/app\.js\?v=([\w-]+)/)?.[1];
assert.ok(appVersion, "the app asset must have a versioned URL");
assert.ok(serviceWorker.includes(appVersion), "service-worker cache version must match the app assets");

assert.ok(backend.includes('if(path==="/api/admin/roster-add"&&method==="POST")'), "bulk roster insertion must be admin-only");
assert.ok(backend.includes('collection=\'student_profiles\''), "student profile fields must use the existing flexible D1 records store");
assert.ok(backend.includes('studentProfileMatch&&method==="PATCH"'), "student academic profile updates must have a dedicated API route");
assert.ok(backend.includes('if(count>=target){skipped++;continue}'), "re-running roster insertion must not create extra duplicate-name records");
assert.ok(app.includes('id="roster-add-form"'), "the admin UI must expose the requested roster insertion form");
assert.ok(app.includes('id="student-profile-form"'), "staff must be able to edit student academic and guardian profile fields");
assert.ok(app.includes('split(/\\r?\\n/)'), "the roster form must split one student name per line");
assert.match(app, /const dailySupplications=\[/, "student and staff dashboard must include source-labelled rotating supplications");
assert.match(app, /const dailyWisdom=\[/, "dashboard must include educational benefits that are clearly not presented as scripture");
assert.match(app, /sourceLine\.hidden=!source/, "welcome dialog must display source or composition labels for supplications");
assert.match(app, /primary:student\?"ابدأ رحلتي":"دخول إلى الأكاديمية"/, "student journey wording must not be shown to staff");
assert.match(app, /:async\(\)=>\{S\.mode="school";S\.tab="home";await load\(\);shell\(\);await page\(\)\}/, "the staff welcome action must enter the school workspace directly");
assert.match(app, /allah:'<path d="M12 21v-9"/, "knowledge/Allah area must use a botanical icon rather than a sparkle");
assert.match(app, /prophet:'<path d="M7 3\.5/, "Prophet biography area must use a manuscript icon rather than a sparkle");
assert.match(app, /daily-nourishment-grid/, "the dashboard must render daily supplication and learning-benefit cards");
assert.match(app, /onPrimary:student\?\(\)=>/, "the welcome action must route students to the learning gardens");
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
assert.match(app, /8 س و45 د/, "the program must display the calculated week-one workload");
assert.match(app, /10 س و50 د/, "the program must display the calculated week-two workload");
assert.match(app, /12 س و55 د/, "the program must display the calculated week-three workload");
assert.match(app, /47 س و30 د/, "the program must display the calculated four-week total");
assert.match(app, /المجموع 90 دقيقة، لا 75/, "the program must disclose the early-stage 15-repetition timing discrepancy");
assert.match(app, /5760 ساعة، لا 5320/, "the program must correct the eight-month calendar-hour arithmetic");
assert.match(app, /لا تُحوّل خطة الاستدراك إلى إلزام بقراءة 14\.5 ساعة/, "the catch-up plan must not mandate an exhausting uninterrupted penalty day");
assert.match(app, /data-lesson="hifzprogram"/, "the Quran memorization program must be reachable from the curriculum tiles");
assert.match(app, /hifz-program-stack/, "the memorization program must render its dedicated responsive sections");
assert.ok(app.includes('["hifzprogram","الحال المرتحل"]'), "Ihsan navigation must include the al-Hall al-Murtahil Quran program");
assert.ok(app.includes("8 س و45 د") && app.includes("10 س و50 د") && app.includes("12 س و55 د") && app.includes("15 س"), "the weekly workload calculations must remain visible");
assert.ok(app.includes("47 س و30 د"), "the monthly calculated workload must remain visible");
assert.ok(app.includes("المجموع 90 دقيقة، لا 75"), "the program must disclose the 15-repetition early-stage timing discrepancy");
assert.ok(app.includes("190 دقيقة، أي 3 ساعات و10 دقائق"), "the program must disclose the day-20 three-hour limit mismatch");
assert.ok(app.includes("5760 ساعة، لا 5320"), "the program must preserve the corrected eight-month calendar-hour calculation");
assert.ok(app.includes("مدينة الفاتحين") && app.includes("مدينة المصابرة") && app.includes("مدينة الثبات") && app.includes("مدينة الهدى") && app.includes("مدينة التقوى") && app.includes("مدينة الصادقين") && app.includes("مدينة الأبرار"), "all optional Quran journey city milestones must be present");
assert.ok(app.includes("ليس بالقوي"), "the educational title must not imply authentication of the weakly graded al-Hall al-Murtahil report");
assert.ok(app.includes("لا تُحوّل خطة الاستدراك إلى إلزام بقراءة 14.5 ساعة"), "catch-up guidance must not mandate a 14.5-hour punitive day");
console.log("Security regression guardrails passed.");
