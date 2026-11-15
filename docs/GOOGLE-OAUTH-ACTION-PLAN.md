# Google OAuth — خطة إجراء (أكاديمية الإحسان)

## الحالة الحالية
- `/api/auth/google/config` → `{enabled:false, client_id:null}` (production + local).
- الكود (src/index.js) يتحقق من JWT RS256 via Google JWKS (issuer/audience/nonce/exp/iat/email_verified).
- `GOOGLE_CLIENT_ID` اختياري (env var). `GOOGLE_CLIENT_SECRET` غير مستخدم (JWT-based، لا server-side flow).

## ما يجب على المالك فعله (Google Cloud Console)
1. إنشاء مشروع (أو استخدام موجود) → APIs & Services → Credentials.
2. Create OAuth 2.0 Client ID (Web application).
3. Authorized JavaScript origins:
   - `https://a-ihsan.pages.dev`
   - `http://127.0.0.1:8788` (للتطوير)
4. Authorized redirect URIs:
   - `https://a-ihsan.pages.dev/`
   - `http://127.0.0.1:8788/`
5. نسخ Client ID (形如 `….apps.googleusercontent.com`).

## ما يجب على المالك فعله (Cloudflare)
1. Cloudflare Dashboard → Pages/Worker → Settings → Environment variables.
2. إضافة `GOOGLE_CLIENT_ID` = Client ID (Production + Preview).
3. (اختياري) `GOOGLE_CLIENT_SECRET` غير مطلوب (JWT flow). لا تضعه في الكود.
4. إعادة نشر (أو انتظار propagation).

## تحقق بعد التفعيل
- `/api/auth/google/config` → `{enabled:true, client_id:"….apps.googleusercontent.com"}`.
- زر Google يظهر في شاشة الدخول.
- `/api/auth/google/link` يربط هوية Google بحساب موجود (يتطلب تسجيل دخول أولاً).
- لا سر في bundle (app.js يحتوي client_id فقط).

## ملاحظات أمنية
- لا تضع Client Secret في frontend/Git.
- لا تغيّر بيانات اعتماد الإنتاج دون موافقة.
- التحقق من `email_verified=true` إلزامي (موجود في الكود).
