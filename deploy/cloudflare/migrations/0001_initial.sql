-- Cloudflare D1 initial schema for the free-plan migration.
-- No production data is imported. Password hashes only; never store plaintext passwords.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS quran_schools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_quran_schools_active_order
  ON quran_schools(active, sort_order);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  identity_normalized TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','director','teacher','supervisor','student')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_users_active_role ON users(active, role);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_expiry ON sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  school_id TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_students_group_active ON students(group_id, active);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- Minimal public portal seed; no accounts or private student records.
INSERT OR IGNORE INTO quran_schools (id, name, description, active, sort_order)
VALUES ('qs-rahman', 'مدرسة مسجد الرحمان القرآنية', 'حفظ ومراجعة وتجويد وتربية.', 1, 1);

-- Flexible records allow staged migration of the existing JSON-shaped domain model.
-- Application code must enforce role and group scope before reading or writing records.
CREATE TABLE IF NOT EXISTS academy_records (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  owner_user_id TEXT,
  group_id TEXT,
  student_id TEXT,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (collection, id)
);
CREATE INDEX IF NOT EXISTS idx_records_collection_updated ON academy_records(collection, updated_at);
CREATE INDEX IF NOT EXISTS idx_records_group ON academy_records(collection, group_id);
CREATE INDEX IF NOT EXISTS idx_records_student ON academy_records(collection, student_id);
