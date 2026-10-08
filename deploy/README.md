# نشر أكاديمية الإحسان — V49

1. انسخ `.env.example` إلى `.env` وضع كلمة مرور طويلة وعشوائية واسم النطاق.
2. وجّه DNS للنطاق إلى الخادم.
3. شغّل: `docker compose --env-file .env -f deploy/docker-compose.yml up -d --build`
4. Caddy يستخرج شهادة TLS ويجددها تلقائيًا.
5. افحص: `https://النطاق/api/health` و `https://النطاق/api/ready`.
6. النسخ الاحتياطي اليومي لـPostgreSQL محفوظ في volume `academy_backups` مع احتفاظ 14 يومًا.

ملاحظة: لا تُفتح قاعدة PostgreSQL للإنترنت مباشرة.
