# Ihsan Academy — Cloudflare Workers + D1 (free-plan migration)

This is an isolated migration workspace for the student platform. It does not modify the existing Render deployment or either existing Pages website.

## Cost target

Use Workers Free and D1 Free only. Do not enable Workers Paid or Containers. If a service asks for billing or an upgrade, stop rather than continuing.

## Current implementation status

- Static-asset preparation uses an explicit allowlist. It does not publish server source, migrations, or data files.
- A D1 initial schema and health check are included.
- The public Quran-school list endpoint is included.
- **The full student platform is not ported yet.** Any other `/api/*` route deliberately returns HTTP 501 rather than pretending it works. Login, role-scoped records, attendance, tests, assignments, uploads, and the remaining app APIs must be ported and tested before this preview can replace Render.
- No D1 database ID, administrator credentials, or secrets are embedded in source.
- The previous Container configuration has been removed from this branch; Containers require a paid plan for this account.

## Prepare and validate locally

From this directory, with Node.js installed:

```sh
npm install
npm run check
npm run prepare:assets
```

## D1 setup and deploy

1. Create a D1 database named `ihsan-academy-students` from the Cloudflare dashboard or with Wrangler. This is a new empty database; no old student records are imported.
2. Replace `REPLACE_WITH_CREATED_D1_DATABASE_ID` in `wrangler.jsonc` with the real database ID.
3. Apply schema: `npx wrangler d1 migrations apply ihsan-academy-students --remote`.
4. Add seed content through a reviewed migration (no default administrator password is included).
5. Run `npm run deploy` and test `/api/health`.

Do not change the Render URL or shut down Render until all APIs used by the current frontend are implemented and the acceptance checklist passes.

## Free-plan guardrails

- Worker daily request/CPU limits apply.
- D1 read/write limits and database-size limits apply.
- Uploaded student audio and other media need a separately designed storage solution; do not store large files as D1 rows.
- Set budget/usage alerts where available, and never switch to a paid plan automatically.
