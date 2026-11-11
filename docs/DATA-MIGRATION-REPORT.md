# تقرير الترحيلات وD1 — 2026-11-11

## الترحيلات (deploy/cloudflare/migrations)

| ملف | الحالة (محلي) | طبيعة |
|---|---|---|
| 0001_initial.sql | applied | schema + seed |
| 0002_daily_use.sql | applied | daily use |
| 0002_google_identities.sql | applied | google identities |
| 0003_temporary_student_passwords.sql | applied | temp passwords |
| 0004_learning_economy.sql | applied | economy (additive) |

## 0004 — محتوى

- `point_rules`, `point_events`, `store_items`, `store_redemptions`.
- `CREATE TABLE IF NOT EXISTS` + `INSERT OR IGNORE` (additive, no destructive SQL).
- 7 قواعد seeded (attendance 5/2, quran 10/5, assignment 10/5, excellent 20/10, test 10/5, daily 5/5, reading 5/2).

## Runtime bootstrap

`ensureLearningSchema(env)` (src/index.js:416) runs `LEARNING_SCHEMA_STATEMENTS` (== 0004) once per worker isolate, idempotent. Invoked after auth (line 624). 503 fallback for `/api/points*` and `/api/store*`.

## حالة الإنتاج

- **غير مُتحقق.** لا wrangler auth (`wrangler whoami` → not authenticated).
- لا يمكن فحص `d1_migrations` table على الإنتاج.
- لا يمكن التأكد من وجود الجداول/البيانات.

## خطة تحقق (قراءة فقط، قبل أي كتابة)

1. `wrangler login` (human).
2. `npx wrangler d1 migrations list ihsan-academy-students --remote` → check 0004 status.
3. `npx wrangler d1 execute ... --remote --command "SELECT name FROM sqlite_master WHERE type='table'"` → verify tables.
4. Compare against expected schema.
5. Check `d1_migrations` rows.

## خطة تطبيق (إذا غير مطبق)

- Pre-check: backup export via `/api/admin/backup/full-export` (human, authenticated) + verify readable.
- Apply: `npx wrangler d1 migrations apply ihsan-academy-students --remote`.
- Post-check: tables, migration row, data intact, economy endpoints work.
- **Requires explicit human approval before execution.**
- **No D1 restore on production during testing.**

## Risks

- If runtime bootstrap already created tables, official migration may conflict only if `d1_migrations` lacks the row → wrangler may re-run statements (all IF NOT EXISTS / INSERT OR IGNORE) → safe, no data loss. But migration row must be reconciled.
- If data exists in tables created by bootstrap, migration re-run is idempotent → safe.
