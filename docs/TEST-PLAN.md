# خطة الاختبار — أكاديمية الإحسان

## 1. اختبارات موجودة

- `npm run check` (deploy/cloudflare): syntax + security-check.mjs (guardrails).
- `npm run test:points:local`: 69 checks على D1 محلية (اقتصاد).
- CI: check + prepare:assets + wrangler deploy --dry-run.

## 2. سيناريوهات يجب إضافتها (P1)

### اقتصاد (concurrency/idempotency)
- إعادة إرسال نفس الطلب (idempotency key) → لا مضاعفة.
- عمليتان متزامنتان على نفس الرصيد → لا over-spend.
- انقطاع mid-flight → transactional consistency.
- double-click على زر الصرف → redemption واحدة.
- تجاوز max_per_day → 429/409.
- صرف رصيد غير كافٍ → 409.
- عكس → reversed_at + reversal_reason، no delete.
- student_id tampering → 403.
- amount tampering → rejected by server rule.

### عالم/مراتب
- مرتبة جديدة (0 نقاط) = بذرة.
- انتقال عند عتبة (80,250,600,1200,2400).
- منع القفز.
- إعادة حساب عند تصحيح سجل.
- بقاء البطاقة بعد reload.

### صلاحيات (cross-role)
- student A cannot read student B data.
- teacher cannot see other groups.
- supervisor cannot see other teams.
- director cannot see other schools.
- admin endpoints reject non-admin.

### PWA/offline
- install, cache v4, old cache deleted.
- offline navigation fallback.
- no data loss on reconnect.

### Backup
- export → restore in isolated D1 → data identical.

## 3. اختبارات إنتاجية (يحتاج human)

- Login as admin/student on live.
- Open world/card/guide.
- Record reading → reload → persists.
- Verify no data leak between students.
