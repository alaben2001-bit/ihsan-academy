'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { JsonStorageAdapter, createStorage } = require('../server/storage');
const { ensureCoreCollections } = require('../server/storage/postgres');

// Regression guard: attendance must be keyed by student+date, exposed by the
// student file, and saved through the same API used by the attendance sheet.
const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server', 'server.js'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'assets', 'app.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'assets', 'app.css'), 'utf8');
assert.match(htmlSource, /login-illustration/, 'welcome screen must include its dedicated illustration');
assert.match(htmlSource, /\/assets\/ihsan-emblem\.svg/, 'navigation and welcome screen must use the academy emblem');
assert.match(htmlSource, /app\.css\?v=69\.0/, 'refreshed visual styles must bypass the old browser cache');
assert.match(htmlSource, /app\.js\?v=69\.0/, 'dashboard script changes must bypass the old browser cache');
assert.match(htmlSource, /مرحبًا بك في رحلتك/, 'welcome screen must orient students toward a learning journey');
assert.match(appSource, /hero-orbit"><img src="\/assets\/ihsan-emblem\.svg"/, 'signed-in dashboard must use the academy emblem instead of a text placeholder');
assert.match(appSource, /today-step-open/, 'daily learning steps must have direct actions into the relevant learning area');
assert.match(appSource, /today-empty/, 'students with no assigned tasks must still see a helpful next step');
assert.match(appSource, /view-subject-lessons/, 'students must be able to open a subject path from the curriculum map');
assert.match(appSource, /openLearningSubjectLessons/, 'subject path action must open its lessons');
assert.match(appSource, /ابدأ الدرس/, 'subject path modal must offer a direct start action for lessons');
assert.match(cssSource, /today-step-open/, 'daily learning actions must be styled and keyboard-visible');
assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'welcome-garden.svg')), 'welcome illustration asset must exist');
assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'ihsan-emblem.svg')), 'academy emblem asset must exist');

assert.match(appSource, /function establishHistoryGuard\(page = 'dashboard'\)/, 'session startup must establish an in-app history guard');
assert.match(appSource, /history\.replaceState\(\{ academy: true, page, root: true \}/, 'the initial academy entry must be marked as the root history entry');
assert.match(appSource, /if \(!state \|\| !state\.academy \|\| state\.root\)/, 'browser back from the root entry must restore an academy history entry');
assert.match(appSource, /showPage\(landing, \{ history: false \}\)/, 'session startup must not create a duplicate navigation entry');
assert.match(serverSource, /const APP_VERSION = require\('\.\.\/package\.json'\)\.version;/, 'server diagnostics must use the package version');
assert.match(serverSource, /version:APP_VERSION/, 'health endpoints must report the current app version');
assert.match(serverSource, /console\.log\(`\\n  أكاديمية الإحسان في بناء الإنسان — V\$\{APP_VERSION\}`\)/, 'startup banner must report the current app version');
assert.doesNotMatch(serverSource, /V32|version:32|version: '21\.0\.0'/, 'stale hard-coded app version labels must not return');
assert.match(serverSource, /function upsertAttendance\(studentId, date, status, note, user\)/, 'attendance writes must use a single upsert path');
assert.match(serverSource, /a\.student_id === studentId && a\.date === date/, 'a student must have at most one attendance record per date');
assert.match(serverSource, /attendance: \{ summary: attendance\.summary, records: attendance\.records\.slice\(0, 60\), weekly: attendance\.weekly \}/, 'student file must include attendance records');
assert.match(serverSource, /p === '\/api\/attendance\/sheet'/, 'attendance sheet endpoint must exist');
assert.match(serverSource, /p === '\/api\/attendance\/bulk'/, 'bulk attendance save endpoint must exist');
assert.match(serverSource, /seenStudents\.has\(rec\.student_id\)/, 'bulk save must reject duplicate student records');
assert.match(appSource, /await post\('\/api\/attendance\/bulk'/, 'attendance UI must save to the backend endpoint');
assert.match(appSource, /await loadSheet\(\);\s*toast\(/, 'attendance UI must reload saved server records after saving');


// Regression guard: supervisor requests must be scoped, reviewable, and exposed in the UI.
assert.match(serverSource, /supervisor_requests/, 'supervisor applications must persist');
assert.match(serverSource, /\/api\/supervisor-requests/, 'supervisor application API must exist');
assert.match(serverSource, /chief_supervisor/, 'chief supervisor must be a distinct role');
assert.match(serverSource, /teamStudentIds\(team\)\.includes\(st\.id\)/, 'only current team members may be approved as supervisors');
assert.match(appSource, /pgSupervisorRequests/, 'supervisor request review page must exist');
assert.match(appSource, /apply-team-supervisor/, 'students must be able to apply for team supervision');

// Admin credentials are shown only from the just-entered password after create/reset;
// the API must continue storing password hashes and never expose existing passwords.
assert.match(appSource, /showLoginCredentials\(v\.name,v\.email,v\.password\)/, 'admin must be able to share newly set login credentials');
assert.match(appSource, /copy-login-credential/, 'admin must be able to copy credentials');
assert.match(appSource, /adminPasswordVisibility/, 'admin must be able to reveal the password while entering it');
assert.match(appSource, /data-act="news-tab"/, 'news page must separate reels from written posts');
assert.match(appSource, /change-password/, 'settings must offer password changes');
assert.match(appSource, /theme:v\.theme/, 'settings must persist the selected interface theme');
assert.match(serverSource, /target\.password = hashPassword\(String\(b\.password\)\)/, 'password resets must store hashes');
assert.match(serverSource, /db\.users\.find\(x => String\(x\.name \|\| ''\)\.trim\(\)\.toLowerCase\(\) === identity\)/, 'login must accept the full display name');
assert.match(serverSource, /\/api\/account\/password/, 'users must be able to change their password');
assert.match(serverSource, /return json\(res, 200, adminUserView\(target\)\)/, 'user update API must not return a plaintext password');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihsan-academy-test-'));
try {
  const file = path.join(dir, 'db.json');
  const storage = new JsonStorageAdapter(file);
  const fixture = {
    users: [{ id: 'u-test', name: 'اختبار', role: 'admin', active: true }],
    groups: [{ id: 'g-test', name: 'فوج الاختبار' }],
    academy_name: 'أكاديمية الإحسان'
  };

  storage.save(fixture);
  assert.deepEqual(storage.load(), fixture, 'JSON storage must preserve all data');
  assert.equal(storage.health().healthy, true, 'JSON storage health check must pass');

  const emptyPostgres = ensureCoreCollections({});
  assert.deepEqual(emptyPostgres.users, [], 'a fresh PostgreSQL database must initialize users');
  assert.deepEqual(emptyPostgres.groups, [], 'a fresh PostgreSQL database must initialize groups');
  assert.deepEqual(emptyPostgres.students, [], 'a fresh PostgreSQL database must initialize students');
  assert.equal(ensureCoreCollections({ users: [{ id: 'u1' }], groups: [{ id: 'g1' }] }).users.length, 1, 'existing records must be preserved');

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const migrations = fs.readdirSync(migrationsDir).filter(name => /^\d+_.+\.sql$/.test(name));
  const versions = migrations.map(name => Number(name.match(/^\d+/)[0]));
  assert.equal(new Set(versions).size, versions.length, 'PostgreSQL migration versions must be unique');

  const previousMode = process.env.ACADEMY_STORAGE;
  const previousDbMode = process.env.ACADEMY_DB_MODE;
  const previousUrl = process.env.DATABASE_URL;
  const previousPgUrl = process.env.ACADEMY_POSTGRES_URL;
  try {
    process.env.ACADEMY_STORAGE = 'postgres';
    delete process.env.ACADEMY_DB_MODE;
    delete process.env.DATABASE_URL;
    delete process.env.ACADEMY_POSTGRES_URL;
    assert.throws(
      () => createStorage({ root: dir, dataFile: file }),
      /يتطلب DATABASE_URL أو ACADEMY_POSTGRES_URL/,
      'Postgres mode must fail clearly when no database URL is configured'
    );
  } finally {
    for (const [key, value] of [
      ['ACADEMY_STORAGE', previousMode],
      ['ACADEMY_DB_MODE', previousDbMode],
      ['DATABASE_URL', previousUrl],
      ['ACADEMY_POSTGRES_URL', previousPgUrl]
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  process.stdout.write('Storage smoke tests passed.\n');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

// Feedback regressions: dynamic attendance week and scoped team management.
assert.match(serverSource, /const end = q\.end \|\| localISO\(\), start = q\.start \|\| addDays\(end, -6\)/, 'weekly attendance defaults must follow the current week');
assert.match(serverSource, /user\.role === 'admin' \|\| user\.role === 'chief_supervisor'/, 'chief supervisor must manage teams');
assert.match(serverSource, /\['admin','teacher','chief_supervisor'\]\.includes\(user\.role\)/, 'chief supervisor may create teams');
assert.match(appSource, /chief_supervisor:'المشرف الرئيسي'/, 'admin user list must label chief supervisor correctly');
assert.match(appSource, /data-act="new-team-task" data-id="\$\{t\.id\}"/, 'team supervisors must see add-task controls for teams they manage');


// V54 school directory and student account provisioning.
assert.match(serverSource, /\/api\/school-directory/, 'all signed-in roles must have access to the school directory');
assert.match(serverSource, /role_label:roleLabel/, 'directory entries must expose a readable role label');
assert.match(serverSource, /\/api\/teams\/:id\/students/, 'team supervisors must have a scoped student-account creation route');
assert.match(serverSource, /teamCanManage\(user,t\)/, 'student creation must be restricted to managers of that team');
assert.match(serverSource, /crypto\.randomBytes\(18\)\.toString\('base64url'\)/, 'student temporary passwords must be cryptographically random');
assert.match(serverSource, /suppliedEmail\|\|\('student-'\+uid\('mail'\)\+'@no-email\.invalid'\)/, 'student account creation must support no email');
assert.match(appSource, /'school-directory': \['هيكلة المدرسة'/, 'school directory page must be registered');
assert.match(appSource, /S\.user\.role === 'admin' \? '' : S\.user\.name/, 'admin name must be hidden from the account header');
assert.match(appSource, /data-act="new-team-student"/, 'team supervisors must have a student creation control');
assert.match(appSource, /اسم الطالب ثم لقبه/, 'student creation must remind staff to enter first name before surname');
assert.match(appSource, /created\.initial_password/, 'the generated initial password must be shown once after creation');

assert.match(appSource, /passwordVisibility: el =>/, 'password fields must support show/hide');
assert.match(appSource, /name="confirm_password"/, 'student account creation must include password confirmation');
assert.match(appSource, /كلمتا المرور غير متطابقتين/, 'student account creation must reject mismatched passwords');
assert.match(appSource, /data-target="teamStudentConfirm"/, 'team supervisor must be able to reveal password confirmation');
assert.match(appSource, /data-target="teacherStudentConfirm"/, 'teacher must be able to reveal password confirmation');


const advancedSource = fs.readFileSync(path.join(__dirname, '..', 'server', 'advanced.js'), 'utf8');
assert.match(advancedSource, /q\.created_by!==user\.id/, 'teachers must not edit questions authored by others');
assert.match(advancedSource, /لا تملك صلاحية تعديل هذا السؤال/, 'question editing must enforce author scope');
assert.match(advancedSource, /nextOptions\.length<2/, 'choice questions must keep at least two options on edit');
assert.match(advancedSource, /الإجابة الصحيحة غير موجودة ضمن الخيارات/, 'choice question answers must match the available options');
assert.match(serverSource, /seedEducationalContent\(db\)/, 'startup migration must safely seed missing curriculum content');

assert.doesNotMatch(appSource, /journey-hearts/, 'progress hearts should not clutter the student journey overview');
assert.match(appSource, /تعلم على دفعات صغيرة/, 'student journey should encourage learning in small, clear steps');

assert.match(serverSource, /ACADEMY_REDIRECT_TO_FRANKFURT === '1'/, 'legacy Oregon deployment must support explicit redirect-only mode');
assert.match(serverSource, /FRANKFURT_CANONICAL_URL = 'https:\/\/ihsan-academy-frankfurt\.onrender\.com'/, 'redirect destination must be fixed to the verified canonical service');
assert.match(serverSource, /incoming\.pathname === '\/api\/health'/, 'redirect-only mode must satisfy Render health checks without the remote database');

assert.match(serverSource, /destination\.pathname = incoming\.pathname/, 'redirect mode must preserve the path without trusting a supplied host');
assert.match(serverSource, /destination\.search = incoming\.search/, 'redirect mode must preserve query parameters safely');


// SEO discovery files must be tracked and publicly served by the static allowlist.
const robotsSource = fs.readFileSync(path.join(__dirname, '..', 'robots.txt'), 'utf8');
const sitemapSource = fs.readFileSync(path.join(__dirname, '..', 'sitemap.xml'), 'utf8');
assert.ok(robotsSource.includes('User-agent: *'), 'robots.txt must define a general crawler policy');
assert.ok(robotsSource.includes('Sitemap: https://ihsan-academy-frankfurt.onrender.com/sitemap.xml'), 'robots.txt must point to the canonical sitemap');
assert.ok(robotsSource.includes('Disallow: /api/'), 'robots.txt must discourage indexing private API endpoints');
assert.ok(sitemapSource.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'), 'sitemap must use the standard sitemap namespace');
assert.ok(sitemapSource.includes('<loc>https://ihsan-academy-frankfurt.onrender.com/</loc>'), 'sitemap must list the canonical home page');
assert.ok(serverSource.includes("path.join(ROOT, 'robots.txt')"), 'static serving allowlist must include robots.txt');
assert.ok(serverSource.includes("path.join(ROOT, 'sitemap.xml')"), 'static serving allowlist must include sitemap.xml');

// Docker runtime writes uploads/backups as the non-root node user.
const dockerfileSource = fs.readFileSync(path.join(__dirname, '..', 'Dockerfile'), 'utf8');
assert.match(dockerfileSource, /chown -R node:node \/app\/data \/app\/backups/, 'runtime user must own writable upload and backup directories');


// The legacy Oregon service must stay in redirect-only mode in the Blueprint.
const renderSource = fs.readFileSync(path.join(__dirname, '..', 'render.yaml'), 'utf8');
const legacyServiceConfig = renderSource.split('  # Replacement web service')[0];
const canonicalServiceConfig = renderSource.split('name: ihsan-academy-frankfurt')[1] || '';
assert.ok(legacyServiceConfig.includes('name: ihsan-academy') && legacyServiceConfig.includes('key: ACADEMY_REDIRECT_TO_FRANKFURT') && legacyServiceConfig.includes('value: "1"'), 'legacy Oregon service must redirect to Frankfurt');
assert.doesNotMatch(canonicalServiceConfig, /key: ACADEMY_REDIRECT_TO_FRANKFURT/, 'canonical Frankfurt service must not redirect itself');

assert.match(appSource, /const dailyTips = \[/, 'login should offer original daily educational guidance');

assert.match(appSource, /data-theme-option/, 'theme swatches must support immediate selection');


// Student self-check practice must hide answers until submission, enforce lesson access,
// persist attempts, and avoid awarding points repeatedly for the same correct answer.
assert.match(serverSource, /\/api\/learning\/questions/, 'student practice question endpoint must exist');
assert.match(serverSource, /\/api\/learning\/attempts/, 'student practice attempts must be recorded');
assert.match(serverSource, /lessonAccessible\(user, lesson\)/, 'practice must respect lesson enrollment/access');
assert.match(serverSource, /alreadyCorrect/, 'practice must avoid repeat point farming');
assert.match(appSource, /openPractice/, 'lesson view must open self-check practice');
assert.match(appSource, /submitPracticeAnswer/, 'practice must submit selected answers');
assert.match(appSource, /اختبر فهمك/, 'lesson modal must offer a clear practice action');
assert.match(appSource, /practice-feedback/, 'practice must show feedback after answering');
assert.match(cssSource, /practice-option/, 'practice choices must have dedicated responsive styling');
assert.match(htmlSource, /app\.css\?v=69\.0/, 'practice styles must bypass browser cache');
assert.match(htmlSource, /app\.js\?v=68\.0/, 'practice script must bypass browser cache');

assert.match(htmlSource, /id="exploreTitle"/, 'Public landing must introduce academy learning paths');
assert.match(htmlSource, /القرآن الكريم/, 'Public landing must feature Quran pathway');
assert.match(htmlSource, /معرفة الله تعالى/, 'Public landing must feature knowing Allah pathway');
assert.match(htmlSource, /الأربعون النووية/, 'Public landing must feature Nawawi Forty pathway');
assert.match(htmlSource, /حسابات الطلبة ينشئها المشرف/, 'Public landing must explain supervised account creation');
