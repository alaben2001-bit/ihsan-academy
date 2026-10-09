-- Core storage tables for the JSON-shaped academy database.
-- Safe to apply to an empty or existing database: no existing rows are dropped.
CREATE TABLE IF NOT EXISTS academy_meta (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS academy_records (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  data JSONB NOT NULL,
  PRIMARY KEY (collection, id)
);

CREATE INDEX IF NOT EXISTS academy_records_collection_idx
  ON academy_records (collection);
