# نتائج الاختبار — 2026-11-14

## محلي (D1 محلية نظيفة، ترحيلات 0001–0006)

| اختبار | النتيجة | دليل |
|---|---|---|
| `npm run check` | PASS | "Security regression guardrails passed." + فحص صياغة `mobile-smoke-test.mjs` |
| `npm run prepare:assets` | PASS | public/ regenerated at `20261114-1` |
| `test:points:local` | 62/62 PASS | 2026-11-13 (يشمل إعادة قاعدة الحضور إلى 5/2) |
| `test:quran:local` | 44/44 PASS | 2026-11-13 |
| `test:journey:local` | 93/93 PASS | 2026-11-14، قاعدة نظيفة جديدة `.wrangler-mobile` على 8789 (ترحيلات 0001–0006)، تشمل انتقال الفوج وصلاحية المراجعة |
| `test:mobile:local` | 21/21 PASS | 2026-11-14: الأصول المخدومة `20261114-1`، هوية الهاتف ونافذة الحساب، تبديل الوحدة، ظهور أدوات الإدارة افتراضيًا، دخول المدير، إنشاء فوج 56ms وقائمة 52ms |
| `test:backup:local` | 53/53 PASS | 2026-11-13، صيغة v4 + مسابقات |
| role-permission-test.mjs | 0 failures | 2026-11-13 |
| `test:competitions:local` | 124/124 PASS | 2026-11-13 |
| ترتيب E2E على قاعدة واحدة | PASS | 2026-11-14: journey 93/93 → points 62/62 → quran 44/44 → backup 53/53 → role 0 failures → competitions 124/124، بلا فشل (اختبار الرحلة أولًا لأنه يتحقق من متجر فارغ) |
| Browser: journey wizard + resume | PASS | 8 أسئلة، حفظ إجابة، إعادة تحميل، «1 من 8» و«أكمل من حيث توقفت» |
| Browser: student store | PASS | متجر صادق: متاح/أقرب/مقفل/نافد/شروط صرف، بلا منتجات وهمية |
| Browser: admin store | PASS | نموذج إضافة/تعديل/إخفاء + 6 اقتراحات غير محفوظة |
| Browser: teacher plan review | PASS | تبويبات الخطط الثلاث، بطاقة معتمدة، ملخص 8 إجابات، ملاحظة مراجعة |
| Browser: world/card/guide/wallet | PASS | Ruby gradient applies; لا أخطاء JavaScript بعد الدخول |
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

لا فشل مُسجَّل في الاختبارات المحلية. فجوات (غير فشل): offline، التحقق على D1 الإنتاجية، حساب طالب حقيقي، والتحقق البصري بالمتصفح (المتصفح غير متصل بالجلسة) — انظر TEST-PLAN.md. التحقق من إصلاح الهاتف جرى عبر الأصول المخدومة وفحوص HTTP (`test:mobile:local` 21/21) لا عبر لقطة شاشة.

## إصلاحات مكتشفة أثناء التدقيق

- `/api/admin/backup/full-export` كان يُرجع 500 بسبب متغير غير مُعرّف (`googleIdentities` missing from Promise.all destructure). أُصلح في `src/index.js`. Verified 200 locally.
- `weekStart = academyDate(-6)` كان يمرّر رقمًا بدل تاريخ؛ أُصلح إلى `addCalendarDays(academyDate(), -6)`، وأُعيدت كتابة `quranStreak` بـ`addCalendarDays`.
- `security-check.mjs` كان يتحقق من نص قديم لتفويض صفحة القرآن؛ حُدِّث إلى `await quranRosterPage($("#quran-staff-body"))`.
