-- أكاديمية الإحسان — V30 storage adapter schema
-- SQLite-compatible bridge. The application stores each array collection as JSON rows
-- and scalar/object settings in academy_meta. This is an intentional migration layer,
-- not the final normalized production schema.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS academy_meta (key TEXT PRIMARY KEY, data TEXT NOT NULL);
-- Collection tables are created by the adapter from the current JSON database.
