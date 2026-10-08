# نشر V49 على Render

استخدم Web Service مع Node.js.

Environment:
- `NODE_ENV=production`
- `ACADEMY_PRODUCTION=1`
- `ACADEMY_REQUIRE_HTTPS=0` (لأن Render ينهي HTTPS أمام التطبيق)
- `ACADEMY_STORAGE=postgres`
- `DATABASE_URL=<Render PostgreSQL connection string>`
- `ACADEMY_BOOTSTRAP_ADMIN_NAME=<اسم المدير الأول>`
- `ACADEMY_BOOTSTRAP_ADMIN_EMAIL=<بريد المدير الأول>`
- `ACADEMY_BOOTSTRAP_ADMIN_PASSWORD=<كلمة مرور قوية، 12 محرفًا على الأقل>`

لا ترفع `data/db.json` ولا أي `.env` حقيقي إلى GitHub.
