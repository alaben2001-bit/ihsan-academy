# تشغيل الإنتاج — V43

## 1. PostgreSQL

```bash
npm install
export ACADEMY_STORAGE=postgres
export DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/academy'
export ACADEMY_PG_SSL=1
export ACADEMY_PG_SSL_VERIFY=1
node tools/migrations-postgres.js
```

## 2. HTTPS

ضع شهادة TLS ومفتاحها في مسارات خاصة بالخادم:

```text
ACADEMY_TLS_CERT_FILE=/etc/letsencrypt/live/example/fullchain.pem
ACADEMY_TLS_KEY_FILE=/etc/letsencrypt/live/example/privkey.pem
```

ثم:

```text
NODE_ENV=production
ACADEMY_PRODUCTION=1
ACADEMY_REQUIRE_HTTPS=1
ACADEMY_COOKIE_SECURE=1
```

## 3. فحص ما قبل الفتح

```bash
npm test
node tools/health-postgres.js
```

## 4. النسخ الاحتياطي

```bash
npm run backup:postgres
```

يُنشأ ملف dump وملف SHA-256 مطابق له.

## 5. الاستعادة

```bash
node tools/restore-postgres.js /path/to/postgres-YYYY.dump
```

لن تتم الاستعادة إذا كان checksum موجودًا ولا يطابق الملف.

## 6. المبدأ التشغيلي

لا تُفتح الأكاديمية للعامة قبل نجاح:
- PostgreSQL health.
- `npm test`.
- backup + checksum.
- اختبار restore على قاعدة منفصلة.
- HTTPS حقيقي.
- حسابات إنتاجية غير تجريبية.
- مراجعة المحتوى الشرعي الموسوم `draft` أو `needs_review`.
