# تخزين V30

## الوضع الافتراضي
`ACADEMY_STORAGE=json`

هذا هو المسار الآمن الحالي، ويستخدم `data/db.json`.

## تشغيل SQLite محليًا
بعد إنشاء قاعدة SQLite من JSON:

```bash
npm run migrate:sqlite -- data/db.json data/academy-v30.sqlite
ACADEMY_STORAGE=sqlite ACADEMY_SQLITE_FILE=data/academy-v30.sqlite npm start
```

Windows PowerShell:

```powershell
npm run migrate:sqlite -- data/db.json data/academy-v30.sqlite
$env:ACADEMY_STORAGE='sqlite'
$env:ACADEMY_SQLITE_FILE='data/academy-v30.sqlite'
npm start
```

## الرجوع إلى JSON

```bash
npm run migrate:json -- data/academy-v30.sqlite data/db.restored-v30.json
```

## لماذا يسمى هذا جسرًا؟
SQLite في V30 يخزن كل مجموعة حالية كسجل JSON واحد. هذا يحافظ على النموذج الحالي ويتيح اختبار التخزين الحقيقي دون إعادة بناء النظام كله دفعة واحدة. في V31 وما بعده يمكن نقل المجالات المهمة تدريجيًا إلى جداول منظمة مع migration واختبارات، ثم ربط D1 عندما تكون بيئة الإنتاج جاهزة.

## فحص الصحة

```bash
npm run health:storage
```

وفي الخادم:
- `GET /api/health` فحص عام مختصر.
- `GET /api/admin/health/storage` فحص تفصيلي للمدير.
