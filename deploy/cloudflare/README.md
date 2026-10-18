# Ihsan Academy — Cloudflare Pages + D1

This is the Cloudflare-only student platform. It uses Pages Functions and D1; it does not require Workers Paid or Containers.

## Current daily-use scope

- Arabic, mobile-friendly interface.
- One-time first administrator setup, gated by the private BOOTSTRAP_SECRET Pages environment secret.
- Login sessions stored as token hashes; passwords use PBKDF2-SHA-256.
- Login throttling after repeated failures.
- Admin: create teachers, groups, and students; assign teachers to groups; disable students/groups.
- Teacher: see only assigned groups, add students to assigned groups, record attendance, and log Quran memorization/review.
- Student: see their own attendance and Quran progress.
- D1 stores accounts, groups, student records, attendance, Quran progress, and audit events.
- No old accounts or student records have been imported.

## Important limitations

This is a simplified rebuild, not a feature-for-feature port of the old app. The old posts/media library, messages, assignments, grading, tests, uploads, transport, and advanced curriculum tools are intentionally not included. Do not promise these features to users until separately implemented and tested.

## Deploy and validate

The Pages project is ihsan-academy-students-preview, connected to the migration/cloudflare-student-platform branch. Its D1 binding is DB and points to the database ihsan-academy-students in the EU.

    npm install
    npm run check
    npm run prepare:assets
    npx wrangler deploy --dry-run

The 0001_initial.sql migration creates the initial tables; 0002_daily_use.sql adds teacher ownership to groups. The currently connected D1 database was updated directly to add the teacher_id column and index.

## First administrator setup

1. Set a private BOOTSTRAP_SECRET as a Pages production environment secret.
2. Open the production Pages URL. The setup screen appears only when there is no active administrator and the secret is configured.
3. Enter the setup secret and create the administrator using an email and a unique password of at least 14 characters.
4. Immediately remove the BOOTSTRAP_SECRET environment variable after the administrator is created, then redeploy. This closes the setup route.
5. Verify login, create a teacher and group, create a student, record attendance, and record Quran progress before sharing access.

## Cost guardrails

Use Cloudflare free services only. Do not enable Workers Paid or Containers. D1 and Pages/Functions have free-plan limits. Keep a separate backup of essential records and review Cloudflare usage periodically.
