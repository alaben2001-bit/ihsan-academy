# نموذج إدخال كتالوج المتجر (أكاديمية الإحسان)

> لا تُ invent منتجات/أسعار/مخزون. هذا قالب لإدخال البيانات الحقيقية من المالك/الإدارة.

## الحقول (store_items)

| حقل | نوع | إلزامي | ملاحظات |
|---|---|---|---|
| name | نص (≤160) | نعم | اسم الجائزة |
| description | نص (≤2000) | لا | وصف |
| icon | emoji (≤8) | لا | افتراضي 🎁 |
| image_url | URL (≤500) | لا | صورة (URL فقط، لا رفع) |
| cost | integer 1..100000 | نعم | تكلفة بالنقاط (Coins) |
| stock | integer ≥0 أو null | لا | null = غير محدود |
| max_per_student | integer ≥1 أو null | لا | حد لكل طالب |
| active | 0/1 | لا | افتراضي 1 |
| sort_order | integer | لا | ترتيب |

## JSON مثال (للإدارة)
```json
[
  { "name": "…", "description": "…", "icon": "🎁", "image_url": "https://…/img.png", "cost": 50, "stock": 10, "max_per_student": 1, "active": 1, "sort_order": 0 }
]
```

## معلومات مطلوبة من المالك
- قائمة المنتجات (جوائز مادية/رقمية) + صور (URL).
- التكلفة بالنقاط (Coins) لكل منتج.
- المخزون (كمية) والحد لكل طالب.
- شروط الاستحقاق (مستوى/نقاط/حضور).
- حالة تسليم (physical delivery) vs رقمية (badge/certificate).
- شروط الخدمة/الاستبدال (terms).

## what the system already supports
- create/edit/hide (active), image_url, stock, max_per_student.
- redeem with reserve/refund/fulfill, idempotent request_id.
- admin approvals, decision notes, debit_event_id.
- store balance (Coins) separate from achievement (XP).

## what is NOT implemented (do not fake)
- R2 image upload (URL only).
- shipping/tracking numbers.
- automated digital badge issuance (manual award via points).
- payment gateway (points only).
