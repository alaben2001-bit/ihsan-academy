-- أكاديمية الإحسان — V31 normalized core schema
-- Shadow/production-target schema. V31 does NOT cut the server over yet.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS core_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','teacher','student','parent')),
  extra_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS core_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT '',
  schedule TEXT NOT NULL DEFAULT '',
  extra_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS core_students (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES core_users(id) ON DELETE SET NULL,
  parent_id TEXT REFERENCES core_users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  group_id TEXT REFERENCES core_groups(id) ON DELETE SET NULL,
  level TEXT NOT NULL DEFAULT '',
  attendance_rate REAL,
  progress REAL,
  memorized TEXT NOT NULL DEFAULT '',
  review REAL,
  extra_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS core_memberships (
  student_id TEXT NOT NULL REFERENCES core_students(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES core_groups(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES core_users(id) ON DELETE SET NULL,
  PRIMARY KEY(student_id, group_id)
);
CREATE TABLE IF NOT EXISTS core_teacher_groups (
  teacher_id TEXT NOT NULL REFERENCES core_users(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES core_groups(id) ON DELETE CASCADE,
  PRIMARY KEY(teacher_id, group_id)
);
CREATE TABLE IF NOT EXISTS core_attendance (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES core_students(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('present','late','absent','excused')),
  note TEXT NOT NULL DEFAULT '',
  term_id TEXT,
  recorded_by TEXT REFERENCES core_users(id) ON DELETE SET NULL,
  updated_at TEXT,
  extra_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(student_id, date)
);
CREATE INDEX IF NOT EXISTS idx_core_attendance_student_date ON core_attendance(student_id,date);
CREATE INDEX IF NOT EXISTS idx_core_attendance_date ON core_attendance(date);

CREATE TABLE IF NOT EXISTS core_quran_levels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  extra_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS core_quran_halaqas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  teacher_id TEXT REFERENCES core_users(id) ON DELETE SET NULL,
  level_id TEXT REFERENCES core_quran_levels(id) ON DELETE SET NULL,
  extra_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS core_quran_plans (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES core_students(id) ON DELETE CASCADE,
  halaqa_id TEXT REFERENCES core_quran_halaqas(id) ON DELETE SET NULL,
  extra_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS core_quran_reviews (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES core_students(id) ON DELETE CASCADE,
  date TEXT,
  extra_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS core_quran_attendance (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES core_students(id) ON DELETE CASCADE,
  halaqa_id TEXT REFERENCES core_quran_halaqas(id) ON DELETE SET NULL,
  date TEXT,
  status TEXT,
  extra_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS core_quran_evaluations (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES core_students(id) ON DELETE CASCADE,
  teacher_id TEXT REFERENCES core_users(id) ON DELETE SET NULL,
  date TEXT,
  reading REAL,
  tajweed REAL,
  memorization REAL,
  adab REAL,
  overall REAL,
  notes TEXT NOT NULL DEFAULT '',
  extra_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS core_quran_certificates (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES core_students(id) ON DELETE CASCADE,
  level_id TEXT REFERENCES core_quran_levels(id) ON DELETE SET NULL,
  extra_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_quran_eval_student_date ON core_quran_evaluations(student_id,date);
CREATE INDEX IF NOT EXISTS idx_quran_review_student_date ON core_quran_reviews(student_id,date);
CREATE INDEX IF NOT EXISTS idx_quran_att_student_date ON core_quran_attendance(student_id,date);
