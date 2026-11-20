-- المدرسة الثانية وفوجها الأول (تطبيق في الإنتاج 2026-11-20)
-- مضافة فقط؛ لا حذف ولا تعديل على أي مدرس أو فوج موجود.
INSERT OR IGNORE INTO quran_schools (id,name,description,active,sort_order,created_at)
VALUES ('qs-shuayb','مدرسة شعيب القرآنية','حفظ ومراجعة وتجويد وتربية.',1,2,'2026-11-20T00:00:00.000Z');

INSERT OR IGNORE INTO groups (id,name,school_id,teacher_id,active,created_at)
VALUES ('group-qs-shuayb-1','الفوج الأول','qs-shuayb',NULL,1,'2026-11-20T00:00:00.000Z');
