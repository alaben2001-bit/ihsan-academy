# حزمة مراجعة Copilot — مستقلة (لا تعديل ملفات بالتزامن)

## ما تغير (HEAD 6c963e2)

### Commit d08ea92 — "Add learning economy, unified tasks, content, and competitions"
- deploy/cloudflare/migrations/0004_learning_economy.sql (+106)
- deploy/cloudflare/scripts/points-local-test.mjs (+326)
- deploy/cloudflare/scripts/security-check.mjs (+8)
- deploy/cloudflare/site/app.js (+232)
- deploy/cloudflare/src/index.js (+608)
- docs/REBUILD-PLAN-2026-11.md (+213)
- package.json (cf) (+3)

### Commit 6c963e2 — "Add student world, bank-style pass, journey guide, and daily reading"
- 0004_learning_economy.sql (+3)
- about.html, index.html, privacy.html (+6/+10/+6)
- app.js (+152)
- service-worker.js (+4)
- style.css (+351)
- src/index.js (+126)
- REBUILD-PLAN (+14)

## قرارات معمارية (للنقاش)

1. **Economy source of truth:** `point_events` (unique (kind,event_key)). Balance derived from sum of events. `store_redemptions` references `debit_event_id`. Reversal = new event + reversed_at, never delete.
2. **No new tables for world/card/guide/reading** — all on `academy_records` collections + `point_rules`/`point_events`.
3. **Reading:** one entry per student/day (`reading_log` collection), event key `reading:<student>:<day>`, rule `quran_reading` (5/2, max 1/day).
4. **World ranks:** 6 stages by achievement points (0/80/250/600/1200/2400). Motivational indicator only.
5. **Leaderboard weights:** 25/35/30/10 (attendance/Quran/tests/assignments).
6. **Runtime schema bootstrap** idempotent (ensureLearningSchema) instead of requiring D1 CLI auth.
7. **Ruby Noire** theme: removed `#ihsan-prayer-dialog` from background `:is()` lists to fix ID-specificity cascade.

## أسئلة للمراجع المستقل

1. Is the idempotency key scheme `(kind, event_key)` sufficient under concurrent requests? (UNIQUE index exists.)
2. Does `ensureLearningSchema` partial failure leave `learningSchemaReady=null` correctly? (yes, .catch resets)
3. Is `awardPointsForEvent` transactional enough if env.DB.prepare fails mid-loop? (check)
4. Can a student tamper `student_id` in `/api/points/reading`? (resolvePointStudent should scope to user.student_id)
5. Does the leaderboard weight sum (25+35+30+10=100) match code?
6. Is the SW cache deletion safe for users with offline data? (no IndexedDB/local data used for writes → safe)
7. Cross-role: are `/api/points/award` and `/api/points/rules` (POST) admin-gated? (verify)
8. Potential XSS in app.js string concatenation of user content (esc() usage)?
9. Race condition in daily challenge claim?
10. Does card serial `IHSN-1MS-43CO` leak student id? (it's derived, check reversibility)

## ما لم يُختبر (أعترف)

- Cross-role access matrix (no automated tests).
- Concurrency (no load test).
- Offline/PWA.
- Backup restore.
- Production D1.
- Content (religious) review.
- Google OAuth.

## ملفات للمراجعة (أولوية)

1. deploy/cloudflare/src/index.js (economy endpoints, auth, permissions)
2. deploy/cloudflare/site/app.js (world/card/guide, wallet, nav)
3. deploy/cloudflare/site/style.css (theme cascade)
4. deploy/cloudflare/migrations/0004_learning_economy.sql
5. deploy/cloudflare/scripts/points-local-test.mjs (test coverage gaps)
6. deploy/cloudflare/scripts/security-check.mjs

## ملاحظة

Copilot claimed work (feature map, mock D1 tests, personal reports, group posts, paths, review tasks, private messages, README) is NOT present in the repository. Treat as unverified. Do not credit.
