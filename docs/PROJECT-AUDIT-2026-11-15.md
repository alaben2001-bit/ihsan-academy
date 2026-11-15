# تدقيق حالة المشروع — أكاديمية الإحسان (2026-11-15)

> تدقيق فعلي (قراءة كود + ترحيلات + اختبارات)، لا ادعاء. لا تعديلات كود في هذا التدقيق.

## 1. حقيقة المستودع

- **الفرع الحالي**: `migration/cloudflare-student-platform`.
- **HEAD**: `f88bc73` (docs: independent audit report + appendix for V70).
- **16 commit غير منشورة** (origin/migration @ `6c963e2`): V67–V70 + docs.
- **V71 (بطاقات/مهام/rate-limit/صور) غير committed** (working tree modified + untracked).
- **لا push** (origin/migration @ `6c963e2`, HEAD أحدث بـ 16).
- **فرع main** منفصل؛ لا توجد PRs مدمجة (branch ahead of origin).
- **ترحيلات D1**: 0001–0008 (0008 `rate_limits` جديد).
- **اختبارات**: 9 suites (points 62, quran 44, journey 93, backup 55, role 0 failures, competitions 124, mobile 44, cards-missions 51, security-check pass). `npm run check` passes.
- **نشر**: Cloudflare Workers/Pages. النسخة المنشورة معروفة `20261113-1` (PWA v143). V65+ غير منشورة.

## 2. جدول الميزات (حالة حقيقية)

| # | الميزة | الحالة الحقيقية | ما يعمل | ما ينقص | ملفات/جداول | دليل | الإجراء |
|---|---|---|---|---|---|---|---|
| 1 | تسجيل الدخول/جلسات/CSRF | مكتملة ومختبرة | login, sessions, cookie, CSRF, rate-limit login attempts | OAuth Google غير مهيّأ (setup_enabled:false) | src/index.js, sessions, login_attempts | role test 0 failures | تهيئة Google OAuth (docs) |
| 2 | RBAC (admin/teacher/student/supervisor/director) | مكتملة ومختبرة | cross-role denials | سياسة director/supervisor نهائية pending | src/index.js, users.role | role-permission-test 0 | إقرار سياسة |
| 3 | طلاب/أفواج/فرق/معلّمون | مكتملة ومختبرة | CRUD, soft-deactivate teacher, group update local | — | students, groups, users, student_teams | mobile 44/44 | — |
| 4 | اقتصاد النقاط (manual/rules/events/reverse) | مكتملة ومختبرة | award, reverse, rules edit, history | — | point_rules, point_events | points 62/62 | — |
| 5 | مسار القرآن (حفظ/تثبيت/ورد/رفيق/محطات/استدراك) | مكتملة ومختبرة | daily logs, companion, stations, makeups, idempotency | أرقام Thabit 2.5/5/7.5 مشبوهة (اقتراح) | quran_paths, quran_daily, quran_pairs, quran_pair_sessions, quran_stations, quran_makeups, academy_records | quran 44/44 | اعتماد Sheikh |
| 6 | رحلة الطالب (8 أسئلة) + توصية + اعتماد شيخ | مكتملة ومختبرة | wizard, resume, recommendation, apply via /api/quran/*, review | — | academy_records student_journey, quran_paths, quran_plan | journey 93/93 | — |
| 7 | المتجر الصادق (available/nearest/locked/sold-out/maxed) | مكتملة ومختبرة | honest states, redeem, reserve/refund/fulfill | صور (image_url) UI غير متصفح-مختبرة | store_items, store_redemptions | journey 93/93 + backup 55/55 | — |
| 8 | صور منتجات (image_url) | منفذة جزئياً | backend CRUD + restore + URL fallback | UI admin (image_url field) غير متصفح-مختبرة | store_items.image_url | backup 55/55 (image) | اختبار متصفح |
| 9 | جزاءات (penalty) | مكتملة ومختبرة (backend) | POST /api/penalties, store-only, audited | UI؟ (لوحة) | point_events (penalty) | points 62/62 | — |
| 10 | بطاقات الطلاب (3 QR) | منفذة لكن لم تُختبر (UI) / backend مختبر | CRUD, resolve anonymous login, scope, reissue, revoke, bulk, print, rate-limit | UI (cardQrSheet, print datasets) غير متصفح-مختبرة | academy_records student_cards, rate_limits | cards-missions 51/51 | اختبار متصفح |
| 11 | عالم المهام (missions) | منفذة لكن لم تُختبر (UI) / backend مختبر | story 5 + side 4, claim via awardPointsForEvent, daily dedupe | UI worldPage missions غير متصفح-مختبرة | academy_records student_missions, point_rules rule-mission-side | cards-missions 51/51 | اختبار متصفح |
| 12 | Rate limiting (card/store/mission) | مكتملة ومختبرة | per-card login 12/600s, store 20/600s, mission 10/600s | — | rate_limits | cards-missions 51/51 | — |
| 13 | صرفة متجر متساوية (idempotency) | مكتملة ومختبرة | duplicate request_id → same redemption, stock once | — | store_redemptions | cards-missions 51/51 | — |
| 14 | المسابقات (8 tables, lifecycle, judging, awards, calendar, terms) | مكتملة ومختبرة | full lifecycle, human judging, awards once, archive | — | competitions*, competition_* | competitions 124/124 | — |
| 15 | عالم الطالب/البطاقة/الدليل | منفذة جزئياً | worldPage, student pass, journey guide | لا اختبار UI مخصص | app.js | — | اختبار متصفح |
| 16 | محتوى (hadith/mutoon/duas/adhkar) + مراجعة | منفذة جزئياً | CRUD, publish needs source, seed duas (pending_review), 4 tabs | مراجعة شرعية pending; UI غير متصفح-مختبرة | content (academy_records), CONTENT_KINDS | mobile 44/44 (seed) | مراجعة بشري |
| 17 | كبير مشرفين عام (global chief) | مكتملة ومختبرة (HTTP) | appoint/revoke, cross-group approvals | — | academy_records student_chief_supervisors | mobile 44/44 | — |
| 18 | الوحدة zweite (منهج الإحسان) | موجودة شكلياً (teaser) | titles only, IHSAN_PREVIEW_ONLY | لا محتوى/بيانات/تسجيل | app.js | mobile 44/44 | بانتظار المحتوى |
| 19 | هيكل المدرسة (hierarchyPage) | منفذة جزئياً | renders real data (staff/teachers/groups/chiefs) | لا E2E test; UI غير متصفح-مختبرة | app.js | — | اختبار متصفح |
| 20 | خارطة الطريق (roadmapPage) | منفذة جزئياً | static 11 stages | لا backend; مرجع فقط | app.js | — | — |
| 21 | PWA/offline | منفذة جزئياً | SW v148, cache shell incl. qr.js | غير مختبر على أجهزة حقيقية | service-worker.js | — | اختبار أجهزة |
| 22 | النسخ الاحتياطي/الاستعادة | مكتملة ومختبرة | full export v4, restore v2/v3/v4, economy+competitions | لا نسخ مجدولة/خارجية | backup endpoints | backup 55/55 | نسخ مجدولة |
| 23 | Google OAuth | غير منفذة (config) | client id present | secret/redirect/origin unverified | auth code | — | تهيئة |
| 24 | D1 الإنتاج (0004–0008) | غير مُتحقَّق | runtime schema bootstrap (lazy) | migration apply على الإنتاج غير مُتحقَّق (wrangler OAuth fail) | migrations/* | — | wrangler auth + apply |
| 25 | AI assistant | غير منفذة (بالتصميم) | architecture only; لا provider | قرار provider/budget pending | — | — | قرار المالك |
| 26 | أدعية/أذكار (duas/adhkar) | منفذة جزئياً (مسودات) | seed 5 duas + 4 adhkar pending_review | مراجعة شرعية pending; نشر بعد مراجعة | content, docs/DUAS-AND-ADHKAR-DRAFT.md | mobile 44/44 | مراجعة بشري |
| 27 | QR encoder (site/qr.js) | مكتملة ومختبرة (unit) | 8/8 samples jsQR verified | — | site/qr.js | security-check | — |

## 3. إجابات الأسئلة

1. **أين وصل المشروع؟** منصة طلاب Cloudflare (D1) مع اقتصاد، مسار قرآن، رحلة طالب، متجر صادق، مسابقات، بطاقات QR، مهام، جزاءات، صور متجر، محتوى (بما فيه أدعية/أذكار مسودات)، كبير مشرفين عام، تعطيل معلمين، teaser للوحدة segunda. 16 commit غير منشورة + V71 uncommitted. نشر آخر: `20261113-1`.
2. **آخر نقطة توقف**: V71 مكتمل محليًا (51/51) + إصلاحات store image + rate-limit per-card. بانتظار: commit small, docs, قرارات مالك (IDs معلمين، كتالوج متجر، أرقام Thabit، موافقة نشر).
3. **نُفذ ولم يُنشر**: V65–V71 (اقتصاد، مسار قرآن، مسابقات، رحلة/متجر، هوية هاتف، تعطيل معلمين، كبير مشرفين، أدعية/أذكار، هيكل/خارطة، جزاءات، صور متجر، بطاقات QR، مهام، rate-limit). 16+ commits.
4. **نُشر لكن لا يعمل كما ينبغي**: النسخة المنشورة `20261113-1` (v143) لا تحتوي V65+. D1 الإنتاجية: ترحيلات 0004–0008 غير مُتحقَّق (runtime bootstrap ينشئ الجداول وقت التشغيل، لكن data migrations؟ 0004 learning economy likely runtime ensureLearningSchema). OAuth غير مهيّأ. PWA offline غير مختبر على أجهزة.
5. **وظائف مكررة/متعارضة**: لا جداول مكررة (academy_records reused for journey/cards/missions/chiefs/content). XP=achievement, Coins=store (no duplicate wallets). Potential overlap: `supervisor` staff role vs student team supervisor (distinct, documented). Store image URL only (no R2) — no duplicate upload path.
6. **أخطاء حرجة**: (a) wrangler OAuth fails → production D1 unverified; (b) Google OAuth secret/redirect unverified; (c) Thabit figures 2.5/5/7.5 suspect; (d) religious content unreviewed; (e) no scheduled/off-site backups; (f) store inventory/costs/photos/terms not provided; (g) AI provider/budget undecided; (h) UI for V68–V71 not browser-tested (no desktop browser connected).
7. **ترتيب الأعمال المتبقية**: (1) commit V71 small + docs; (2) browser UI verification when desktop available; (3) production D1 migration apply via wrangler auth; (4) Google OAuth setup; (5) real store catalog entry; (6) Sheikh approval of hifz/Thabit; (7) religious content review; (8) AI provider decision; (9) scheduled backups; (10) explicit production publish approval.
8. **نسبة الإنجاز**: 
   - **وظيفي (محلي، موزون بالوحدات)**: ~84% (7 وحدات مكتملة ومختبرة = 67% + جزئية = 17%).
   - **جاهزية إنتاج**: ~55% (pending D1 verify, OAuth, offline device test, content review, store catalog, AI decision, backups).
   - طريقة الحساب: 27 ميزة، أوزان (auth 10%, students 8%, points 10%, quran 12%, journey 10%, competitions 12%, cards/missions 8%, world 6%, admin 7%, content 5%, PWA 4%, backup 5%, production 3%). "مكتملة ومختبرة" = وزن كامل؛ "جزئية/لم تُختبر" = 30–70%; "غير منفذة" = 0%.

## 4. قائمة تنفيذ مرتبة (للانتقال للمهمة الثانية)

1. Commit V71 (src, app, style, qr.js, tests, security-check, package, workflow, html/sw) — small commits.
2. تحديث docs (CHANGELOG V68–V71, TEST-RESULTS, PRODUCTION-READINESS, AUDIT matrix).
3. Browser UI verification (cards, missions, print, scan notice) — pending desktop browser.
4. wrangler auth + apply migrations 0004–0008 on production D1 (بدون reset) — requires owner approval.
5. Google OAuth setup (docs/GOOGLE-OAUTH-SETUP.md).
6. إدخال كتالوج متجر حقيقي (صور/مخزون/شروط) — owner provides.
7. اعتماد Sheikh لأرقام Thabit (2.5/5/7.5) + خطط Hifz.
8. مراجعة شرعية للأدعية/الأذكار/الحديث/المنهاج.
9. قرار AI provider/budget (أو الإبقاء architecture-only).
10. نسخ احتياطية مجدولة/خارجية.
11. موافقة صريحة للنشر (push + deploy) — owner only.
12. اختبار PWA/offline على أجهزة حقيقية.

---
*هذا التقرير تدقيقي (read-only). لا تغييرات كود.*
