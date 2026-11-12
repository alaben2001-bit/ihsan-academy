# سجل التغييرات — أكاديمية الإحسان (Cloudflare)

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
