# نتائج الاختبار — 2026-11-11

## محلي (D1 محلية، wrangler dev:8788, BOOTSTRAP_SECRET=test-bootstrap-secret-1234)

| اختبار | النتيجة | دليل |
|---|---|---|
| `npm run check` | PASS | "Security regression guardrails passed." |
| `npm run prepare:assets` | PASS | public/ regenerated |
| `test:points:local` (70 check() calls) | 69/69 PASS (1 env setup skipped) | log: 2026-11-11 |
| قراءة manual flow | PASS | POST 201 (+5/+2), dup 409, GET logged_today:true, streak:1 |
| Browser: world/card/guide/wallet | PASS | computed Ruby gradient applies; 0 console errors (only expected 401 /api/me before login) |
| Card background cascade fix | PASS | bgImage = linear-gradient (Ruby) |

## CI (GitHub Actions)

| workflow | الحالة | ملاحظة |
|---|---|---|
| cloudflare-free-check | PASS (last push 6c963e2) | check + prepare:assets + deploy dry-run |

## إنتاج (a-ihsan.pages.dev)

| فحص | النتيجة | دليل |
|---|---|---|
| /api/health | 200 ok | verified |
| asset version | 20261111-4 | verified (live files hash-match HEAD normalized) |
| /api/points/*, /api/tasks, /api/content, /api/competitions | 401 (auth gate) | cannot verify without credentials |
| student pages render | **غير مختبر** | blocked on human login |
| D1 0004 | **غير مختبر** | blocked on wrangler auth |

## فشل

لا فشل مُسجَّل في الاختبارات المحلية. فجوات (غير فشل): cross-role tests (now covered by role-permission-test.mjs, 0 failures), offline, restore drill, production verification — see TEST-PLAN.md.

## إصلاح مكتشف during audit

- `/api/admin/backup/full-export` كان يُرجع 500 بسبب متغير غير مُعرّف (`googleIdentities` missing from Promise.all destructure). أُصلح في `src/index.js`. Verified 200 locally.
