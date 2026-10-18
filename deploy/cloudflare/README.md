# Ihsan Academy — Cloudflare Workers + D1 (free-plan migration)

This is an isolated migration workspace for the student platform. It does not modify the existing Render deployment or either existing Pages website.

## Cost target

Use Workers Free and D1 Free only. Do not enable Workers Paid or Containers. If a service asks for billing or an upgrade, stop rather than continuing.

## Current implementation status

- Static-asset preparation uses an explicit allowlist. It does not publish server source, migrations, or data files.
- A real D1 database named `ihsan-academy-students` has been created in the EU jurisdiction (region EEUR), and the initial tables have been applied. Its ID is configured in `wrangler.jsonc`.
- The database currently contains the public Quran-school seed only; the `users` table has zero accounts. No administrator credentials or student records exist yet.
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

1. The D1 database is already created and its initial schema has been applied directly through the Cloudflare API. The migration file is committed for repeatable setup on a fresh database.
2. Install dependencies, then run `npm run check` and `npm run prepare:assets`.
3. Apply the committed migration to verify repeatability: `npx wrangler d1 migrations apply ihsan-academy-students --remote`.
4. Wait for the GitHub Actions dry-run validation before attempting deployment.
5. A deployment is not considered complete until the Worker is deployed and `/api/health` passes.

Do not change the Render URL or shut down Render until all APIs used by the current frontend are implemented and the acceptance checklist passes.

## Free-plan guardrails

- Worker daily request/CPU limits apply.
- D1 read/write limits and database-size limits apply.
- Uploaded student audio and other media need a separately designed storage solution; do not store large files as D1 rows.
- Set budget/usage alerts where available, and never switch to a paid plan automatically.
