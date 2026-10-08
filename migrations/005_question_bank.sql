CREATE INDEX IF NOT EXISTS academy_records_question_group_idx
  ON academy_records ((data->>'group_id'))
  WHERE collection = 'question_bank';
CREATE INDEX IF NOT EXISTS academy_records_question_active_idx
  ON academy_records ((data->>'active'))
  WHERE collection = 'question_bank';
CREATE INDEX IF NOT EXISTS academy_records_attempt_student_idx
  ON academy_records ((data->>'student_id'))
  WHERE collection = 'question_attempts';
INSERT INTO academy_meta(key,data) VALUES ('schema_version','5'::jsonb)
  ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data;
