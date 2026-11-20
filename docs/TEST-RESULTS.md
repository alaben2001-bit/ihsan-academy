# نتائج الاختبار — 2026-11-14

## محلي (D1 محلية نظيفة، ترحيلات 0001–0006)

| اختبار | النتيجة | دليل |
|---|---|---|
| `npm run check` | PASS | "Security regression guardrails passed." + فحص صياغة `mobile-smoke-test.mjs` |
| `npm run prepare:assets` | PASS | public/ regenerated at `20261114-2` |
| `test:points:local` | 62/62 PASS | 2026-11-13 (يشمل إعادة قاعدة الحضور إلى 5/2) |
| `test:quran:local` | 44/44 PASS | 2026-11-13 |
| `test:journey:local` | 93/93 PASS | 2026-11-14، قاعدة نظيفة جديدة `.wrangler-mobile` على 8789 (ترحيلات 0001–0006)، تشمل انتقال الفوج وصلاحية المراجعة |
| `test:mobile:local` | 44/44 PASS | 2026-11-14: الأصول المخدومة `20261114-2`، هوية الهاتف ونافذة الحساب، تبديل الوحدة، ظهور أدوات الإدارة افتراضيًا، دخول المدير، إنشاء فوج ~56ms وقائمة ~52ms، تعطيل المعلم، seed الأدعية، كبير مشرفين عام (تعيين/نطاق/إلغاء) |
| `test:backup:local` | 53/53 PASS | 2026-11-13، صيغة v4 + مسابقات |
| role-permission-test.mjs | 0 failures | 2026-11-13 |
| `test:competitions:local` | 124/124 PASS | 2026-11-13 |
| ترتيب E2E على قاعدة واحدة | PASS | 2026-11-14: journey 93/93 → points 62/62 → quran 44/44 → backup 53/53 → role 0 failures → competitions 124/124 → mobile 44/44، بلا فشل (اختبار الرحلة أولًا لأنه يتحقق من متجر فارغ) |
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

لا فشل مُسجَّل في الاختبارات المحلية. فجوات (غير فشل): offline، التحقق على D1 الإنتاجية، حساب طالب حقيقي، والتحقق البصري بالمتصفح (المتصفح غير متصل بالجلسة) — انظر TEST-PLAN.md. التحقق من إصلاح الهاتف جرى عبر الأصول المخدومة وفحوص HTTP (`test:mobile:local` 44/44) لا عبر لقطة شاشة.

## إصلاحات مكتشفة أثناء التدقيق

- `/api/admin/backup/full-export` كان يُرجع 500 بسبب متغير غير مُعرّف (`googleIdentities` missing from Promise.all destructure). أُصلح في `src/index.js`. Verified 200 locally.
- `weekStart = academyDate(-6)` كان يمرّر رقمًا بدل تاريخ؛ أُصلح إلى `addCalendarDays(academyDate(), -6)`، وأُعيدت كتابة `quranStreak` بـ`addCalendarDays`.
- `security-check.mjs` كان يتحقق من نص قديم لتفويض صفحة القرآن؛ حُدِّث إلى `await quranRosterPage($("#quran-staff-body"))`.

## V71 — بطاقات الطلاب / مهام / rate-limit / صرفة متساوية (2026-11-15، محلي)

- **cards-missions**: 51/51 (D1 محلية `.wrangler-cards`، ترحيلات 0001–0008).
  - بطاقة = معرّف الطالب (بطاقة واحدة)، 3 رموز (add_points 90d, profile 365d, login 365d).
  - QR دخول مجهول: name+username+requires_password، بلا جلسة.
  - profile/add_points تتطلب جلسة ونطاق فوج؛ add_points مرفوض للطالب.
  - reissue/rev (requires reason ≥3)/bulk/print.
  - missions: 5 story + 4 side; claim via awardPointsForEvent (achievement>0); daily dedupe.
  - redeem idempotent by request_id; stock deducted once.
  - rate-limit: login 12/600s per-card, store 20/600s, mission 10/600s → 429 with retry_after.
- **npm run check**: pass (node --check all + security-check).
- **security-check**: "Security regression guardrails passed."
- **backup**: 55/55 (أضيف image_url export/restore assertion).
- **points**: 62/62, **quran**: 44/44, **competitions**: 124/124, **mobile**: 44/44 — إعادة تشغيل على نفس DB بعد V71: pass.
- **UI (متصفح)**: غير مختبر (لا متصفح متصل) — خطوات اختبار في docs/PROJECT-AUDIT-2026-11-15.md §2 (cards/missions/print/scan notice).

## Sheikh panel — ترقية المستوى وخصم الجزاء والرد السريع (2026-11-15، محلي)

- **Backend**: `GET/POST /api/students/level` — المستوى في `academy_records` collection `student_levels` (لا جدول جديد). ترقية = مستوى+1 بسبب موثّق، `+25 إنجاز / +10 متجر` عبر محرك النقاط (`rule-level-promote`, auto_award=1, قابل للتعديل). منع التكرار لكل مستوى (`event_key=level:<طالب>:<مستوى>`). خصم الجزاء متاح للطاقم بنطاق الفوج (سبب ≥5 أحرف، لا يتجاوز الرصيد، تدقيق `points_penalty`).
- **UI**: «لوحة الشيخ — إجراءات بعد مسح البطاقة» في تبويب النقاط (تُفتح بعد مسح add_points QR مع الطالب مُختاراً): المستوى الحالي، زر الترقية، رد سريع (ورد قراءة/إتقان حفظ/حضور الحلقة/مراجعة ممتازة)، نموذج خصم الجزاء.
- **اختبار خلفي**: 17/17 (ترقية، مكافأة مرة واحدة لكل مستوى، حارس نطاق الفوج، لا ترقية لذاته، الخصم، missions سليمة).
- **اختبارات متأثرة**: points 62/62 (قاعدة نظيفة)، cards 51/51 — لا انحدار.
- **غير مُلتزم وغير منشور**: الشجرة تحتوي WIP متوازياً (التسجيل الذاتي «قيد الاعتماد» + quiz-review + session/tab) مختلطاً في `src/index.js` و`site/app.js` — لا يمكن تسليم/نشر تغييرات الشيخ دون قرار بشأن WIP.
- **الواجهة未 browser-tested**: لا متصفح في هذه الجلسة.

## V72b/ملاحظات التدقيق النهائي — 2026-11-16/17

- **CI كان معطلًا منذ efc6e2b** («first:» في اسم خطوة أحدث خطأ تحليل YAML؛ كل التشغيلات كانت تفشل بصفر jobs منذ 2026-11-14). أُصلح (استبدال النقطتين بمسافة) والتحقق بـ js-yaml محليًا (YAML OK, integration steps: 18). دفعات تعدّل ملفات .github فقط لا تُطلق التشغيل (paths filter) — يجب أن تمس `deploy/**` لتُطلقه.
- **تحققت كل الاختبارات المحلية من الصفر** (DB نظيفة + الترحيل 0001-0009 + مدرسة qs-shuayb للاختبار): journey 93/93، points 62/62، quran 44/44، backup 55/55، role 0 failures، competitions 124/124، mobile 44/44، cards 51/51، signup-journey 62/62.
- **إنتاج (a-ihsan.pages.dev) ينشر تلقائيًا من هذا الفرع على Cloudflare Pages** (تحقق: service-worker الحيّ = v158-20261115-11 المطابق للكود). /api/health 200، robots.txt = noindex، about/privacy بدون canonical وnoindex.
- **عائق قاتل للتسجيل على الإنتاج: ترحيل 0009 غير مطبّق على D1 الإنتاجية** (مثبت بالاستبعاد: /api/login يرجع 401 بشكل سليم، بينما /api/signup يرجع 500 — role='visitor' وجدول join_requests غير موجودين). التأثير: التسجيل الذاتي يرجع 500، وتبويب طلبات الانضمام عند الإدارة يرجع 500 أيضًا. باقي الميزات (دخول، قرآن، نقاط، متجر، بطاقات) لا تتأثر لأنها تعتمد 0001-0008 فقط.
- **يتطلب التدخل حصرًا من المالك:** تطبيق 0009 على D1 الإنتاجية (نسخة احتياطية بـ `wrangler d1 export ihsan-academy-students --remote > backup-v72.sql` ثم `npx wrangler d1 migrations apply ihsan-academy-students --remote`، أو عبر لوحة Cloudflare). لا صلاحيات Cloudflare محلية على هذا الجهاز؛ wrangler غير مسجل الدخول.
- بعد تطبيق 0009 يجب التحقق الحيّ: إنشاء حساب تجريبي فعلي (visitor) → يظهر في طلبات الانضمام عند الإدارة → اعتماده (شيخ/مدير) → دخول الطالب وتسجيل حفظ/ورد.
- أُضيفت مسبارات مخطط (schema probes) إلى /api/admin/system-check وبطاقة «ترحيل 0009: مكتمل/ناقص» للإدارة + حارس ودي في واجهة التسجيل عند 500 (رسالة تفعيل واضحة بدل خطأ خام).
- أزلت طبقة RUBY NOIRE (~250 قاعدة CSS بأحمر تُفرض بـ!important) وأثبتُ هوية Emerald Noir (أخضر زمردي #2ee6a1 على أسود + ذهب شامباني)؛ عالِجت مشكلة النص غير المقروء (الأخضر الورقي كان #ef526c ورديًا). الفحص الضوئي للأنماط (contrast scan) نظيف؛ الفحص الميداني على جهاز حقيقي ما زال مطلوبًا.

## 2026-11-18 — المتجر والنسخ الاحتياطي المجدول

| بند | النتيجة | دليل |
|---|---|---|
| كتالوج المتجر على الإنتاج | 8 منتجات (2 مفعّلة مستوى 1، 6 مستوى 2 `active=0`) | `wrangler d1 execute --remote` قراءة مباشرة بعد `scripts/seed-store-catalog.sql` |
| النسخ الاحتياطي المجدول (محلي) | PASS | `wrangler dev --test-scheduled` + `/__scheduled?cron=0+3+*+*+*` → 200، و`audit_log` يحتوي `backup_scheduled_success` مع المفتاح والأعداد |
| تسجيل الفشل | PASS | محاولة قبل إدراج الدالة سجّلت `backup_scheduled_failure` ولم تُسقط العامل |
| نشر الإنتاج | PASS | version `2ac9c8e6-ee10-40e3-82ae-5ae2579f7868`، `/api/health` 200، `/api/store/items` 401 بلا جلسة (متوقع) |
| حارس الأمان بعد التعديل | PASS | `node --check src/index.js` + `security-check.mjs` |

**عائق وحيد:** R2 غير مفعّل في حساب Cloudflare (`code 10042`) → cron/R2 معطّلان في `wrangler.jsonc` كتعليق جاهز؛ الخطوات في `docs/BACKUP-STRATEGY.md`.
