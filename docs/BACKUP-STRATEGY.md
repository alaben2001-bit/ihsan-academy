# استراتيجية النسخ الاحتياطي — أكاديمية الإحسان

## الوضع الحالي
- Full export v4 (`GET /api/admin/backup/full-export`) + restore (merge) v2/v3/v4.
- backup-restore-test: 55/55 (محلي).
- **لا نسخ مجدولة/خارجية** حالياً.

## المطلوب (للموافقة)
1. **نسخ مجدولة**: cron (Cloudflare Workers Cron Trigger) → export v4 → store in R2 (أو S3-compatible).
2. **نسخة خارجية مستقلة**: R2 bucket منفصل (أو S3) — secrets في Cloudflare env (لا Git).
3. **التحقق من السلامة**: checksum (sha256) + restore drill في DB محلية.
4. **سجل نجاح/فشل**: audit_log entries (backup_scheduled_success/fail).
5. **تنبيه при 실패**: email/webhook (Cloudflare Notifications أو external).

## خدمات/أسرار/تكاليف (يحتاج موافقة)
- R2 bucket (Cloudflare) — within free tier likely; confirm quota.
- Cron Trigger (Workers) — free.
- Secrets: R2 access keys (env vars, not Git).
- External webhook/email for alerts (optional, may cost).

## لا تنفيذ دون موافقة
- لا إنشاء R2/Worker cron بدون موافقة.
- لا استخدام خدمة مدفوعة دون موافقة.

## خطة (عند الموافقة)
- Add cron handler in src/index.js (scheduled) calling export + R2 put.
- Add restore drill script (backup-restore-test already covers).
- Add alert on failure (log + optional webhook).
- Document in PRODUCTION-READINESS.
