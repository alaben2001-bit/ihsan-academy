-- 0008_rate_limits.sql
-- Additive server-side rate limiting for card scans, mission claims and store
-- redemptions. No existing table is altered or deleted.
-- The worker also creates this table lazily (idempotent) so a missing migration
-- never blocks real work; the table simply starts enforcing after deploy.

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT NOT NULL,
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (bucket, key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
