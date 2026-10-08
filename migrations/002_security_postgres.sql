CREATE INDEX IF NOT EXISTS academy_records_data_gin_idx ON academy_records USING GIN(data);
