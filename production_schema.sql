-- Academy V10 logical schema
CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, role TEXT NOT NULL, created_at TIMESTAMP NOT NULL);
CREATE TABLE profiles (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, full_name TEXT NOT NULL);
CREATE TABLE groups (id TEXT PRIMARY KEY, name TEXT NOT NULL, teacher_id TEXT);
CREATE TABLE memberships (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, student_id TEXT NOT NULL);
CREATE TABLE parent_links (id TEXT PRIMARY KEY, parent_user_id TEXT NOT NULL, student_id TEXT NOT NULL, relation TEXT);
CREATE TABLE posts (id TEXT PRIMARY KEY, author_id TEXT NOT NULL, group_id TEXT, title TEXT NOT NULL, body TEXT NOT NULL, created_at TIMESTAMP NOT NULL);
CREATE TABLE post_reads (id TEXT PRIMARY KEY, post_id TEXT NOT NULL, user_id TEXT NOT NULL, read_at TIMESTAMP NOT NULL);
CREATE TABLE notifications (id TEXT PRIMARY KEY, user_id TEXT, title TEXT NOT NULL, body TEXT NOT NULL, read_at TIMESTAMP, created_at TIMESTAMP NOT NULL);
CREATE TABLE attendance (id TEXT PRIMARY KEY, student_id TEXT NOT NULL, group_id TEXT, date DATE NOT NULL, status TEXT NOT NULL, note TEXT);
CREATE TABLE subjects (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT, required BOOLEAN DEFAULT FALSE, active BOOLEAN DEFAULT TRUE);
CREATE TABLE lessons (id TEXT PRIMARY KEY, subject_id TEXT NOT NULL, title TEXT NOT NULL, lesson_type TEXT, order_no INTEGER);
CREATE TABLE student_progress (id TEXT PRIMARY KEY, student_id TEXT NOT NULL, lesson_id TEXT NOT NULL, status TEXT, score REAL, updated_at TIMESTAMP NOT NULL);
CREATE TABLE memorization (id TEXT PRIMARY KEY, student_id TEXT NOT NULL, subject_id TEXT, item_name TEXT NOT NULL, status TEXT, last_reviewed_at TIMESTAMP, next_review_at TIMESTAMP);
CREATE TABLE tests (id TEXT PRIMARY KEY, group_id TEXT, title TEXT NOT NULL, date DATE, max_score REAL, status TEXT);
CREATE TABLE grades (id TEXT PRIMARY KEY, test_id TEXT NOT NULL, student_id TEXT NOT NULL, score REAL, note TEXT);
CREATE TABLE reports (id TEXT PRIMARY KEY, student_id TEXT NOT NULL, period_type TEXT NOT NULL, period_start DATE, period_end DATE, attendance_rate REAL, progress_rate REAL, summary TEXT, created_at TIMESTAMP NOT NULL);
CREATE TABLE audit_logs (id TEXT PRIMARY KEY, actor_user_id TEXT, action TEXT NOT NULL, entity TEXT, entity_id TEXT, created_at TIMESTAMP NOT NULL);
