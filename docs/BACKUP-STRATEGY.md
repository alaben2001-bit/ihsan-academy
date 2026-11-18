# استراتيجية النسخ الاحتياطي — أكاديمية الإحسان

## الوضع الحالي (بعد تنفيذ النسخ المجدول)
- Full export v4 (`GET /api/admin/backup/full-export`) + restore (merge) v2/v3/v4.
- backup-restore-test: 55/55 (محلي).
- **النسخ المجدول: الكود مكتمل ويعمل محلياً** (`scheduled()` + `buildFullBackup()` في `src/index.js`).
  - يبني نفس نسخة v4 الكاملة، يرفعها إلى R2 تحت `backups/ihsan-academy-full-backup-v4-<ISO>.json`،
    ويحتفظ بآخر **14** نسخة فقط (حذف الأقدم تلقائياً).
  - يسجّل في `audit_log`: `backup_scheduled_success` (مع المفتاح وأعداد السجلات) أو `backup_scheduled_failure` (مع الرسالة).
  - فشل النسخة لا يُفشل العامل ولا يؤثر على الموقع.
- **العائق الوحيد للإنتاج: R2 غير مفعّل في حساب Cloudflare** (خطأ `code: 10042` عند محاولة إنشاء الـ bucket).

## الخطوة اليدوية المطلوبة (مرة واحدة، من صاحب الحساب)
1. لوحة Cloudflare → **R2** → تفعيل الخدمة (يتطلب إضافة طريقة دفع؛ الاستخدام هنا ضمن الحد المجاني عادة).
2. إنشاء bucket باسم `ihsan-academy-backups`.
3. في `deploy/cloudflare/wrangler.jsonc`: إزالة التعليق عن مقطعي `r2_buckets` و `triggers` (جاهزان كتعليق).
4. نشر: `npx wrangler@4 deploy` (الـ cron: `0 3 * * *` = 03:00 UTC يومياً).
5. تحقق: `wrangler r2 object list ihsan-academy-backups` ثم سجل التدقيق يظهر `backup_scheduled_success`.

## ما تم التحقق منه محلياً (2026-11-18)
- تشغيل `wrangler dev --test-scheduled` + استدعاء `/__scheduled?cron=0+3+*+*+*` → 200.
- `audit_log` يحتوي `backup_scheduled_success` مع مفتاح النسخة وأعداد (users / academy_records / store_items).
- محاولة إنتاجية أولى بلا الدالة أعطت `backup_scheduled_failure` (تثبت أن الفشل يُسجَّل ولا يُسقط العامل).

## ما تبقّى (اختياري، يحتاج موافقة)
1. **نسخة خارجية مستقلة**: bucket/R2 منفصل في حساب آخر أو S3 — حماية من فقدان الحساب نفسه.
2. **تنبيه عند الفشل**: Cloudflare Notifications أو webhook خارجي (اختياري وقد يكون مدفوعاً).
3. **checksum (sha256)** مرفق بكل نسخة + restore drill دوري على DB محلية (سكربت backup-restore-test موجود).
4. **التحقق من الاستعادة** لنسخة R2 حقيقية (بعد التفعيل).

## ضوابط ثابتة
- لا أسرار في Git: أي مفاتيح R2/S3 تُخزَّن كـ secrets في Cloudflare.
- لا حذف نسخ إلا وفق سياسة الاحتفاظ (14 نسخة).
- النسخة تحتوي كلمات مرور مُعمّاة (hash) — تُعامل كبيانات حساسة ولا تُشارك.
