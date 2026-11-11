# مراجعة المحتوى الشرعي — حالة 2026-11-11

## الحالة

**لم تُجرَ مراجعة شرعية.** لا توجد مطالبة بأن المراجعة تمت. هذا الملف يُسجّل الفجوة، لا يُدّعي الإكمال.

## ما يحتويه التطبيق (deploy/cloudflare)

- الأحاديث/المتون: `/api/content` collections.
- النصوص القرآنية: ورد القراءة، خطة القرآن.
- الأذكار: ? (verify content collections).
- منهج الإحسان: curriculum/subjects.
- المسابقات: competitions.

## قواعد (per task constraints)

1. لا اختلاق آية/حديث/أثر.
2. لا نسب قول إلى عالم دون مصدر.
3. التحقق من نص الحديث ومصدره ودرجته.
4. التحقق من النص القرآني/الرسم/المصدر.
5. تمييز: نص شرعي vs شرح تربوي vs اجتهاد تعليمي.
6. AI ليس مصدرًا شرعيًا مستقلًا.
7. محتوى مشكوك → حالة "بانتظار المراجعة".
8. التدرج (مفاهيم small, examples, application, reflection, follow-up).

## إجراء P1

- تجميع قائمة المحتوى (content collections) مع: id, title, type, source, status.
- 分类: verified / pending / needs-human-review.
- لا نشر محتوى مشكوك بوصفه صحيحًا.
- AI-generated text must be labeled "شرح تربوي" not "نص شرعي".

## TODO

- [ ] Export content list from D1/local.
- [ ] Assign human reviewer.
- [ ] Set status field in content records.
