-- 0004_learning_economy.sql
-- إضافة أساس الاقتصاد التعليمي: قواعد النقاط، دفتر الحركات، المتجر وطلبات الصرف.
-- الترحيل إضافي بالكامل: لا حذف ولا تعديل لأي جدول أو سجل قائم.
--
-- مبادئ التصميم:
--   * نقطا الإنجاز (achievement) مؤشر تراكمي لا يُصرف.
--   * رصيد المتجر (store) هو الرصيد القابل للصرف فقط.
--   * كل حركة لها event_key ثابت، والقيد الفريد (kind, event_key) يمنع التكرار.
--   * لا تُحذف الحركات؛ التصحيح بعكس موثّق (reversed_at + reversal_reason).
--   * قيم النقاط تأتي من point_rules القابلة للتهيئة، لا من أرقام مبعثرة في الكود.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- 1) قواعد النقاط: صف واحد لكل نوع حدث، ويمكن للإدارة تعديله من الواجهة.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS point_rules (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  achievement_points INTEGER NOT NULL DEFAULT 0 CHECK (achievement_points >= 0 AND achievement_points <= 100000),
  store_points INTEGER NOT NULL DEFAULT 0 CHECK (store_points >= 0 AND store_points <= 100000),
  max_per_day INTEGER CHECK (max_per_day IS NULL OR (max_per_day >= 1 AND max_per_day <= 1000)),
  auto_award INTEGER NOT NULL DEFAULT 1 CHECK (auto_award IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_point_rules_active_order ON point_rules(active, sort_order);

-- بذور افتراضية بقيم أولية فقط، ولا تُستبدل تعديلات الإدارة اللاحقة.
INSERT OR IGNORE INTO point_rules (id,event_type,name,description,achievement_points,store_points,max_per_day,auto_award,active,sort_order) VALUES
  ('rule-attendance-present','attendance_present','حضور حاضر','تُمنح عند تسجيل الطالب حاضرًا في الحضور اليومي.',5,2,1,1,1,10),
  ('rule-quran-entry','quran_entry','متابعة قرآنية','تُمنح عند إضافة متابعة حفظ أو مراجعة أو تسميع جديدة.',10,5,3,1,1,20),
  ('rule-assignment-reviewed','assignment_reviewed','مراجعة واجب','تُمنح عند اعتماد مراجعة تسليم الواجب.',10,5,5,1,1,30),
  ('rule-assignment-excellent','assignment_excellent','إتقان واجب','تُمنح عند اعتماد مراجعة تسليم بدرجة إتقان (80% فأكثر).',20,10,5,1,1,31),
  ('rule-test-completed','test_completed','إكمال اختبار','تُمنح عند إكمال اختبار ونشره في السجل.',10,5,3,1,1,40),
  ('rule-daily-challenge','daily_challenge','تحدي اليوم','تُمنح عند استلام تحدي اليوم.',5,5,1,1,1,50);

-- ---------------------------------------------------------------------------
-- 2) دفتر النقاط: سجل غير قابل للحذف، والعكس يتم بتأشير الحركة لا بحذفها.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS point_events (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  rule_id TEXT REFERENCES point_rules(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('achievement','store')),
  points INTEGER NOT NULL CHECK (points <> 0 AND points >= -100000 AND points <= 100000),
  reason TEXT NOT NULL DEFAULT '',
  event_key TEXT NOT NULL,
  awarded_date TEXT NOT NULL,
  source_collection TEXT,
  source_id TEXT,
  awarded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  reversed_at TEXT,
  reversed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reversal_reason TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_point_events_unique_event ON point_events(kind, event_key);
CREATE INDEX IF NOT EXISTS idx_point_events_student_date ON point_events(student_id, awarded_date);
CREATE INDEX IF NOT EXISTS idx_point_events_group_date ON point_events(group_id, awarded_date);
CREATE INDEX IF NOT EXISTS idx_point_events_dedupe ON point_events(student_id, event_type, kind, awarded_date);

-- ---------------------------------------------------------------------------
-- 3) المتجر: مواد قابلة للصرف برصيد المتجر.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '🎁',
  cost INTEGER NOT NULL CHECK (cost >= 1 AND cost <= 100000),
  stock INTEGER CHECK (stock IS NULL OR stock >= 0),
  max_per_student INTEGER CHECK (max_per_student IS NULL OR max_per_student >= 1),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_store_items_active_order ON store_items(active, sort_order);

CREATE TABLE IF NOT EXISTS store_redemptions (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES store_items(id) ON DELETE RESTRICT,
  item_name TEXT NOT NULL,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  cost INTEGER NOT NULL CHECK (cost >= 1),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','fulfilled','cancelled')),
  note TEXT NOT NULL DEFAULT '',
  requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  decided_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  decided_at TEXT,
  decision_note TEXT NOT NULL DEFAULT '',
  debit_event_id TEXT REFERENCES point_events(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_store_redemptions_student ON store_redemptions(student_id, requested_at);
CREATE INDEX IF NOT EXISTS idx_store_redemptions_group ON store_redemptions(group_id, requested_at);
CREATE INDEX IF NOT EXISTS idx_store_redemptions_status ON store_redemptions(status, requested_at);
