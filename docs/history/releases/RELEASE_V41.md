# Release V41

## الحالة
نسخة تطوير متقدمة جاهزة للانتقال إلى staging، وليست نشرًا عامًا تلقائيًا.

## ما أُنجز
- Production security configuration
- HTTPS/TLS enforcement when production flag is enabled
- Secure session cookies + CSRF for cookie-auth requests
- Rate limiting + login throttling
- Security headers
- Arabic privacy policy
- PostgreSQL adapter
- PostgreSQL migrations
- JSON → PostgreSQL migration
- PostgreSQL backup/restore tools
- Existing JSON/SQLite backup and migration flows preserved

## التحقق
`npm test` → 303 passed, 0 failed.

## المطلوب على الخادم الحقيقي
1. `npm install`
2. إنشاء PostgreSQL database
3. ضبط `DATABASE_URL`
4. ضبط TLS certificate/key
5. `npm run migrate:postgres`
6. `npm run backup:postgres` بعد أول بيانات إنتاجية
7. تشغيل اختبارات staging ثم `NODE_ENV=production npm start`

لا يوجد ادعاء بأن HTTPS أو PostgreSQL «منشوران» قبل تنفيذ الخطوات الخاصة بالخادم الحقيقي.
