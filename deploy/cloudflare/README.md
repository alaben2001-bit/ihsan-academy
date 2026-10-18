# Cloudflare migration (student platform)

This deployment is intentionally separate from the existing Render service and the existing Pages school site.

## Target architecture

- Cloudflare Worker routes HTTP requests to a Cloudflare Container running the existing Node.js app.
- The container listens on port 3000 and uses a **new, empty PostgreSQL database**.
- Do not point this deployment at the Render production database.
- Keep Render available until the Cloudflare test checklist passes.

## Current blockers before production deployment

1. A new PostgreSQL endpoint must be provisioned. Cloudflare Containers do not provide a PostgreSQL database automatically. The app currently requires `DATABASE_URL` when `ACADEMY_STORAGE=postgres`.
2. The container needs that secret injected as `DATABASE_URL`, plus the bootstrap administrator values. Never commit secrets to this repository.
3. The existing app stores sessions and rate-limit state in process memory. This is acceptable for a first single-container smoke test but needs review for restarts/scaling.
4. Container usage and the database provider may incur charges. Verify account eligibility and estimate costs before enabling public use.

## Deploy steps

1. Install current Node.js LTS and Docker locally.
2. From repository root, install dependencies and run `npm test`.
3. Create a new PostgreSQL database with a provider of your choice. Keep it empty. Use TLS and a least-privilege database user.
4. Set container environment secrets in the Cloudflare deployment configuration supported by your account; do not place credentials in `wrangler.jsonc`.
5. Deploy the Worker/container to a **new Worker name** (not the Pages project `ihsan-quran-school-live`).
6. Verify `/api/health`, administrator bootstrap, login/logout, role-scoped API responses, create/edit/delete flows, and persistence after a container restart.
7. Only then consider changing the canonical link. Render is the rollback option until the new platform has been accepted.

## Important

The Dockerfile at repository root runs tests during image build. The container entrypoint is `node server/server.js`. The app already selects PostgreSQL through `ACADEMY_STORAGE=postgres` and `DATABASE_URL`; no student data import is planned.
