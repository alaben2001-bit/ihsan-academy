# إعداد Google OAuth — خطوات (يحتاج تدخلك)

## حالة الكود
- `/api/auth/google/config` → `{enabled:false, client_id:null}` (production + local without env).
- `/api/auth/google/link` exists (links Google identity to a user account).
- Verification: JWT RS256 via Google JWKS, issuer/audience checks, `GOOGLE_CLIENT_ID`.

## المتغيرات المطلوبة (Cloudflare Pages → Settings → Environment variables)
- `GOOGLE_CLIENT_ID` = `<your>.apps.googleusercontent.com`
- `GOOGLE_CLIENT_SECRET` = (إن استُخدم server-side flow; التحقق الحالي JWT-based قد لا يحتاجه — verify code)

## خطوات Google Cloud Console
1. Create project → APIs & Services → Credentials.
2. Create OAuth 2.0 Client ID (Web application).
3. Authorized JavaScript origins: `https://a-ihsan.pages.dev`
4. Authorized redirect URIs: `https://a-ihsan.pages.dev/` (and localhost for dev).
5. Copy Client ID → set as `GOOGLE_CLIENT_ID` in Cloudflare.
6. Redeploy (or wait for env to propagate).

## اختبار
- Open site → login screen → Google button should appear (client_id not null).
- Link Google account to an existing user → `/api/auth/google/link`.
- Verify no secret in client bundle (check app.js for client_id only, no secret).

## مخاطر
- لا تضع Client Secret في app.js (client-side). التحقق actual uses JWT; confirm whether secret is needed.
- قم بمراجعة `src/index.js` google verification block before enabling.

## قرار مطلوب
- هل نُفعّل OAuth أم نكتفي بتسجيل الدخول بكلمة مرور؟ (الكود جاهز إما way)
