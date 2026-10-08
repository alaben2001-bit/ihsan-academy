# الإنتاج — V49

## المكتمل برمجيًا
- Node.js server مع Sessions خادمية وCookies آمنة في الإنتاج.
- CSRF للطلبات المعتمدة على Cookie، وRate limiting، وقفل لمحاولات الدخول.
- Security Headers وCSP وHSTS عند TLS.
- JSON / SQLite / PostgreSQL adapters.
- PostgreSQL migrations مرقمة 001→009 مع جدول `academy_migrations` وحالة migrations.
- JSON→SQLite وSQLite→JSON وJSON→PostgreSQL، مع نسخ احتياطية واستعادة والتحقق بـSHA-256.
- رفع وحماية ملفات التلاوة والوسائط، وفصل `ACADEMY_MEDIA_ROOT` عن كود التطبيق.
- `/api/health` و`/api/ready` و`/api/metrics`.
- Docker + Compose + PostgreSQL + Caddy + نسخ PostgreSQL دورية مع checksum واحتفاظ.
- PWA، offline fallback، audio dock، قارئ الدروس، خطة اليوم، بنك الأسئلة، مجتمع التعلم، الخصوصية، ولوحات التشغيل.
- سياسة خصوصية عربية قابلة للعرض من `/privacy.html`.

## التحقق
- **340 اختبارًا ناجحًا — 0 فشل**.
- فحص syntax كامل لملفات JavaScript ناجح.

## ما لا يمكن ادعاء تنفيذه من داخل بيئة التطوير
- لم يتم إصدار شهادة TLS حقيقية لنطاق خارجي هنا.
- لم يتم تشغيل PostgreSQL إنتاجية خارجية أو DNS حقيقي.
- لم يتم تنفيذ نشر خارجي أو اختبار حمل/اختبار اختراق خارجي.

عند النشر، استخدم `deploy/README.md` وملف `deploy/.env.example`، ولا تفتح PostgreSQL مباشرة على الإنترنت.
