CREATE TABLE IF NOT EXISTS academy_meta (key TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS academy_records (collection TEXT NOT NULL, id TEXT NOT NULL, data JSONB NOT NULL, PRIMARY KEY(collection,id));
CREATE INDEX IF NOT EXISTS academy_records_collection_idx ON academy_records(collection);
INSERT INTO academy_meta(key,data) VALUES ('schema_version','1'::jsonb) ON CONFLICT(key) DO NOTHING;
