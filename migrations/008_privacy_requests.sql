CREATE INDEX IF NOT EXISTS academy_records_privacy_user_idx
  ON academy_records ((data->>'user_id'))
  WHERE collection = 'privacy_requests';
CREATE INDEX IF NOT EXISTS academy_records_privacy_status_idx
  ON academy_records ((data->>'status'))
  WHERE collection = 'privacy_requests';
INSERT INTO academy_meta(key,data) VALUES ('schema_version','8'::jsonb)
  ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data;
