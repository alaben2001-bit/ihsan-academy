CREATE TABLE IF NOT EXISTS academy_security_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  ip INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS academy_security_events_created_idx ON academy_security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS academy_security_events_actor_idx ON academy_security_events(actor_id);
