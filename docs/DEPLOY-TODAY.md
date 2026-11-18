# نشر اليوم — الأمر الواحد (نفّذه أنت)

**كل شيء داخل المشروع جاهز ومختبر. العائق الوحيد: لا أملك صلاحية الوصول إلى حساب Cloudflare — يجب أن تنفذ النشر بنفسك أو تعطيني API Token.**

## ب. النشر الكامل بصفتك المالك (الأوامر بالترتيب)

```bash
cd "C:\Users\alabe\OneDrive\المستندات\Default Project\deploy\cloudflare"

# 1) نسخة احتياطية للإنتاج أولًا (لا تفوّتها)
npx wrangler d1 export ihsan-academy-students --remote --output backup-before-v72.sql

# 2) نشر الأكاديمية
npx wrangler deploy

# 3) ترحيل 0009 على الإنتاج — عبر زر «تطبيق الترحيل 0009 الآن» في صفحة «فحص النظام» (أنت مدير، فقط تأكد من التأكيد)

# 4) إنشاء ونشر بوابة التيسير
npx wrangler pages deploy ../taysir/site --project-name=at-taysir
```

## أ. أو: اعطني API Token بصلاحية Workers/Pages/D1 على هذا الحاسوب

انسخ الرمز من Cloudflare Dashboard → My Profile → API Tokens → «Create Token» → قالب **Edit Cloudflare Workers** (مع صلاحية D1 و Pages)، ثم اكتب:

```powershell
[Environment]::SetEnvironmentVariable("CLOUDFLARE_API_TOKEN","الرمز_هنا","User")
```

ثم قل لي «جاهز» وسأنفذ الأوامر الأربعة بنفسي وأتأكد.

## ما اختُبر وما لم يُختبر بعد
- ✅ التسجيل والاعتماد والعزل: 62 فحص آلي + متصفح؛ المسح والبطاقات؛ النقاط والمتجر؛ مسار القرآن 4/8/12؛ 535 فحصًا خضراء على قاعدة نظيفة.
- ❌ لم تُنشر التيسير ولا الأكاديمية بعد (لا تملك حسابي — لا يمكنني النشر بدونك).
- ⚠️ النسخة الاحتياطية أمر إلزامي قبل أي `--remote` أو before-deploy migration.

> ملاحظة: **بمجرد حصولك على الحساب**، إن تعذر إنشاء موقع at-taysir بنفس الاسم، أنشئ المشروع يدويًا من لوحة Cloudflare (Pages → Create → Direct Upload → ارفع `deploy/taysir/site`)، ثم حدّث رابط `TAYSIR_URL` في `src/` إن اختلف النطاق.
