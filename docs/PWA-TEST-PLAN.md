# PWA — خطة اختبار (أكاديمية الإحسان)

## الحالة
- manifest.json + service-worker.js (v148, cache shell incl. /qr.js).
- لا اختبار على أجهزة حقيقية (معلق).

## فحوصات (للاختبار)
1. manifest: name, short_name, icons (PNG), start_url, display=standalone, theme_color.
2. SW: install, activate, fetch (cache-first for shell, network for API).
3. تثبيت (Android Chrome, iOS Safari).
4. تحديث: bump cache version → clients update.
5. offline: قراءة فقط (pages cached). Points/redeem/store require network (reject offline).
6. تخزين: safeStore (localStorage) — no sensitive data in SW cache.
7. 404/redirects (site/_redirects no SPA fallback; hash routes).

## ما يجب التحقق منه على جهاز
- Android: install prompt, offline read, no points offline.
- iPhone: Add to Home Screen, standalone mode, offline.
- Weak device: performance, reduced motion.

## لا تدّع نجاحاً دون اختبار فعلي.
