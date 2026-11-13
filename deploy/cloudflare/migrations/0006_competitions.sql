-- 0006_competitions
-- Additive structure for the academy competitions system.
-- It reuses the existing users/students/groups/teams, point_events, and
-- student_profiles.age. It never creates a parallel account or wallet system.
-- This migration only creates tables/indexes and copies legacy competition
-- records from academy_records without deleting or altering them.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- 1) Categories: age/hizb/riwaya buckets are data, editable without code.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competition_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'quran_hifz' CHECK (kind IN ('quran_hifz','quran_tilawa','quran_tajweed','hadith','mutoon','seerah','islamic_culture','other')),
  min_hizb INTEGER CHECK (min_hizb IS NULL OR (min_hizb >= 0 AND min_hizb <= 60)),
  max_hizb INTEGER CHECK (max_hizb IS NULL OR (max_hizb >= 1 AND max_hizb <= 60)),
  min_age INTEGER CHECK (min_age IS NULL OR (min_age >= 3 AND min_age <= 100)),
  max_age INTEGER CHECK (max_age IS NULL OR (max_age >= 3 AND max_age <= 100)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_competition_categories_active_order ON competition_categories(active, sort_order);

-- The four Quran hizb categories are structural, not seasonal conditions.
-- Age ranges are intentionally NULL: each competition sets its own age range.
INSERT OR IGNORE INTO competition_categories (id,name,code,kind,min_hizb,max_hizb,min_age,max_age,active,sort_order) VALUES
  ('cat-hizb-15','15 حزبًا','hizb15','quran_hifz',0,15,NULL,NULL,1,10),
  ('cat-hizb-30','30 حزبًا','hizb30','quran_hifz',15,30,NULL,NULL,1,20),
  ('cat-hizb-45','45 حزبًا','hizb45','quran_hifz',30,45,NULL,NULL,1,30),
  ('cat-hizb-60','60 حزبًا','hizb60','quran_hifz',45,60,NULL,NULL,1,40),
  ('cat-general','عام','general','other',NULL,NULL,NULL,NULL,1,90);

-- ---------------------------------------------------------------------------
-- 2) Competitions: stages are explicit and transitioned server-side.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competitions (
  id TEXT PRIMARY KEY,
  school_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'quran_hifz' CHECK (kind IN ('quran_hifz','quran_tilawa','quran_tajweed','hadith','mutoon','seerah','islamic_culture','other')),
  season TEXT NOT NULL DEFAULT 'general',
  category_id TEXT REFERENCES competition_categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','announced','registration','judging','results','honored','archived')),
  registration_starts_at TEXT,
  registration_ends_at TEXT,
  starts_at TEXT,
  ends_at TEXT,
  min_age INTEGER CHECK (min_age IS NULL OR (min_age >= 3 AND min_age <= 100)),
  max_age INTEGER CHECK (max_age IS NULL OR (max_age >= 3 AND max_age <= 100)),
  riwayat_json TEXT NOT NULL DEFAULT '[]',
  min_hizb INTEGER CHECK (min_hizb IS NULL OR (min_hizb >= 0 AND min_hizb <= 60)),
  max_hizb INTEGER CHECK (max_hizb IS NULL OR (max_hizb >= 1 AND max_hizb <= 60)),
  requires_approval INTEGER NOT NULL DEFAULT 0 CHECK (requires_approval IN (0,1)),
  max_participants INTEGER CHECK (max_participants IS NULL OR (max_participants >= 1 AND max_participants <= 100000)),
  rules TEXT NOT NULL DEFAULT '',
  judging_criteria_json TEXT NOT NULL DEFAULT '[]',
  awards_json TEXT NOT NULL DEFAULT '[]',
  participation_achievement INTEGER NOT NULL DEFAULT 0 CHECK (participation_achievement >= 0 AND participation_achievement <= 100000),
  participation_store INTEGER NOT NULL DEFAULT 0 CHECK (participation_store >= 0 AND participation_store <= 100000),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_competitions_status_dates ON competitions(status, registration_starts_at, registration_ends_at);
CREATE INDEX IF NOT EXISTS idx_competitions_school ON competitions(school_id, status);

-- ---------------------------------------------------------------------------
-- 3) Registrations: one row per student per competition.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competition_registrations (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn','disqualified')),
  age_at_registration INTEGER CHECK (age_at_registration IS NULL OR (age_at_registration >= 3 AND age_at_registration <= 100)),
  hizb_at_registration TEXT NOT NULL DEFAULT '',
  riwaya TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  registered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  decided_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  decided_at TEXT,
  decision_note TEXT NOT NULL DEFAULT '',
  UNIQUE (competition_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_competition_registrations_competition ON competition_registrations(competition_id, status);
CREATE INDEX IF NOT EXISTS idx_competition_registrations_student ON competition_registrations(student_id, registered_at);
CREATE INDEX IF NOT EXISTS idx_competition_registrations_group ON competition_registrations(group_id, status);

-- ---------------------------------------------------------------------------
-- 4) Human judging: assigned judges + per-criterion scores. No automatic
--    recitation correction is claimed or attempted.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competition_judges (
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (competition_id, user_id)
);

CREATE TABLE IF NOT EXISTS competition_scores (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  registration_id TEXT NOT NULL REFERENCES competition_registrations(id) ON DELETE CASCADE,
  judge_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  criteria_json TEXT NOT NULL DEFAULT '[]',
  total REAL NOT NULL CHECK (total >= 0 AND total <= 100),
  note TEXT NOT NULL DEFAULT '',
  scored_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (competition_id, registration_id, judge_user_id)
);
CREATE INDEX IF NOT EXISTS idx_competition_scores_registration ON competition_scores(registration_id);

CREATE TABLE IF NOT EXISTS competition_results (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  registration_id TEXT NOT NULL REFERENCES competition_registrations(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  final_score REAL CHECK (final_score IS NULL OR (final_score >= 0 AND final_score <= 100)),
  rank INTEGER CHECK (rank IS NULL OR rank >= 1),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','published')),
  award_achievement INTEGER NOT NULL DEFAULT 0 CHECK (award_achievement >= 0 AND award_achievement <= 100000),
  award_store INTEGER NOT NULL DEFAULT 0 CHECK (award_store >= 0 AND award_store <= 100000),
  award_event_achievement_id TEXT,
  award_event_store_id TEXT,
  note TEXT NOT NULL DEFAULT '',
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (competition_id, registration_id)
);
CREATE INDEX IF NOT EXISTS idx_competition_results_competition ON competition_results(competition_id, rank, status);
CREATE INDEX IF NOT EXISTS idx_competition_results_student ON competition_results(student_id, status);

-- ---------------------------------------------------------------------------
-- 5) Calendar + editable reference terms. 2024 conditions are never hardcoded;
--    the admin records and approves the terms for each cycle.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competition_events (
  id TEXT PRIMARY KEY,
  competition_id TEXT REFERENCES competitions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  event_date TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('announcement','registration','judging','result','honoring','other')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_competition_events_date ON competition_events(event_date, active);

CREATE TABLE IF NOT EXISTS competition_reference_terms (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('quran_hifz','quran_tilawa','quran_tajweed','hadith','mutoon','seerah','islamic_culture','other')),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_competition_terms_kind ON competition_reference_terms(kind, active, sort_order);

INSERT OR IGNORE INTO competition_reference_terms (id,kind,title,body,source,active,sort_order) VALUES
  ('term-general-template','other','قالب شروط عام','تُكتب هنا شروط كل دورة واعتمادها من الإدارة قبل الإعلان. لا تُعتمد شروط دورة سابقة تلقائيًا.','قالب قابل للتعديل',1,10);

-- A zero-value rule gives competition awards a stable rule_id while the actual
-- amounts come from the approved result row (not from a blanket rule).
INSERT OR IGNORE INTO point_rules (id,event_type,name,description,achievement_points,store_points,max_per_day,auto_award,active,sort_order) VALUES
  ('rule-competition-award','competition_award','مكافأة مسابقة','تُمنح باعتماد نتائج المسابقة وبمقدار مخصّص لكل مرتبة.',0,0,NULL,1,1,60);

-- ---------------------------------------------------------------------------
-- 6) Best-effort legacy import. Old academy_records rows are left untouched.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO competitions (id,school_id,title,description,kind,season,category_id,status,registration_starts_at,registration_ends_at,starts_at,ends_at,created_by,created_at,updated_at,rules,judging_criteria_json,awards_json)
SELECT id,NULL,
  COALESCE(NULLIF(json_extract(payload_json,'$.title'),''),'مسابقة سابقة'),
  COALESCE(json_extract(payload_json,'$.description'),''),
  'other','general',NULL,
  CASE json_extract(payload_json,'$.status') WHEN 'published' THEN 'registration' WHEN 'closed' THEN 'archived' ELSE 'draft' END,
  NULL,NULL,
  json_extract(payload_json,'$.starts_at'),json_extract(payload_json,'$.ends_at'),
  NULL,
  COALESCE(json_extract(payload_json,'$.created_at'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  COALESCE(json_extract(payload_json,'$.updated_at'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  '','[]','[]'
FROM academy_records WHERE collection='competitions';

INSERT OR IGNORE INTO competition_registrations (id,competition_id,student_id,group_id,status,note,registered_at)
SELECT id,json_extract(payload_json,'$.competition_id'),student_id,group_id,
  CASE WHEN json_extract(payload_json,'$.score') IS NULL THEN 'pending' ELSE 'approved' END,
  COALESCE(json_extract(payload_json,'$.note'),''),
  COALESCE(json_extract(payload_json,'$.created_at'),strftime('%Y-%m-%dT%H:%M:%fZ','now'))
FROM academy_records
WHERE collection='competition_entries'
  AND json_extract(payload_json,'$.competition_id') IS NOT NULL
  AND student_id IS NOT NULL;

INSERT OR IGNORE INTO competition_results (id,competition_id,registration_id,student_id,group_id,final_score,rank,status,note,created_at)
SELECT 'legacy-'||id,json_extract(payload_json,'$.competition_id'),id,student_id,group_id,
  CASE WHEN CAST(json_extract(payload_json,'$.score') AS REAL) > 100
    THEN ROUND(CAST(json_extract(payload_json,'$.score') AS REAL)/10.0,2)
    ELSE CAST(json_extract(payload_json,'$.score') AS REAL) END,
  NULL,'draft','مستورد من النظام السابق',
  COALESCE(json_extract(payload_json,'$.updated_at'),strftime('%Y-%m-%dT%H:%M:%fZ','now'))
FROM academy_records
WHERE collection='competition_entries'
  AND json_extract(payload_json,'$.score') IS NOT NULL;
