# Production Security — V41

- HTTPS: production startup refuses to run when `ACADEMY_REQUIRE_HTTPS=1` without certificate/key.
- Sessions: server-side random session tokens; HttpOnly/SameSite cookies; expiry and cleanup.
- CSRF: cookie-authenticated state-changing requests require `X-CSRF-Token` matching the non-HttpOnly CSRF cookie.
- Rate limiting: IP-based global limiter plus login-failure throttling.
- Security headers: CSP, HSTS on TLS, frame denial, nosniff, referrer and permissions policies.
- PostgreSQL: optional `pg` adapter, JSONB record store, migration scripts, schema migrations and health check.
- Privacy: `PRIVACY_POLICY_AR.md` and `GET /api/privacy`.

## Production deployment
1. Install dependencies with `npm install`.
2. Provision PostgreSQL and set `DATABASE_URL`.
3. Run `npm run migrate:postgres`.
4. Put valid TLS certificate/key paths in `.env.production`.
5. Set `NODE_ENV=production`, `ACADEMY_REQUIRE_HTTPS=1`, `ACADEMY_COOKIE_SECURE=1`.
6. Run `npm test` before exposing the service.

The repository does not claim a live public deployment until these environment-specific steps are performed on the target server.
