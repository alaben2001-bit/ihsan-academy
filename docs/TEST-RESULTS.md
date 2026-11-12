# نتائج الاختبار — 2026-11-12

## محلي (D1 محلية، wrangler dev:8788, BOOTSTRAP_SECRET=test-bootstrap-secret-1234)

| اختبار | النتيجة | دليل |
|---|---|---|
| `npm run check` | PASS | "Security regression guardrails passed." |
| `npm run prepare:assets` | PASS | public/ regenerated |
| `test:points:local` (70 check() calls) | 69/69 PASS (1 env setup skipped) | 2026-11-12 |
| `test:quran:local` | 44/44 PASS | 2026-11-12 |
| `test:backup:local` | 34/34 PASS | 2026-11-12 |
| role-permission-test.mjs | 0 failures | 2026-11-12 |
| Browser: world/card/guide/wallet | PASS | Ruby gradient applies; 0 console errors (expected 401 before login) |
| Quran tabs (daily/plan/companion/stations) | PASS | served app.js contains `quranEnrollMarkup` + `quranSupervisionPage` |
| Card background cascade fix | PASS | bgImage = linear-gradient (Ruby) |

## CI (GitHub Actions)

| workflow | الحالة | ملاحظة |
|---|---|---|
| cloudflare-free-check | يُشغَّل عند الدفع | check + prepare:assets + dry-run + points + Quran + backup + role |

## إنتاج (a-ihsan.pages.dev)

| فحص | النتيجة | دليل |
|---|---|---|
| /api/health | 200 ok | verified |
| asset version | 20261112-3 | index/app.js/service-worker verified (SW v142) |
| /api/quran/* | 401 (auth gate) | المسارات موجودة، ليست 404 |
| /api/points/*, /api/tasks, /api/content, /api/competitions | 401 (auth gate) | cannot verify without credentials |
| student pages render | **غير مختبر** | blocked on human login |
| backup v3 in live app.js | ✅ | `ihsan-academy-full-backup-v3` موجود في app.js المنشور |
| D1 0004/0005 | **غير مختبر** | blocked on wrangler auth |

## فشل

لا فشل مُسجَّل في الاختبارات المحلية. فجوات (غير فشل): offline، استعادة النسخ، التحقق على الإنتاج — انظر TEST-PLAN.md.

## إصلاحات مكتشفة أثناء التدقيق

- `/api/admin/backup/full-export` كان يُرجع 500 بسبب متغير غير مُعرّف (`googleIdentities` missing from Promise.all destructure). أُصلح في `src/index.js`. Verified 200 locally.
- `weekStart = academyDate(-6)` كان يمرّر رقمًا بدل تاريخ؛ أُصلح إلى `addCalendarDays(academyDate(), -6)`، وأُعيدت كتابة `quranStreak` بـ`addCalendarDays`.
- `security-check.mjs` كان يتحقق من نص قديم لتفويض صفحة القرآن؛ حُدِّث إلى `await quranRosterPage($("#quran-staff-body"))`.
