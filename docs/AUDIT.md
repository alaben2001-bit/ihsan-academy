# تدقيق الحالة الفعلية — أكاديمية الإحسان (Cloudflare/D1)

**التاريخ:** 2026-11-11  
**الفرع المراجع:** `migration/cloudflare-student-platform`  
**الالتزام:** `6c963e2` (HEAD = origin)  
**النشر الحي:** `20261111-4` على `https://a-ihsan.pages.dev/`  
**النطاق:** `deploy/cloudflare/` (التطبيق النشط). المجلدات `server/`, `android-app/`, `assets/` (الجذر) هي تطبيق تاريخي (V65) غير مرتبط بالنشر الحي.

## 1. Git والنشر

| عنصر | القيمة | دليل |
|---|---|---|
| worktree | واحد فقط: `Default Project` | `git worktree list` |
| شجرة العمل | نظيفة (لا تغييرات معلّقة) | `git status --short` |
| HEAD | `6c963e2` | `git rev-parse HEAD` |
| origin/... | `6c963e2` (متزامن) | `git fetch --all` |
| فرع `main` | `c5b52cf` (تاريخي، خلف origin/main بـ 1) | `git for-each-ref` |
| فروع copilot / stash | لا يوجد | `git stash list`, `git branch -a` |
| بناء Cloudflare | `npm run check` ✅، `prepare:assets` ✅ | CI `cloudflare-free-check.yml` |
| تطابق النشر | ملفات live (app.js/style.css/index.html/service-worker.js) مطابقة لـ HEAD after normalization of CRLF | sha256 normalized = identical |

**استنتاج:** النشر الحي مبني من `6c963e2` (الإصدار 4). لا توجد تعديلات معلّقة أو في worktree منفصل. **لا يوجد أي عمل منسوب إلى Copilot في المستودع** (لا فروع، لا stash، لا ملفات "feature map" أو "mock D1 tests" أو "personal reports/group posts/paths/review tasks/private messages" بوصفها إضافات Copilot). الـ README (deploy/cloudflare/README.md) يوثّق الفجوات honstly.

## 2. الـ CI

`.github/workflows/cloudflare-free-check.yml`: يعمل على push لـ `migration/cloudflare-student-platform` و PR إلى main. خطوات: `npm install`, `npm run check`, `npm run prepare:assets`, `npx wrangler deploy --dry-run`. **لا يشغّل `test:points:local`** (يتطلب wrangler dev + D1 محلية) — فجوة في CI.

## 3. المعمارية (deploy/cloudflare)

- Worker: `src/index.js` (≈ 2200 سطر) — مسارات `/api/*` + bootstrap D1.
- Pages Functions bridge: `functions/api/[[path]].js`.
- Assets: `site/*` → `public/` via `prepare-assets.mjs`.
- D1: `ihsan-academy-students` (id `33123c73-...`).
- Bindings: `DB`, `ASSETS`, `APP_ENV=production`, `BOOTSTRAP_SECRET`.

## 4. الاقتصاد والنقاط — حالة التحقق

| عنصر | موجود | اختبار محلي | إنتاج |
|---|---|---|---|
| `point_rules` (7 قواعد) | ✅ | ✅ (69/69) | غير مختبر (لا auth) |
| `point_events` (idempotency على (kind,event_key)) | ✅ | ✅ | غير مختبر |
| `store_items`, `store_redemptions` | ✅ | ✅ | غير مختبر |
| السقوف `max_per_day` | ✅ | ✅ | غير مختبر |
| العكس (reversal) | ✅ | ✅ | غير مختبر |
| `awardPointsForEvent` (dedupe) | ✅ | ✅ | غير مختبر |
| `/api/points/reading` (one per student/day) | ✅ | ✅ (manual) | غير مختبر |

**ملاحظة:** `ensureLearningSchema` يُشغَّل بعد المصادقة (سطر 624)، idempotent، مع 503 fallback لـ `/api/points*` و `/api/store*`. مطابق لـ `0004`.

## 5. عالم الطالب / البطاقة / الدليل

| عنصر | موجود | اختبار |
|---|---|---|
| `worldPage` (6 مراتب، garden, quests, claim) | ✅ | محلي (browser) ✅ |
| `cardPage` (pass, serial, badges, history) | ✅ | محلي (browser) ✅ |
| `guidePage` (6 steps, rules table, reading live values) | ✅ | محلي (browser) ✅ |
| wallet chips | ✅ | محلي ✅ |
| default tab = world (student) | ✅ | محلي ✅ |
| Ruby Noire theme + card cascade fix | ✅ | محلي ✅ |

## 6. الترحيلات D1

- 5 ترحيلات: `0001`, `0002_daily_use`, `0002_google_identities`, `0003_temporary_student_passwords`, `0004_learning_economy`.
- `0004` additve (CREATE TABLE IF NOT EXISTS + INSERT OR IGNORE). لا أوامر مدمرة.
- **حالة الإنتاج: غير مُتحقق** — لا auth wrangler (not authenticated). `ensureLearningSchema` يهيّئ الجداول تلقائيًا على أول دخول.

## 7. المصادقة / OAuth

- طرق: password login (PBKDF2), bootstrap admin via `BOOTSTRAP_SECRET`.
- Google OAuth: كود موجود (`/api/auth/google/link`), متغيرات `GOOGLE_CLIENT_ID/SECRET` — **غير مُهيَّأ** (setup_enabled:false على الإنتاج). يحتاج تدخل مستخدم.

## 8. PWA / Service Worker

- v4 cache (`ihsan-academy-pwa-v139-20261111-4`), skipWaiting, activate deletes old caches, network-first navigation. سليم محليًا. **العمل دون اتصال غير مختبر** (لا اختبارات).

## 9. الصلاحيات

- 5 أدوار (admin/director/teacher/supervisor/student). التحقق من الخادم موجود (`currentUser`, role checks). **لم تُختبر مصفوفة الصلاحيات بشكل منهجي** (لا اختبارات تلقائية للوصول المتقاطع).

## 10. النسخ الاحتياطي

- endpoints: `/api/admin/backup/export`, `/full-export`, `/restore`, `/summary`. **لم تُجرَّب استعادة في بيئة معزولة** (خطر إنتاجي).

## 11. المحتوى الشرعي

- لا يوجد `CONTENT-REVIEW.md`. **لم تُجرَ مراجعة شرعية** للمحتوى. لا توجد مطالبة بأن المراجعة تمت.

## 12. ما لم يُختبر (Non-negotiable gaps)

1. D1 الإنتاجية (مخطط + بيانات) — blocked on wrangler auth.
2. حساب حقيقي على الموقع الحي — blocked on credentials.
3. الصلاحيات متقاطعًا (cross-role) — no automated tests.
4. Offline/PWA — no tests.
5. Backup restore drill — not performed.
6. Google OAuth — not configured.
7. Content review — not performed.

## 13. Copilot claimed work — reality

أُعلن عن: خارطة ميزات، اختبارات D1 وهمية، تقارير شخصية، منشورات أفواج، مسارات، مهام مراجعة، رسائل خاصة، README محدّث.  
**الواقع:** لا يوجد أي فرع/stash/commit Copilot. بعض هذه الميزات (messages, curriculum, assignments) موجودة بالفعل في `d08ea92`/earlier (OpenCode). "منشورات الأفواج" (group posts) **غير موجودة**. لا توجد "اختبارات D1 وهمية". الـ README cloudflare (deploy/cloudflare/README.md) يوثّق الفجوات (honest).  
**القرار:** Copilot claims cannot be credited; treat as unverified. Do not merge unknown work.
