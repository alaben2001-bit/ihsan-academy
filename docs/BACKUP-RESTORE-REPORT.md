# النسخ الاحتياطي والاستعادة — 2026-11-11

## الـ endpoints (admin only)

- `/api/admin/backup/export` — export.
- `/api/admin/backup/full-export` — full export.
- `/api/admin/backup/restore` — restore.
- `/api/admin/backup/summary` — summary.

## الحالة

| بند | الحالة |
|---|---|
| Export code exists | ✅ |
| Restore code exists | ✅ |
| Restore drill (isolated env) | ❌ not performed |
| Scheduled/off-site backups | ❌ absent (manual only) |
| Verification of backup integrity | ❌ not documented |

## مخاطر

- Manual-only backups: no schedule, no off-site, no verified restore.
- Restore on production forbidden during testing (per safety rules).
- Need isolated D1 database for restore drill.

## خطة (P1)

1. Create isolated D1 (local or separate database).
2. Export from local test DB.
3. Restore into isolated DB.
4. Compare row counts + checksums (students, groups, point_events, store_redemptions, academy_records).
5. Document steps + time-to-restore.
6. Add schedule recommendation (cron + R2) — decision required from owner.

## لا تنفذ

- Restore on production D1.
- Overwrite production data.
