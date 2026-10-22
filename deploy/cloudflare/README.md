# Ihsan Academy — Cloudflare Pages + D1

The active Cloudflare build is a lightweight Arabic RTL Progressive Web App backed by Pages Functions and D1. It is a separate Cloudflare deployment, not an automatic continuation of the historical database.

## Implemented in the current code

- RTL Arabic interface, mobile layouts, installable PWA shell, random-per-session palettes, and a fixed-palette option.
- One-time administrator bootstrap protected by the `BOOTSTRAP_SECRET` Pages secret.
- Password login with PBKDF2-SHA-256 hashes, hashed session tokens, login throttling, and role/group scope checks in API handlers.
- The public health endpoint reports service availability only; it does not reveal account totals.
- Student/group records, account creation and reset, attendance, and Quran memorization/revision records.
- Quran plans and progress, curriculum/subjects and student curriculum progress, multiple-choice tests, submitted test attempts/results, and recurring test records.
- Text-based posts and notifications, daily challenge claims, leaderboard/metrics, admin audit view, and manual D1 backup export/restore endpoints.
- Assignment workflow: authorized staff create assignments, students submit written responses, and authorized teachers/staff review submissions with a grade and feedback.
- Group-scoped learning gradebook with per-student attendance summary, Quran follow-up averages, test accuracy, assignment review status, and CSV export for authorized staff; students see only their own summary.
- Private text messaging with role/group-scoped recipient lists, participant-only inbox visibility, and recipient read receipts. Thread views, attachments, and push/email delivery are not included yet.
- Unique, randomly generated temporary passwords for newly issued/reset student accounts; affected accounts must change the password before using protected platform functions. Credentials from bulk onboarding are returned once for the authorized admin to download and deliver securely.
- D1 stores active accounts, group/student records, education records, and audit events.

## Known gaps and launch cautions

This rebuild does **not** yet provide feature parity with the old application. The following remain absent or require a full acceptance test before they should be presented as complete:

- Weighted grade calculation across assessments, trend charts/history snapshots, transport management, file/media uploads, and an integrated media library backed by object storage.
- Private messaging is currently one-to-one text, without attachments, search, push/email delivery, or threaded conversation views. Assignments need interactive tests across student/teacher/director/supervisor roles before broad use.
- A complete end-to-end test suite for every role and school/group boundary. The current `npm run check` is primarily syntax/build validation, not proof that all business flows work.
- Automated scheduled/off-site backups and a verified restore drill. Admin export/restore endpoints are manual safety tools, not a backup schedule.
- Final end-to-end verification of all Quran pathways, weekly goals, two-week assessments, progress calculations, and student-facing daily guidance.
- Import of historical accounts and records from the previous system. Existing D1 records do not prove that historical records have been imported.

### Temporary-account warning

The bulk onboarding action targets a fixed list of full-name student records. It can create missing accounts **and reset passwords for already-linked accounts in that target list**. Review the admin confirmation, download the one-time CSV immediately, keep it private, deliver each student's credentials privately, and remove extra copies after delivery. Do not use one shared password for multiple students.

At the latest database check on 2026-10-20, D1 contained 64 active student profiles, 40 linked to active student-role accounts, plus 1 active administrator and 1 active teacher account. All 40 active student-role accounts currently have `must_change_password=1`, so each is expected to choose a personal password at sign-in. This is a count only; it does not prove that each CSV credential was delivered or that each student has successfully signed in. Recheck the roster and linked-account counts before changing accounts again. Do not rerun bulk onboarding merely to refresh credentials, because it resets all target passwords.

## Deploy and validate

Cloudflare Pages project: `ihsan-academy-students-preview`  
Connected production branch: `migration/cloudflare-student-platform`  
Build command: `npm install && npm run prepare:assets`  
Build output directory: `public`

The build checks JavaScript syntax, runs the static security-regression guardrails in `scripts/security-check.mjs`, and prepares assets; these guardrails do not replace interactive acceptance tests. Database schema changes are versioned under `migrations/`; apply each migration to the correct D1 database before deploying code that depends on it. Migration `0003_temporary_student_passwords.sql` adds the first-login password-change flag.

## First administrator setup

1. Configure `BOOTSTRAP_SECRET` as a private Cloudflare Pages environment secret.
2. Open the Pages URL. The setup screen appears only when there is no active administrator and the secret is configured.
3. Create the administrator with a unique password of at least 14 characters.
4. Remove `BOOTSTRAP_SECRET` from the production environment and redeploy after successful setup.
5. Test one admin, one teacher, and one student account; verify assigned-group boundaries, password change, attendance, Quran progress, tests, and backup export before inviting a larger cohort.

Never put passwords, session tokens, database credentials, or private bootstrap secrets in source control or issue reports.

## Cost and data-retention guardrails

Stay on Cloudflare's free services for now; do not enable paid Workers or Containers without a deliberate cost review. D1 and Pages have usage limits. Keep a separate, protected export of essential data and validate a restore before any hosting migration or deletion of the old source. Keep the GitHub repository as the code source of truth.
