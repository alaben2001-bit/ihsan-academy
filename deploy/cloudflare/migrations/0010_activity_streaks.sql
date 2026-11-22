-- Additive, non-destructive activity streak schema.
-- All tables use IF NOT EXISTS; no student rows, points, or QR records are changed.

CREATE TABLE IF NOT EXISTS student_activity_streaks (
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  activity TEXT NOT NULL CHECK(activity IN ('hifz','thabit','ward','wird','asr','adhkar','mandatory_classes','quran_classes','bring','fajr','shuruq','maghrib','attendance')),
  current_days INTEGER NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL,
  last_date TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(student_id,activity)
);

CREATE TABLE IF NOT EXISTS student_streak_badges (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  activity TEXT NOT NULL CHECK(activity IN ('hifz','thabit','ward')),
  streak_start_date TEXT NOT NULL,
  milestone_days INTEGER NOT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  awarded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(student_id,activity,streak_start_date,milestone_days)
);

CREATE TABLE IF NOT EXISTS student_activity_badges (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  activity TEXT NOT NULL,
  streak_start_date TEXT NOT NULL,
  milestone_days INTEGER NOT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  awarded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(student_id,activity,streak_start_date,milestone_days)
);
