CREATE INDEX IF NOT EXISTS academy_records_media_bookmark_user_idx
  ON academy_records ((data->>'user_id'))
  WHERE collection = 'media_bookmarks';
CREATE INDEX IF NOT EXISTS academy_records_media_bookmark_media_idx
  ON academy_records ((data->>'media_id'))
  WHERE collection = 'media_bookmarks';
INSERT INTO academy_meta(key,data) VALUES ('schema_version','7'::jsonb)
  ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data;
