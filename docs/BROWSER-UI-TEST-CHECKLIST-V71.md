# اختبار واجهة V71 — بطاقات الطلاب / مهام / طباعة / مسح QR

> ملاحظة: أداة المتصفح غير متصلة في هذه الجلسة. هذه خطوات اختبار يدوية (أو لأداة browser عند توفرها). **لا تُعدّ ناجحة حتى تُنفّذ فعليًا.**

## 1) بطاقات الطلاب (staff)
- سجّل دخول كمدير/معلم → تبويب «بطاقات الطلاب».
- افتح `staffCardsPage`: اختيار فوج، bulk create.
- **متوقع**: 3 رموز QR (add_points, profile, login) لكل طالب، SVG (IhsanQR).
- **اختبار**: reissue (login) → الرمز القديم 404، الجديد 200. revoke (profile, reason≥3) → profile 404، login/add_points سليم. bulk print → `body[data-print="cards"]`، 2 بطاقات/صف.

## 2) عالم المهام (طالب)
- سجّل دخول كطالب → «عالمي».
- **متوقع**: 5 معالم story (🌱..✨) مع meter، 4 مهام جانبية، 4 collectibles.
- سجّل ورد قراءة → mission `side-reading` becomes claimable → استلم → achievement increases (5). إعادة استلام → 409.
- **اختبار**: claim mission غير مكتمل → 409؛ unknown mission → 400.

## 3) مسح QR ورسالة التنبيه
- افتح رابط `#scan=login.<cardId>.<secret>` بدون جلسة.
- **متوقع**: صفحة auth مع `.scan-notice` («بطاقة … — أدخل كلمة المرور») + username معبأ (ihsan_last_identity).
- **اختبار**: profile/add_points بدون جلسة → 401؛ مع جلسة خارج الفوج → 403.

## 4) متجر الصور
- admin: إضافة مادة مع image_url → تظهر `.store-item-image`؛ بدون → fallback icon.
- **اختبار**: URL غير صالح (length>500) → 400.

## 5) صلاحيات
- طالب: لا bulk print (403)، لا missions staff (403).
- معلم خارج الفوج: profile/add_points 403.
- **اختبار**: admin sees full (default) tools.

## 6) PWA/offline (جهاز حقيقي)
- تثبيت، تحديث SW v148.
- offline: قراءة فقط (لا redeem/points without network).
- **ملاحظة**: لم يُختبر على جهاز.

## 7) what couldn't be tested here
- Browser tool disconnected (no desktop session).
- All UI claims are pending real browser verification.
