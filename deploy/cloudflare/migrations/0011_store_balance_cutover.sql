-- Adds metadata tables for a forward-only store-balance cutover.
-- This migration does not snapshot balances or modify point_events.
-- The separate snapshot SQL must be run only after backup and explicit approval.

CREATE TABLE IF NOT EXISTS point_balance_cutovers (
  id INTEGER PRIMARY KEY CHECK(id=1),
  active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),
  completed_at TEXT,
  snapshot_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS student_store_opening_balances (
  student_id TEXT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  opening_balance INTEGER NOT NULL DEFAULT 0,
  as_of TEXT NOT NULL,
  snapshot_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
