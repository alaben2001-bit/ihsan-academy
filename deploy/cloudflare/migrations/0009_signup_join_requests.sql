-- V72: فتح التسجيل للجميع + طلبات الانضمام المعتمدة.
-- أكاديمية الإحسان منصة داخلية: التسجيل المفتوح ينشئ حساب «زائر/محسن» أو طلب انضمام،
-- ولا تمنح أي صلاحيات إشرافية أو إدارية عند التسجيل إطلاقًا.
-- 1) توسيع دور users ليشمل 'visitor' مع الحفاظ على كل الأعمدة والبيانات.
-- 2) جدول join_requests: مسار طالب (school_join) أو شيخ/معلم (teacher_request)،
--    يبدأ دائمًا «pending» ولا يُقبل إلا باعتماد مسؤول مخوّل (admin / director ضمن النطاق / teacher ضمن فوج يدرّسه).
-- ملاحظة أمان حرجة: إعادة بناء users بـ DROP + RENAME تُطلق أفعال ON DELETE CASCADE/SET NULL
-- على students/sessions/audit_log/google_identities. لذلك نحتفظ بنسخ احتياطية داخلية أولًا
-- في جداول عادية بلا FK، ونعيد الروابط والجلسات بعد إعادة البناء، ثم نحذف النسخ.

PRAGMA defer_foreign_keys = ON;

-- 1) نسخ احتياطية داخلية قبل أي تغيير (تُزال في نهاية الترحيل)
DROP TABLE IF EXISTS _backup_users_0009;
DROP TABLE IF EXISTS _backup_students_0009;
DROP TABLE IF EXISTS _backup_sessions_0009;
DROP TABLE IF EXISTS _backup_audit_0009;
DROP TABLE IF EXISTS _backup_google_identities_0009;
CREATE TABLE _backup_users_0009 AS SELECT * FROM users;
CREATE TABLE _backup_students_0009 AS SELECT id, user_id FROM students;
CREATE TABLE _backup_sessions_0009 AS SELECT * FROM sessions;
CREATE TABLE _backup_audit_0009 AS SELECT id, user_id FROM audit_log;
CREATE TABLE _backup_google_identities_0009 AS SELECT * FROM google_identities;

-- 2) إعادة بناء users بدور visitor (نفس أعمدة users + visitor في CHECK)
CREATE TABLE IF NOT EXISTS users__v72 (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  identity_normalized TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','director','teacher','supervisor','student','visitor')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1))
);

INSERT INTO users__v72 (id, display_name, identity_normalized, password_hash, role, active, created_at, must_change_password)
SELECT id, display_name, identity_normalized, password_hash, role, active, created_at, must_change_password
FROM users;

DROP TABLE users;
ALTER TABLE users__v72 RENAME TO users;

CREATE INDEX IF NOT EXISTS idx_users_active_role ON users(active, role);
CREATE INDEX IF NOT EXISTS idx_users_password_change ON users(must_change_password, active);

CREATE TABLE IF NOT EXISTS join_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('school_join','teacher_request')),
  school_id TEXT REFERENCES quran_schools(id) ON DELETE SET NULL,
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  requested_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  decided_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  decided_at TEXT,
  decision_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON join_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_join_requests_user ON join_requests(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_join_requests_school ON join_requests(school_id, status);

-- 3) استعادة كل ما كان مرتبطًا بالحسابات (user_id محفوظة كما كانت)
UPDATE students SET user_id = (SELECT user_id FROM _backup_students_0009 WHERE _backup_students_0009.id = students.id)
WHERE EXISTS (SELECT 1 FROM _backup_students_0009 WHERE _backup_students_0009.id = students.id);
INSERT OR IGNORE INTO sessions SELECT * FROM _backup_sessions_0009;
UPDATE audit_log SET user_id = (SELECT user_id FROM _backup_audit_0009 WHERE _backup_audit_0009.id = audit_log.id)
WHERE EXISTS (SELECT 1 FROM _backup_audit_0009 WHERE _backup_audit_0009.id = audit_log.id);
INSERT OR IGNORE INTO google_identities SELECT * FROM _backup_google_identities_0009;

-- 4) إزالة النسخ الاحتياطية الداخلية (المعطيات الأساسية عادت بالكامل)
DROP TABLE _backup_users_0009;
DROP TABLE _backup_students_0009;
DROP TABLE _backup_sessions_0009;
DROP TABLE _backup_audit_0009;
DROP TABLE _backup_google_identities_0009;

PRAGMA defer_foreign_keys = OFF;
