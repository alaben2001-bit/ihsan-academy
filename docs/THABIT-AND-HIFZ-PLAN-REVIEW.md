# خطط الحفظ والتثبيت (Thabit) — مراجعة تقنية (أكاديمية الإحسان)

## مواضع الاستخدام (src/index.js)
- `QURAN_CATEGORIES` (≈line 1113): 15/30/45/60 حزب، thabit: 0.125/0.25/0.375/0.5، workDays 5.
- `JOURNEY_THABIT_MINUTES` (≈1304): 15→10, 30→15, 45→20, 60→25 (تقدير).
- `thabit_reference_status: "proposal"` (≈1416) — حالة «مقترح» (ليست معتمدة).
- Plan application via `/api/quran/path` + `/api/quran/plan` (reused by journey).
- Daily kinds: hifz/thabit/ward (quran_daily).

## القيم الحالية (اقتراح)
| category (hizb) | hifz plan | thabit (hizb) | ward (ahzab) | workDays |
|---|---|---|---|---|
| 15 | plan? | 0.125 (⅛) | 1/2/4 | 5 |
| 30 | plan? | 0.25 (¼) | 1/2/4 | 5 |
| 45 | plan? | 0.375 (⅜) | 1/2/4 | 5 |
| 60 | plan? | 0.5 (½) | 1/2/4 | 5 |

## أثر تغيير Thabit (2.5/5/7.5)
- أرقام 2.5/5/7.5 حزب (≈ quarter-hizb multiples) **ليست** في الكود حالياً (0.125/0.25/0.375/0.5).
- تغييرها يؤثر على: thabit_amount stored, thabit_label, estimated minutes, daily log amount, streak/summary.
- **لا تغيّر تلقائيًا.** يتطلب اعتماد Sheikh.
- ما يمكن اختباره تقنيًا: idempotency of daily thabit log, summary counts, plan application.

## ما يحتاج اعتماد Sheikh
- أرقام Thabit (0.125/0.25/0.375/0.5 vs 2.5/5/7.5).
- خطط الحفظ (مبتدئ/متوسط/عالٍ + تمهيدي): 8 أشهر + نتائج 1/3/6/8.
- 7 أجزاء «فمي بشوق» (تلاوة vs استماع vs حفظ vs تسميع).
- 2.5/5/7.5 حزب (مُعلَّمة «اقتراح»).
- QCM تفاعلي، التأخر والجزاء.

## ما يمكن اختباره تقنيًا الآن
- daily log idempotency, makeups, stations, companion rubric (44/44).
- plan application reuse /api/quran/path + /api/quran/plan.
- journey review scope (current group_id).

## قرار مطلوب من Malone
- اعتماد الأرقام الحالية (0.125/0.25/0.375/0.5) أو البدائل (2.5/5/7.5).
- لا تعديل code حتى الموافقة.
