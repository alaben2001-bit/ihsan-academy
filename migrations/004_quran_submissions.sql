CREATE INDEX IF NOT EXISTS academy_records_quran_student_idx
  ON academy_records ((data->>'student_id'))
  WHERE collection = 'quran_submissions';
CREATE INDEX IF NOT EXISTS academy_records_quran_status_idx
  ON academy_records ((data->>'status'))
  WHERE collection = 'quran_submissions';
INSERT INTO academy_meta(key,data) VALUES ('schema_version','4'::jsonb)
  ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data;
