# تقرير تدقيق مستقل — أكاديمية الإحسان في بناء الإنسان
**التاريخ:** 2026-11-15 (تحديث 2026-11-14 → 2026-11-15)
**الفرع:** `migration/cloudflare-student-platform` (HEAD `cc72076`, V70)
**المراجع:** مراجع تقني مستقل (وكيل برمجي)

> ملاحظة: الصورة المرجعية للمتجر (`متجر أكاديمية الإحسان الفاخر (1).png`) غير متاحة في بيئة التدقيق (مسار محلي `C:\Users\alabe\Downloads\...`). التدقيق مبني على الكود (V70) + وثائق `docs/`. لا أُدّعي مطابقة بصرية للصورة.

---

## 1. حكم عام

**الكود (V70) منجز ومختبر محليًا (93+62+44+53+0+124+44 فحصًا) لاقتصاد/قرآن/رحلة/متجر/مسابقات/هاتف/بطاقات-كبير-مشرفين/صور-منتجات.**
**لكنه لا يفي بعد بالبرومبت (أوامر "عالم لعبة" + "بطاقات/QR" + "متجر مطابق للصورة") كمنتج كامل.** فجوات جوهرية: عالم اللعبة (Story/Side missions) غير موجود كوظائف فعلية؛ بطاقات/QR (3 رموز + طباعة PDF + إبطال) غير منفذة؛ PWA manifest/SW موجودان لكن offline محدود؛ "عالم ترفيهي" تحويلي (gamification) في Brains (XP/coins/tasks/competitions) لكن لا "Story missions".

---

## 2. أهم العيوب مرتبة حسب الخطورة

1. **HIGH — عالم اللعبة (§5) غير منفذ كوظائف:** لا جداول `missions/side_missions/collectibles`, لا تقدم مرئي متعدد المراحل. `tasks` + `competitions` + `points` موجودة، لكن "Story Missions" كسرد/مراحل غير موجود. **خطر:** الطالب يرى "قائمة مهام"، لا "عالم".
2. **HIGH — بطاقات + 3 QR (§4) غير منفذة:** `/api/student-cards`? لا يوجد. لا طباعة PDF، لا إبطال/إعادة إصدار، لا رموز QR مستقلة. **خطر:** متطلب أساسي (بطاقة مستقلة لكل طالب) غير موجود.
3. **HIGH — متجر مطابق للصورة (§3):** image_url أُضيف (V70) but no seed catalog (لا بيانات حقيقية)؛ لا صور مخزنة (URLs خارجية)؛ لا "جوائز رقمية تُمنح تلقائياً" (badges/titles)؛ لا "حالات الطلب: جديد/معتمد/قيد التجهيز/تم التسليم/ملغى" — redemptions has pending/approved/rejected/fulfilled/cancelled (good, but "قيد التجهيز" missing). **خطر:** متجر "شكل" بدون كتالوج real.
4. **HIGH — أمان QR:** لا endpoints QR (لا يوجد QR generation)؛ لا rate-limiting على الخادم (in-memory impossible on Workers; need D1/KV). **خطر:** تكرار معاملات/تلاعب.
5. **MEDIUM — PWA/offline (§8):** SW موجود، manifest موجود، but "offline data محدودة" (لا IndexedDB cache للبيانات)؛ "عمليات حساسة تتطلب اتصال" مذكورة but not enforced as queue. **خطر:** PWA "تثبيت" works, offline data limited.
6. **MEDIUM — "لا تغيّر خطط الحفظ" (§6):** respected in code (plans are reference data, thabit proposal pending approval). Good.
7. **MEDIUM — "AI assistant" (prompt):** غير منفذ (لا provider). architecture-only. Good (لا fake).
8. **MEDIUM — اختبارات browser (§10):** browser tools disconnected؛ 22 flow manual untested. **خطر:** claims "PASS" are HTTP/static only.
9. **LOW — "منصة التيسير" external portal:** teaser only; no content/contact/donation. **خطر:** placeholder.
10. **LOW — "فيديو center":** not started.

---

## 3. المتطلبات الناقصة (مقابل البرومبت)

| متطلب | الحالة | دليل |
|---|---|---|
| Store image + visual match to reference | ⚠️ جزئي | image_url added (V70), no seed catalog, no uploaded images, no "قيد التجهيز" status |
| Store digital rewards auto-grant | ❌ | no badges/titles/levels/collectibles tables |
| 3 QR codes per student card | ❌ | no card/QR endpoints |
| Card print (single/group/school/all) + PDF | ❌ | no PDF generation |
| Card revoke/reissue | ❌ | no card lifecycle |
| Story Missions (main path) | ❌ | no missions tables |
| Side Missions (daily/weekly) | ⚠️ جزئي | tasks exist, but "missions" as narrative/stages no |
| Levels/XP/collectibles | ⚠️ جزئي | achievement points exist, but "collectibles" (items) no |
| Sound effects (non-musical) | ❌ | no audio |
| PWA install on iPhone/Android | ⚠️ جزئي | manifest + SW exist; not tested on real device |
| Offline data (read-only) | ⚠️ جزئي | SW caches assets; no IndexedDB data cache |
| Rate limiting (sensitive ops) | ❌ | none |
| Idempotency keys (explicit) | ⚠️ جزئي | request_id dedup on award; not all endpoints |
| QR security (no secrets in QR) | N/A | no QR yet |
| AI assistant | ❌ (by design) | no provider; architecture only |
| Video center | ❌ | not started |
| Hifz plans (3 + تمهيدي) | ⚠️ جزئي | 15/30/45/60 exist; "مبتدئ/متوسط/عالٍ" tiers not modeled |
| Ward «فمي بشوق» (7 parts) | ❌ | only 1/2/4 ahzab |
| Thabit 8-month schedule | ⚠️ جزئي | categories exist; 8-month results at 1/3/6/8 no |
| QCM (interactive) | ❌ | no QCM tables/UI |
| Penalties (UI) | ⚠️ جزئي | backend endpoint exists (V69); no UI, no backlog/advice/makeup tracking |
| Hierarchy view (real data) | ✅ | V68 |
| Roadmap board | ✅ | V68 |
| Duas/adhkar drafts | ✅ | V67 |
| Teacher deactivation | ✅ | V67 |
| Global chief supervisor | ✅ | V67 |
| Content review states (6) + attribution (5) | ✅ | V67 |
| Second platform teaser | ✅ | V67 |
| Mobile identity/admin access | ✅ | V66 |

---

## 4. التناقضات والغموض في البرومبت

1. **"منصة التيسير" vs "منصة طلب العلم"**: البرومبت (والملخص) يستخدمان كلا الاسمين. **القرار (مستخدم، 2026-11-14):** second in-app module = teaser only; منصة التيسير = external introductory portal. **أضف هذا التوضيح صراحةً إلى البرومبت.**
2. **"XP = achievement, Coins = store"**: واضح. لكن "جوائز رقمية (شارات/ألقاب/مستويات)" غير محددة: هل هي store_items (cost 0) أم achievements (point_events)؟ **أضف:** "الجوائز الرقمية تُمنح كـ achievement (XP) + record في academy_records collection `student_badges` (لا جدول جديد)، والجوائز المادية كـ store_redemption."
3. **"8 أشهر / 3 خطط"**: أرقام التثبيت "60→½, 45→⅜, 30→¼, 15→⅛" **مقترح (pending sheikh approval)**. البرومبت (§6) يقول "لا تخترع خططاً جديدة" لكن "8 أشهر" itself is a proposal. **أضف:** "الأرقام تبقى reference data قابلة للتحرير (plans table), لا hardcoded."
4. **"عالم لعبة" (§5) vs "لا إدمان":** تناقض (engagement vs anti-addiction). **أضف:** "الهدف: عودة يومية (daily streak) مع cap على rewards/day، ولا grinding."
5. **"QR دخول الطالب" (§4):** "لا يكون بديلاً عن التحقق" — unclear mechanism. **أضف:** "QR يحتوي signed token (JWT-like, short-lived) → redirect to login with pre-filled identity (not password); still requires password/biometric."
6. **"طباعة PDF" (§4):** no specified library. **أضف:** "use jsPDF + qrcode (client-side) OR server-side Puppeteer; prefer client-side for scale."
7. **"AI assistant" (§6):** "لا تختلق AI integration" vs "AI assistant must be transparent..." — contradictory. **أضف:** "AI is opt-in, provider TBD by owner; build architecture (rate limit, logging, no religious rulings) only."

---

## 5. الوظائف التي قد ينفذها الوكيل شكلياً فقط (خطر)

- **Store UI without real catalog:** `store_items` has 0 rows on fresh DB; smoke test seeds nothing. **Mitigation:** require admin to add real items; UI shows honest empty state (already does).
- **"Story missions" as static text:** could be faked as a list of cards with no progress tracking. **Mitigation:** require `student_missions` progress table + backend endpoints before UI.
- **QR as image only:** could generate QR pointing to a non-functional URL. **Mitigation:** require end-to-end scan test.
- **PWA "offline":** could claim offline while only assets cached. **Mitigation:** define offline scope = read-only cached pages; sensitive ops require network (already stated).
- **"AI assistant":** could be a canned chatbot. **Mitigation:** no provider = no feature (already respected).

---

## 6. مخاطر على المشروع الحالي

1. **Migration risk:** 0007 ALTER TABLE on existing prod D1 untested (wrangler auth blocked). **Mitigation:** runtime `ensureLearningSchema` wraps ALTER in try/catch (idempotent).
2. **Data loss risk:** "تعطيل حساب" (soft) preserves data. Good. But group deletion (admin) — verify it's soft (active=0) not hard delete. **Check:** `DELETE /api/groups/:id` — verify.
3. **Performance:** `load()` fetches groups+students+teachers; mobile smoke shows group create 56ms. OK. But `pointsPage` fetches multiple endpoints; could be slow on weak devices.
4. **Security:** no rate limiting; CSRF via cookie (good); session token in cookie (good); no secrets in frontend (good).
5. **Browser verification unavailable:** all "PASS" are HTTP/static. **Risk:** visual bugs undetected.

---

## 7. التعديلات (ملحق للإلحاق بالبرومبت الأصلي)

### 7.1 متجر (§3)
أضف:
- "كل منتج يجب أن يملك `image_url` (nullable) + fallback icon. صور من R2 أو URL خارجي؛ لا base64 في D1."
- "حالات الطلب: `pending, approved, preparing, fulfilled, rejected, cancelled`."
- "الجوائز الرقمية: `academy_records` collection `student_badges` (لا جدول جديد) + achievement points (XP)."
- "الجوائز المادية: `store_redemptions` (موجود) + حالة `preparing`."
- "كتالوج real: admin يدخل items; no seed/demo data shown to students."
- "منع النقر المتكرر: disable button + idempotency key (request_id)."

### 7.2 بطاقات/QR (§4)
أضف:
- "3 QR per student: (1) add-points (signed short-lived token, admin/muhaffiz only), (2) profile (auth-gated), (3) login (pre-fill identity, not password)."
- "QR contains only signed token (no PII, no secrets)."
- "Card lifecycle: issue, revoke, reissue; `academy_records` collection `student_cards`."
- "Print: single/group/school/all; PDF via jsPDF+qrcode (client-side); preview before print."
- "QR scannability test: validate after generation."

### 7.3 عالم اللعبة (§5)
أضف:
- "Story Missions: `academy_records` collection `student_missions` with stages/progress; backend endpoints before UI."
- "Side Missions: daily/weekly tasks (existing tasks table) tagged `mission_type`."
- "Collectibles: `academy_records` collection `student_collectibles`."
- "Levels derived from achievement points (existing); no new wallet."
- "Daily reward cap to prevent grinding; anti-addiction: no streak-breaking punishment."

### 7.4 PWA (§8)
أضف:
- "Offline scope: read-only cached pages + last-known data; sensitive ops require network."
- "Manifest + SW (existing); verify install on real iPhone/Android."
- "No offline point transactions."

### 7.5 أمان (§9)
أضف:
- "Rate limiting: D1-based counter table `rate_limits` (key, window, count) for sensitive endpoints."
- "Idempotency: all write endpoints accept `request_id` (UUID) and dedup."
- "QR: signed tokens (HMAC with server secret), short TTL, single-use for add-points."
- "No secrets in frontend (already)."

### 7.6 AI (§6)
أضف:
- "AI provider TBD by owner; build architecture only (rate limit, logging, no religious rulings, no data changes without approval)."
- "Do not fake AI integration."

### 7.7 "منصة التيسير"
أضف:
- "Second in-app module = teaser only (titles). منصة التيسير = external introductory portal (no login/content now)."

---

## 8. توصية AI/أداة تنفيذ

**توصية واحدة: GitHub Copilot (Workspace/Agent mode) + GitHub Actions CI (already configured).**
- **السبب:** المستودع على GitHub؛ Copilot Agent mode يقرأ/يعدّل الملفات ويُشغّل أوامر build/test؛ CI workflow (`.github/workflows/cloudflare-free-check.yml`) already runs check+prepare+tests. **تكلفة:** Copilot Pro $10/月 (أو Pro+ $39/月 for advanced models). **بديل:** OpenCode (current harness) for local edits + CI for verification. **لا حاجة لأداة إضافية.**

---

## 9. ما تم (V67–V70) — ملخص

- V67: teaser, teacher deactivation, global chief, duas/adhkar, content review states (6) + attribution (5).
- V68: hierarchy view (real data) + roadmap board.
- V69: penalty deduction endpoint (store only, audited).
- V70: store product image support (image_url column + UI).

**E2E:** journey 93/93, points 62/62, quran 44/44, backup 53/53, role 0, competitions 124/124, mobile 44/44. `npm run check` PASS.

---

## 10. ما بقي (أولويات)

1. **بطاقات/QR** (HIGH) — schema + endpoints + print/PDF + revoke.
2. **عالم اللعبة (Story/Side missions)** (HIGH) — schema + progress + UI.
3. **متجر real catalog** (HIGH) — admin يدخل items; seed real data (owner).
4. **جوائز رقمية (badges/titles)** (MEDIUM).
5. **PWA offline (IndexedDB)** (MEDIUM).
6. **Rate limiting + Idempotency** (MEDIUM).
7. **Hifz plans tiers + 8-month thabit** (HIGH, awaits sheikh approval).
8. **Ward «فمي بشوق»** (MEDIUM).
9. **QCM** (MEDIUM).
10. **Penalties UI + backlog/advice/makeup** (MEDIUM).
11. **Video center** (LOW).
12. **Browser E2E (22 flows)** (BLOCKED: browser disconnected).

---

## 11. قرار (bounded)

**Not production-ready for full claim.** الكود V70 مختبر محليًا (E2E كامل)، لكن D1 prod/OAuth/offline/browser-E2E/VR (sheikh approval) لم تُتحقق. **لا تُنشر** قبل موافقة صريحة + D1 prod migrations verified.

---

## 12. ما تم في هذا الدور (auto-pilot)

- Audit report + appendix created (`docs/AUDIT-REPORT-2026-11-15.md`).
- Store image support (V70) implemented + tested.
- All commits pushed? **No** — nothing pushed (per policy).
- 4 commits this session: V67, V68, V69, V70.

**الخطوة التالية (بانتظارك):** (a) موافقة نشر، (b) معرّفات "أستاذ أحمد/نموذج"، (c) كتالوج المتجر real، (d) اعتماد أرقام خطط الحفظ من Sheikh.