import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [backend, app, index, serviceWorker, migration] = await Promise.all([
  readFile("src/index.js", "utf8"),
  readFile("site/app.js", "utf8"),
  readFile("site/index.html", "utf8"),
  readFile("site/service-worker.js", "utf8"),
  readFile("migrations/0003_temporary_student_passwords.sql", "utf8"),
]);

// These are static regression guardrails, not a replacement for live role-by-role acceptance tests.
assert.ok(backend.includes('const temporaryPassword=()=>"Ih!"+hex(crypto.getRandomValues(new Uint8Array(10)))'), "temporary passwords must be randomly generated");
assert.match(backend, /uniqueStudentIdentity\(env,st\.display_name/, "onboarding must resolve unique student usernames");
assert.match(backend, /must_change_password=1/, "new/reset accounts must be marked for a first-login password change");
assert.match(backend, /VALUES\(\?,\?,\?,\?, 'teacher',1,1\)/, "new teacher accounts must require a first-login password change");
assert.match(backend, /VALUES\(\?,\?,\?,\?,\?,1,1\)/, "new director and supervisor accounts must require a first-login password change");
assert.match(backend, /must_change_password=0/, "a successful password change must clear the first-login requirement");
assert.match(backend, /if\(user\.must_change_password && !\["\/api\/me","\/api\/me\/password","\/api\/logout"\]\.includes\(path\)\)/, "protected API routes must be blocked until password change");
assert.match(backend, /if\(user\.must_change_password===1\)return fail\(403,"لأول دخول، استخدم اسم الدخول وكلمة المرور المؤقتة المرسلة إليك وغيّرها أولًا؛ بعد ذلك يمكنك الدخول باستخدام Google\."\)/, "Google sign-in must not trap a first-login user in a password dialog without their temporary password");
assert.match(backend, /تهيئة حسابات الطلاب الجماعية للمدير العام فقط/, "bulk account setup must be admin-only");
assert.match(backend, /if\(path==="\/api\/assignments"&&method==="GET"\)/, "assignment list API must exist");
assert.match(backend, /if\(path==="\/api\/gradebook"&&method==="GET"\)/, "gradebook endpoint must exist");
assert.match(backend, /اختر الفوج لعرض سجله التعليمي/, "staff gradebook requests must select a group");
assert.match(backend, /canManageGroup\(env,user,groupId\)/, "gradebook must validate access to the selected group");
assert.match(app, /async function gradebookPage\(v\)/, "the gradebook UI must be available");
assert.match(app, /"gradebook","السجل التعليمي"/, "staff navigation must expose gradebook");
assert.match(app, /"gradebook","تقدمي ودرجاتي"/, "student navigation must expose personal progress");

assert.match(backend, /if\(path==="\/api\/assignments"&&method==="POST"\)/, "assignment creation API must exist");
assert.match(backend, /if\(path==="\/api\/assignment-submit"&&method==="POST"\)/, "student assignment submission API must exist");
assert.match(backend, /assignmentMatch&&method==="PATCH"/, "assignment updates must be supported");
assert.match(backend, /assignmentMatch&&method==="DELETE"/, "assignment deletion must be supported");
assert.match(backend, /لا يمكن حذف واجب له تسليمات محفوظة/, "assignment deletion must preserve existing submissions");
assert.match(app, /data-assignment-edit=/, "staff must have an assignment edit control");
assert.match(app, /data-assignment-delete=/, "staff must have an assignment delete control");

assert.match(backend, /if\(path==="\/api\/assignment-review"&&method==="POST"\)/, "teacher assignment review API must exist");
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


assert.match(app, /function showPasswordChange\(forced=false\)/, "the UI must support a forced password-change dialog");
assert.match(app, /if\(S\.user\?\.must_change_password\)\{renderTopActions\(\);showPasswordChange\(true\)\}/, "the UI must open the mandatory dialog after login");
assert.doesNotMatch(app, /12345678/, "the interface must not encourage a shared student password");
assert.match(migration, /must_change_password INTEGER NOT NULL DEFAULT 0/, "the D1 migration must add the password-change flag");
const appVersion = index.match(/app\.js\?v=([\w-]+)/)?.[1];
assert.ok(appVersion, "the app asset must have a versioned URL");
assert.ok(serviceWorker.includes(appVersion), "service-worker cache version must match the app assets");

console.log("Security regression guardrails passed.");
