-- Add group ownership so teachers can only manage assigned groups.
ALTER TABLE groups ADD COLUMN teacher_id TEXT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_groups_teacher_active ON groups(teacher_id, active);
