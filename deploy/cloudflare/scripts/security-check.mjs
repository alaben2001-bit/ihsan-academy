import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validDateOnly, academyDate, addCalendarDays } from "../src/index.js";

const [backend, app, index, serviceWorker, migration, initialMigration, style, about, privacy] = await Promise.all([
  readFile("src/index.js", "utf8"),
  readFile("site/app.js", "utf8"),
  readFile("site/index.html", "utf8"),
  readFile("site/service-worker.js", "utf8"),
  readFile("migrations/0003_temporary_student_passwords.sql", "utf8"),
  readFile("migrations/0001_initial.sql", "utf8"),
  readFile("site/style.css", "utf8"),
  readFile("site/about.html", "utf8"),
  readFile("site/privacy.html", "utf8"),
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
assert.match(backend, /if\(!validDateOnly\(date\)\|\|!items\.length\|\|items\.length>200/, "attendance must validate real calendar dates");
assert.match(backend, /if\(!validDateOnly\(date\)\)return fail\(400,"صيغة التاريخ غير صحيحة"\)/, "Quran progress creation must validate real calendar dates");
assert.match(backend, /if\(date>academyDate\(\)\)return fail\(400,"لا يمكن تسجيل متابعة القرآن بتاريخ مستقبلي"\)/, "Quran progress creation must reject future dates at the API");
assert.match(app, /date>S\.date\)\{toast\("اختر تاريخًا صحيحًا لا يتجاوز اليوم",true\);return\}/, "Quran progress form must reject future dates before submission");
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

assert.match(app, /const localDateISO=/, "browser date inputs must use the local calendar date");
assert.match(app, /const head=\(a,b\)=>.*esc\(a\).*esc\(b\)/, "shared section headings must escape dynamic text before inserting HTML");
assert.match(app, /field\("كلمة مرور مؤقتة \(اختيارية\)","password","password","","اتركها فارغة للتوليد الآمن"\)/, "the optional student password field must use a real placeholder, not an invalid minlength value");
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
assert.ok(index.includes('src="/app.js?v=20261025-026"'), "the current frontend asset version must be explicit");
assert.match(serviceWorker, /ihsan-academy-pwa-v130-20261025-026/, "the PWA cache must be invalidated with the frontend build");
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
assert.doesNotMatch(app, /12345678/, "the interface must not encourage a shared student password");
assert.match(migration, /must_change_password INTEGER NOT NULL DEFAULT 0/, "the D1 migration must add the password-change flag");
const appVersion = index.match(/app\.js\?v=([\w-]+)/)?.[1];
assert.ok(appVersion, "the app asset must have a versioned URL");
assert.ok(serviceWorker.includes(appVersion), "service-worker cache version must match the app assets");

assert.ok(backend.includes('if(path==="/api/admin/roster-add"&&method==="POST")'), "bulk roster insertion must be admin-only");
assert.ok(backend.includes('collection=\'student_profiles\''), "student profile fields must use the existing flexible D1 records store");
assert.ok(backend.includes('studentProfileMatch&&method==="PATCH"'), "student academic profile updates must have a dedicated API route");
assert.ok(backend.includes('if(count>=target){skipped++;continue}'), "re-running roster insertion must not create extra duplicate-name records");
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
assert.match(backend, /if\(count>=target\)\{skipped\+\+;continue\}/, "retries must preserve intended duplicate counts without duplicating the whole list");

assert.ok(app.includes('id="student-profile-form"'), "staff must be able to edit student academic and guardian profile fields");
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
assert.match(app, /\$\("#open-school"\)\.onclick=async\(\)=>/, "the platform chooser must open the Quran school workspace");
assert.match(app, /\$\("#open-ihsan"\)\.onclick=\(\)=>/, "the platform chooser must open the Ihsan learning workspace");
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




assert.match(app, /crypto\.getRandomValues\(new Uint8Array\(18\)\)/, "blank student password fields must generate a strong random temporary password");
assert.doesNotMatch(app, /12345678/, "a universal student password must never be shown or submitted");
assert.match(app, /id="admin-focus-toggle"/, "the director account must be able to switch between daily teaching and administration");
assert.match(app, /makeGroup\("مهام الشيخ اليومية"/, "admin daily focus must keep teaching tasks separate from administrative tools");
assert.match(app, /function honorificDisplayName\(name,role\)/, "staff names must use the shared Sheikh honorific formatter");
assert.match(app, /const displayUserName=honorificDisplayName\(S\.user\.name,S\.user\.role\)/, "the signed-in director, teacher and administrator names must use the shared honorific formatter");
assert.match(app, /name="thumn_from" type="number" inputmode="numeric" min="1" max="480" step="1" required/, "Quran records must require a starting thumn number");
assert.match(app, /name="thumn_to" type="number" inputmode="numeric" min="1" max="480" step="1"/, "Quran thumn ranges must support all 480 eighths of the hizb");
assert.match(app, /id="settings-open-notifications"/, "settings must provide a direct path to notifications");
assert.doesNotMatch(app, /id="settings-done"/, "appearance preferences apply immediately without a Done button");


assert.match(app, /const dailyWisdomForSheikh=\[/, "teaching advice must be separated from student etiquette advice");
assert.match(app, /const wisdomPool=\["admin","teacher","director","supervisor"\]\.includes\(S\.user\.role\)\?dailyWisdomForSheikh:dailyWisdom/, "daily educational guidance must match the user's role");
assert.match(app, /if\(S\.tab==="home"\)return await home\(v\);if\(S\.tab==="teams"\)return await teamsPage\(v\);if\(S\.tab==="groups"\)return groups\(v\);/, "only current, supported panels must be reachable from the active page router");


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
assert.match(style, /data-appearance-palette="dark"/, "dark mode must have dedicated contrast rules");
assert.match(style, /\.academy-update-notice/, "the update banner must have responsive styling");
assert.match(style, /\.release-history-item/, "the in-app release history must be styled");
assert.match(index, /app\.js\?v=20261025-026/, "frontend cache busting must use the latest asset version");
assert.match(index, /style\.css\?v=20261025-026/, "stylesheet cache busting must use the latest asset version");
assert.match(index, /startup\.js\?v=20261025-026/, "startup cache busting must use the latest asset version");
assert.match(serviceWorker, /ihsan-academy-pwa-v130-20261025-026/, "service worker cache namespace must match this release");
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
console.log("Security regression guardrails passed.");

assert.match(about, /rel="canonical" href="https:\/\/ihsan-academy\.pages\.dev\/about\.html"/, "about page canonical must use the production domain");
assert.match(privacy, /rel="canonical" href="https:\/\/ihsan-academy\.pages\.dev\/privacy\.html"/, "privacy page canonical must use the production domain");
