# سجل التغييرات — أكاديمية الإحسان (Cloudflare)

## 2026-11-13 — نظام المسابقات القرآنية والعلمية + نسخة كاملة v4

- هجرة إضافية `0006_competitions.sql`: 8 جداول (`competition_categories`, `competitions`, `competition_registrations`, `competition_judges`, `competition_scores`, `competition_results`, `competition_events`, `competition_reference_terms`)، مع بذور 4 فئات حزب (15/30/45/60) + عامة، ومصطلح مرجعي عام، وقاعدة نقاط `competition_award`. لا حذف لأي سجل مسابقات قديم في `academy_records`.
- إعادة استخدام كامل للمستخدمين والطلاب والأفواج والفرق و`point_events`؛ لا حسابات ولا محافظ ولا `xp`/`coins` جديدة.
- شروط استحقاق قابلة للتحرير لكل دورة: السن، فئة الحزب (مع تفضيل `student_profiles.memorized_hizb` والرجوع إلى `quran_paths.hifz_category`)، الرواية، وحد المشاركين.
- دورة حياة يفرضها الخادم: `draft → announced → registration → judging → results → honored → archived`، مع رفض القفز بين المراحل.
- تحكيم بشري: معايير قابلة للتخصيص تُطبَّع إلى 0–100، متوسط عدة محكمين، ولا تصحيح تلاوة آلي. تسجيل النتائج وتوليدها واعتمادها محكوم بالصلاحية، ولا تُمنح الجائزة إلا مرة واحدة بمفتاح `competition:<id>:<studentId>:award`.
- فصل صريح بين درجة المسابقة ورصيد `achievement` ورصيد `store`؛ الجوائز الافتراضية للمراكز الثلاثة فقط (100/50، 70/30، 50/20) وقابلة للتحرير، ونقاط المشاركة صفر افتراضيًا. المسابقات لا تمسّ سجلات الحضور أو الحفظ الأصلية.
- واجهة عربية RTL للطالب (متاح/مسابقاتي/التقويم) وللطاقم (إدارة/تحكيم/نتائج/تقويم/شروط)، مع نماذج إنشاء وتحرير المعايير والجوائز، وتسجيل الطالب، وتحويلات المراحل، وتعيين المحكمين.
- `student_profiles` يدعم `riwaya` و`memorized_hizb` (0–60) قراءةً وكتابةً.
- النسخة الاحتياطية الكاملة أصبحت `ihsan-academy-full-backup-v4` وتشمل الجداول الثمانية؛ الاستعادة تقبل `v2`/`v3`/`v4`.
- `scripts/competitions-test.mjs` (124 فحصًا) + `npm run test:competitions:local`، ومربوط بـ`npm run check` وCI؛ تحديث `backup-restore-test.mjs` إلى v4 (53 فحصًا) و`points-local-test.mjs` (62 فحصًا، يعيد قاعدة الحضور إلى 5/2).
- حراسات `security-check.mjs` تغطي الجداول الثمانية وبذرة `competition_award` وعدم حذف السجلات القديمة وعناصر واجهة المسابقات.
- نسخة الأصول 20261113-1، وكاش PWA v143-20261113-1، وسجل التطبيق V64.

## 2026-11-12 — نسخة كاملة v3 للاستعادة (published 20261112-3)

- إصلاح عطل حقيقي في النسخ الاحتياطي: التصدير الكامل والاستعادة كانا يستثنيان اقتصاد النقاط وجداول مسار القرآن الستة، أي فقدان بيانات صامت عند الاستعادة.
- التصدير الكامل أصبح `ihsan-academy-full-backup-v3` ويضم: `point_rules`, `point_events`, `store_items`, `store_redemptions`, `quran_paths`, `quran_daily`, `quran_pairs`, `quran_pair_sessions`, `quran_stations`, `quran_makeups`.
- الاستعادة تتحقق من كل صف (معرّفات، علاقات، قيم، تواريخ)، وتفحص تعارضات المفاتيح الفريدة قبل بدء الدمج وتُعيد 409.
- قبول ملفات v2 القديمة؛ الحقول الغائبة تُعامل كقوائم فارغة. حدّ الملف 16 ميغابايت.
- `scripts/backup-restore-test.mjs` (34 فحصًا) + `npm run test:backup:local`، ومربوط بـ`npm run check` وCI.
- حراسات ثابتة في `security-check.mjs` تمنع تراجع التصدير/الاستعادة عن جداول الاقتصاد والقرآن.
- نسخة الأصول 20261112-3، وكاش PWA v142-20261112-3.

## 2026-11-12 — 374a59e (published 20261112-2)

- مسار القرآن: صفحة طالب واحدة بأربعة تبويبات (اليومي، الخطة، الرفيق، المحطات) + بطاقة الرحلة والاستدراك.
- للطاقم: متابعة الفوج (حفظ/مراجعة جماعية) ووضع الإشراف (الخطط، الرفيق، المحطات، الاستدراك).
- هجرة `0005_quran_path.sql`: `quran_paths`, `quran_daily`, `quran_pairs`, `quran_pair_sessions`, `quran_stations`, `quran_makeups`، مع bootstrap وقت التشغيل.
- فئات المحفوظ 15/30/45/60 → تثبيت ثمن/ربع/ثلاثة أثمان/نصف حزب، وورد 1/2/4 أحزاب.
- الرفيق تسميع ثنائي بشري ببطاقة 50/20/15/15 وتقدير، والتجاوز اليدوي الكبير يتطلب سببًا.
- محطات الشيخ 15/30/45/60 بقرار للطاقم فقط، واستدراك يمنع الحفظ الجديد عند الحاجة.
- طباعة: بطاقة متابعة الطالب وبطاقة الرفيق (RTL → PDF).
- `quran-path-test.mjs` (44 فحصًا) داخل `npm run check` وCI؛ role-permission 0 failures.
- إصلاح كامن: `weekStart` في تقرير القرآن و`quranStreak` يستخدمان `addCalendarDays` بدل تمرير رقم إلى `academyDate`.
- نسخة الأصول 20261112-2، وكاش PWA v141-20261112-2.
- أسماء الخطط صارت وصفية (المكثفة / المتوسطة / المتدرجة) مع سطر توضيحي للحمل اليومي في نموذج التسجيل.
- خطط الحفظ الثلاث موثّقة في `docs/programs/QURAN-PATH-PLANS.md` (مقترح للاعتماد).

## 2026-11-11 — 6c963e2 (published 20261111-4)

- worldPage (`world`): 6 ranks, garden, daily quests, claim, reading streak.
- cardPage (`card`): bank-style student pass, serial, badges, history, print.
- guidePage (`guide`): daily sentence, 6 steps, live rules table, weights 25/35/30/10, ranks.
- wallet chips in workspace header.
- Ruby Noire theme + card cascade fix (`#ihsan-prayer-dialog` removed from background `:is()`).
- `/api/points/reading` GET/POST (one per student/day, dedupe via event key).
- `quran_reading` rule (5/2, max 1/day) in 0004 + runtime bootstrap.
- Asset version 20261111-4, SW cache v139-20261111-4.
- Default student tab = world.

## 2026-11-07 — d08ea92

- Economy: point_rules, point_events, store_items, store_redemptions (0004).
- Unified tasks, content (hadith/mutoon), competitions.
- points-local-test.mjs (69 checks).
- REBUILD-PLAN-2026-11.md.

## 2026-11-03 — caf1d72

- Asset cache bust (academy update #89).

## 2026-11-02 — origin/main

- Mark main as historical; point to Cloudflare source.

## Notes

- Legacy app (root server/, android-app/) is historical (V65), not the deployed app.
- APK out of scope (decision).
