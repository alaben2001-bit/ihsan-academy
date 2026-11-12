-- 0005_quran_path
-- Additive structure for the Quran school path:
-- memorization plan, daily consolidation (تثبيت), daily portion (ورد),
-- companion recitation (الرفيق), sheikh stations, and makeup (استدراك).
-- This migration only creates tables/indexes; it never alters or deletes data.

CREATE TABLE IF NOT EXISTS quran_paths (
  student_id TEXT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  hifz_plan TEXT NOT NULL DEFAULT 'plan_a' CHECK (hifz_plan IN ('plan_a','plan_b','plan_c')),
  hifz_amount TEXT NOT NULL DEFAULT '',
  hifz_unit TEXT NOT NULL DEFAULT 'سطر',
  hifz_category TEXT NOT NULL DEFAULT '15' CHECK (hifz_category IN ('15','30','45','60')),
  ward_ahzab INTEGER NOT NULL DEFAULT 1 CHECK (ward_ahzab IN (1,2,4)),
  rest_day INTEGER CHECK (rest_day IS NULL OR (rest_day >= 0 AND rest_day <= 6)),
  start_date TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS quran_daily (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('hifz','thabit','ward')),
  amount REAL NOT NULL DEFAULT 0 CHECK (amount >= 0),
  unit TEXT NOT NULL DEFAULT '',
  repetitions INTEGER NOT NULL DEFAULT 0 CHECK (repetitions >= 0 AND repetitions <= 100),
  linked_scope TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quran_daily_unique ON quran_daily(student_id, day, kind);
CREATE INDEX IF NOT EXISTS idx_quran_daily_student_day ON quran_daily(student_id, day);

CREATE TABLE IF NOT EXISTS quran_pairs (
  id TEXT PRIMARY KEY,
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  student_a TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  student_b TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (student_a <> student_b)
);
CREATE INDEX IF NOT EXISTS idx_quran_pairs_a ON quran_pairs(student_a, active);
CREATE INDEX IF NOT EXISTS idx_quran_pairs_b ON quran_pairs(student_b, active);

CREATE TABLE IF NOT EXISTS quran_pair_sessions (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL REFERENCES quran_pairs(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  reciter_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  listener_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount TEXT NOT NULL DEFAULT '',
  errors INTEGER NOT NULL DEFAULT 0 CHECK (errors >= 0 AND errors <= 10000),
  error_positions TEXT NOT NULL DEFAULT '',
  hesitations INTEGER NOT NULL DEFAULT 0 CHECK (hesitations >= 0 AND hesitations <= 10000),
  prompts INTEGER NOT NULL DEFAULT 0 CHECK (prompts >= 0 AND prompts <= 10000),
  minutes REAL NOT NULL DEFAULT 0 CHECK (minutes >= 0 AND minutes <= 1000),
  expected_minutes REAL NOT NULL DEFAULT 0 CHECK (expected_minutes >= 0 AND expected_minutes <= 1000),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  notes TEXT NOT NULL DEFAULT '',
  signed_reciter INTEGER NOT NULL DEFAULT 0 CHECK (signed_reciter IN (0,1)),
  signed_listener INTEGER NOT NULL DEFAULT 0 CHECK (signed_listener IN (0,1)),
  override_reason TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (reciter_id <> listener_id)
);
CREATE INDEX IF NOT EXISTS idx_quran_pair_sessions_pair_day ON quran_pair_sessions(pair_id, day);

CREATE TABLE IF NOT EXISTS quran_stations (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('15','30','45','60')),
  scheduled_for TEXT NOT NULL,
  memorized_amount TEXT NOT NULL DEFAULT '',
  score INTEGER CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  errors INTEGER NOT NULL DEFAULT 0 CHECK (errors >= 0 AND errors <= 10000),
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','approved','rejected','cancelled')),
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_quran_stations_student ON quran_stations(student_id, scheduled_for);

CREATE TABLE IF NOT EXISTS quran_makeups (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('hifz','thabit','ward')),
  due_date TEXT NOT NULL,
  amount TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL CHECK (reason IN ('shortcoming','interruption','incapacity','circumstance')),
  reason_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','planned','done','cancelled')),
  proposed_date TEXT,
  blocks_new INTEGER NOT NULL DEFAULT 0 CHECK (blocks_new IN (0,1)),
  completed_at TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_quran_makeups_student ON quran_makeups(student_id, status, due_date);
