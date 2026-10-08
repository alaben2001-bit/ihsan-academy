# V41 — Production Security + PostgreSQL

- أضيفت مصادقة Cookie اختيارية مع جلسة خادمية وHttpOnly/SameSite وCSRF للطلبات المعتمدة على Cookie.
- بقي Bearer token مدعومًا للتوافق مع الواجهة الحالية.
- أضيف شرط HTTPS في وضع الإنتاج مع شهادة ومفتاح TLS عبر متغيرات البيئة.
- أضيف HSTS عند تشغيل الخادم عبر TLS.
- أضيفت سياسة خصوصية عربية وواجهة `/api/privacy`.
- أضيف PostgreSQL adapter مع `pg`، queue للكتابات، migrations قابلة للتتبع وJSONB.
- أضيف JSON → PostgreSQL migration وhealth check.
- أضيف `pg_dump` backup و`pg_restore` restore.
- أضيف إعداد `.env.production.example`.
- جميع اختبارات V23–V40 بقيت ناجحة، مع اختبارات V41 للأمن والإنتاج.

> لم تُعتبر نسخة منشورة فعليًا: يجب على صاحب الخادم تثبيت PostgreSQL client، توفير PostgreSQL حقيقي، إعداد TLS، تشغيل migration، ثم إجراء اختبار قبول على بيئة staging.
