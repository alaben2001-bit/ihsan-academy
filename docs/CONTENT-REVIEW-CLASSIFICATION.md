# مراجعة المحتوى الشرعي — تصنيف (أكاديمية الإحسان)

## 1) الأدعية والأذكار (seeded, pending_review)
- 5 أدعية + 4 أذكار (DUAS_SEED)، status=pending_review (لا تُنشر تلقائيًا).
- attribution=verbatim (نص حرفي) → requires source+reference (enforced by API).
- grade field present (صحيح/حسن/ضعيف) but needs human verification of citations.

## 2) الأحاديث (content kind=hadith)
- publish requires source+reference (enforced).
- attribution types: verbatim/light_edit/summary/academy/multi_source.

## 3) المحتوى التعليمي/المنهاج
- content kinds: hadith, mutoon, duas, adhkar.
- statuses: draft → needs_source → pending_review → approved → published → archived.

## 4) تصنيف (للمراجعة)
| بند | التصنيف | إجراء |
|---|---|---|
| أدعية/أذكار seeded | needs review (pending_review) | تحقق تخرّيج + grade + attribution |
| أحاديث (admin-created) | depends on source | نشر فقط بعد source+reference |
| متوون | as above | — |
| مناهج/خطط | proposal (Thabit 2.5/5/7.5 pending Sheikh) | اعتماد Sheikh |

## 5) قواعد
- لا تنشر محتوى غير مراجع.
- لا تنسب حديثًا دون تحقق.
- لا تنشئ أدعية/أذكار وتنسبها إلى السنة.
- seeded duas/adhkar: pending_review (never auto-published).

## 6) deliverable
- قائمة للمراجعة/الاعتماد من Sheikh (docs/DUAS-AND-ADHKAR-DRAFT.md موجود).
- تحقق كل citation (reference + grade) قبل published.
- owner decides publish (admin endpoint PATCH status).
