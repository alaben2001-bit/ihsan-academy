CREATE INDEX IF NOT EXISTS academy_records_discussion_group_idx
  ON academy_records ((data->>'group_id'))
  WHERE collection = 'discussions';
CREATE INDEX IF NOT EXISTS academy_records_reply_discussion_idx
  ON academy_records ((data->>'discussion_id'))
  WHERE collection = 'discussion_replies';
INSERT INTO academy_meta(key,data) VALUES ('schema_version','6'::jsonb)
  ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data;
