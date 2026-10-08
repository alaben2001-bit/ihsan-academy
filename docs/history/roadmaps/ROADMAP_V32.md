# Roadmap V32

الهدف التالي هو استكمال فصل التطبيق إلى:

`API → Services/Permissions → Repositories → Storage Adapter → SQLite/D1`

تم في V32 فصل النواة الأولى (users/groups/students/memberships) وربط عمليات المصادقة وبعض القراءة والإدارة بها.

الخطوة التالية: نقل العمليات الكتابية والقرائية للأفواج والطلاب ثم الحضور والاختبارات إلى Services/Repositories مع اختبارات تكافؤ بين JSON وSQLite.
