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
assert.match(backend, /must_change_password=0/, "a successful password change must clear the first-login requirement");
assert.match(backend, /if\(user\.must_change_password && !\["\/api\/me","\/api\/me\/password","\/api\/logout"\]\.includes\(path\)\)/, "protected API routes must be blocked until password change");
assert.match(backend, /تهيئة حسابات الطلاب الجماعية للمدير العام فقط/, "bulk account setup must be admin-only");
assert.match(app, /function showPasswordChange\(forced=false\)/, "the UI must support a forced password-change dialog");
assert.match(app, /if\(S\.user\?\.must_change_password\)\{renderTopActions\(\);showPasswordChange\(true\)\}/, "the UI must open the mandatory dialog after login");
assert.doesNotMatch(app, /12345678/, "the interface must not encourage a shared student password");
assert.match(migration, /must_change_password INTEGER NOT NULL DEFAULT 0/, "the D1 migration must add the password-change flag");
const appVersion = index.match(/app\.js\?v=([\w-]+)/)?.[1];
assert.ok(appVersion, "the app asset must have a versioned URL");
assert.ok(serviceWorker.includes(appVersion), "service-worker cache version must match the app assets");

console.log("Security regression guardrails passed.");
