CREATE TABLE IF NOT EXISTS academy_backup_manifests (
  id BIGSERIAL PRIMARY KEY,
  backup_name TEXT NOT NULL,
  storage_kind TEXT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS academy_backup_manifests_created_idx
  ON academy_backup_manifests(created_at DESC);
CREATE TABLE IF NOT EXISTS academy_health_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  healthy BOOLEAN NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS academy_health_events_created_idx
  ON academy_health_events(created_at DESC);
INSERT INTO academy_meta(key,data) VALUES ('schema_version','9'::jsonb)
  ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data;
