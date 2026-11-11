# سجل التغييرات — أكاديمية الإحسان (Cloudflare)

## 2026-11-11 — 6c963e2 (published 20261111-4)

- worldPage (`world`): 6 ranks, garden, daily quests, claim, reading streak.
- cardPage (`card`): bank-style student pass, serial, badges, history, print.
- guidePage (`guide`): daily sentence, 6 steps, live rules table, weights 25/35/30/10, ranks.
- wallet chips in workspace header.
- Ruby Noire theme + card cascade fix (`#ihsan-prayer-dialog` removed from background `:is()`).
- `/api/points/reading` GET/POST (one per student/day, dedupe via event key).
- `quran_reading` rule (5/2, max 1/day) in 0004 + runtime bootstrap.
- Asset version 20261111-4, SW cache v139-20261111-4.
- Default student tab = world.

## 2026-11-07 — d08ea92

- Economy: point_rules, point_events, store_items, store_redemptions (0004).
- Unified tasks, content (hadith/mutoon), competitions.
- points-local-test.mjs (69 checks).
- REBUILD-PLAN-2026-11.md.

## 2026-11-03 — caf1d72

- Asset cache bust (academy update #89).

## 2026-11-02 — origin/main

- Mark main as historical; point to Cloudflare source.

## Notes

- Legacy app (root server/, android-app/) is historical (V65), not the deployed app.
- APK out of scope (decision).
