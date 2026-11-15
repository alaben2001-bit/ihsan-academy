# خطة ترحيل قاعدة بيانات الإنتاج (D1) — أكاديمية الإحسان

> **لم يُطبَّق أي ترحيل بعد.** هذا مستند تخطيط. التوقف قبل التطبيق (يتطلب موافقة صريحة).

## 1) تشخيص فشل المصادقة (Wrangler)
- `wrangler whoami`: "You are not authenticated. Please run `wrangler login`."
- في بيئة غير تفاعلية (agent) يلزم `CLOUDFLARE_API_TOKEN` (أو `wrangler login` تفاعلي).
- **الإجراء المطلوب من المالك**: إنشاء API Token (Edit Cloudflare Workers + D1) وتعيينه في `CLOUDFLARE_API_TOKEN`، أو تشغيل `wrangler login` على جهازه. **لا تضع التوكن في Git.**

## 2) قاعدة البيانات المستهدفة
- `database_name`: `ihsan-academy-students`
- `database_id`: `33123c73-73a0-4eba-9b48-d3ed5ac92266`
- `migrations_dir`: `migrations`
- (من `wrangler.jsonc`)

## 3) حالة كل ترحيل

| # | ملف | additive؟ | أثر | حالة التحقق |
|---|---|---|---|---|
| 0001 | initial | creates base tables | إنشاء مبدئي (لا بيانات) | مُتحقَّق محليًا (0001) |
| 0002 | daily_use | ALTER groups + index | إضافة teacher_id | مُتحقَّق |
| 0002 | google_identities | CREATE TABLE | جدول جديد | مُتحقَّق |
| 0003 | temporary_student_passwords | ALTER users + index | must_change_password | مُتحقَّق |
| 0004 | learning_economy | tables for points/store/economy | جداول جديدة + seed rules | runtime ensureLearningSchema (lazy) |
| 0005 | quran_path | tables for quran path | جداول جديدة | runtime ensureQuranSchema (lazy) |
| 0006 | competitions | 8 tables | جداول جديدة | runtime ensureCompetitionsSchema? (lazy) |
| 0007 | store_images | ALTER store_items ADD COLUMN image_url | عمود nullable | runtime? likely ensureStoreImageColumn |
| 0008 | rate_limits | CREATE TABLE rate_limits | جدول جديد | lazy ensureRateLimitSchema |

جميعها additive (CREATE TABLE IF NOT EXISTS / ALTER ADD COLUMN / CREATE INDEX). **لا DROP/DELETE**. متوافقة مع بيانات الإنتاج (لا فقدان).

## 4) ترتيب التطبيق
`0001 → 0002 (daily_use) → 0002 (google_identities) → 0003 → 0004 → 0005 → 0006 → 0007 → 0008`.

ملاحظة: worker ينشئ الجداول lazily (ensure*Schema) عند أول طلب، لكن `wrangler d1 migrations apply` هو السبيل «الرسمي» لتسجيل `_cf_KV`/d1_migrations. Runtime bootstrap يعوّض (graceful allow-if-missing).

## 5) نسخة احتياطية قبل التطبيق
- `GET /api/admin/backup/full-export` (v4) → حفظ JSON خارج الإنتاج.
- نسخة D1 محلية (snapshot) عبر `wrangler d1 export` (يتطلب auth).
- التحقق: restore في DB محلية (backup-restore-test 55/55).

## 6) خطة الاسترجاع
- إن فشل migration: استعادة من full-export v4 عبر `POST /api/admin/backup/restore` (merge) أو `wrangler d1 export` restore.
- لا reset. لا حذف.
- التحقق بعد التطبيق: `npm run test:*:local` على snapshot production (read-only) + health check + smoke login.

## 7) متطلبات موافقة Malone (قبل التطبيق)
- اسم DB المستهدفة: `ihsan-academy-students` (id أعلاه).
- حالة كل migration: additive، مُتحقَّق محليًا.
- أثر: إضافة جداول/أعمدة فقط، لا فقدان بيانات.
- نسخة احتياطية: full-export v4 (يجب تنفيذها قبل التطبيق).
- استرجاع: merge restore من v4.

**أوقف هنا حتى الموافقة الصريحة.**
