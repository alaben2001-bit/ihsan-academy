# نتائج الاختبار — 2026-11-13

## محلي (D1 محلية نظيفة، ترحيلات 0001–0006، wrangler dev:8788, BOOTSTRAP_SECRET=test-bootstrap-secret-1234)

| اختبار | النتيجة | دليل |
|---|---|---|
| `npm run check` | PASS | "Security regression guardrails passed." |
| `npm run prepare:assets` | PASS | public/ regenerated |
| `test:points:local` | 62/62 PASS | 2026-11-13 (يشمل إعادة قاعدة الحضور إلى 5/2) |
| `test:quran:local` | 44/44 PASS | 2026-11-13 |
| `test:backup:local` | 53/53 PASS | 2026-11-13، صيغة v4 + مسابقات |
| role-permission-test.mjs | 0 failures | 2026-11-13 |
| `test:competitions:local` | 124/124 PASS | 2026-11-13 |
| ترتيب E2E على قاعدة واحدة | PASS | points → quran → backup → role → competitions، بلا فشل |
| Browser: world/card/guide/wallet | PASS | Ruby gradient applies; 0 console errors (expected 401 before login) |
| Quran tabs (daily/plan/companion/stations) | PASS | served app.js contains `quranEnrollMarkup` + `quranSupervisionPage` |
| Competitions UI | PASS | served app.js contains `competitionsPage` + `/competitions/` |
| Card background cascade fix | PASS | bgImage = linear-gradient (Ruby) |

## تغطية اختبار المسابقات (124 فحصًا)

- إنشاء/تحرير/إعلان، ورفض تجاوز مراحل الدورة.
- استحقاق بالسن وفئة الحزب والرواية، وتفضيل `memorized_hizb` على مسار القرآن مع الرجوع إليه عند غيابه.
- رفض التسجيل المكرر وغير المصرح، وتسجيل الطالب وحالة الاعتماد.
- صلاحيات الأدوار: admin/director/teacher/supervisor/student، ونطاق المدرسة والفوج.
- تحكيم بشري بمعايير كاملة، رفض النقص، متوسط عدة محكمين، وقفل المعايير بعد بدء التحكيم.
- توليد النتائج واعتمادها، ومنع الاعتماد/الجائزة المكررة، وسلامة الأرصدة (achievement/store منفصلة عن درجة المسابقة).
- عرض الطالب لنتيجته وترتيبه، وحد المشاركين، وتقويم/شروط قابلة للتحرير.
- عدم المساس بسجلات الحضور والحفظ والطلاب الأصلية.

## CI (GitHub Actions)

| workflow | الحالة | ملاحظة |
|---|---|---|
| cloudflare-free-check | يُشغَّل عند الدفع | check + prepare:assets + dry-run + points + Quran + backup + role + competitions |

## إنتاج (a-ihsan.pages.dev)

| فحص | النتيجة | دليل |
|---|---|---|
| /api/health | 200 ok | verified |
| asset version | 20261113-1 (متوقع بعد النشر) | index/app.js/service-worker (SW v143) |
| /api/quran/* | 401 (auth gate) | المسارات موجودة، ليست 404 |
| /api/points/*, /api/tasks, /api/content, /api/competitions | 401 (auth gate) | cannot verify without credentials |
| student pages render | **غير مختبر** | blocked on human login |
| backup v4 in live app.js | متوقع بعد النشر | `ihsan-academy-full-backup-v4` |
| D1 0004/0005/0006 | **غير مختبر** | blocked on wrangler auth؛ المخطط يُنشأ وقت التشغيل |

## فشل

لا فشل مُسجَّل في الاختبارات المحلية. فجوات (غير فشل): offline، التحقق على D1 الإنتاجية، حساب طالب حقيقي — انظر TEST-PLAN.md.

## إصلاحات مكتشفة أثناء التدقيق

- `/api/admin/backup/full-export` كان يُرجع 500 بسبب متغير غير مُعرّف (`googleIdentities` missing from Promise.all destructure). أُصلح في `src/index.js`. Verified 200 locally.
- `weekStart = academyDate(-6)` كان يمرّر رقمًا بدل تاريخ؛ أُصلح إلى `addCalendarDays(academyDate(), -6)`، وأُعيدت كتابة `quranStreak` بـ`addCalendarDays`.
- `security-check.mjs` كان يتحقق من نص قديم لتفويض صفحة القرآن؛ حُدِّث إلى `await quranRosterPage($("#quran-staff-body"))`.
