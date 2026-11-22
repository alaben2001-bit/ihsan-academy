-- Add the approval audit columns used by the current application while
-- preserving the legacy columns and their historical values.
-- No student rows, scores, point events, or backup records are deleted.

ALTER TABLE quran_stations
  ADD COLUMN reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE quran_stations
  ADD COLUMN reviewed_at TEXT;

UPDATE quran_stations
SET reviewed_by = approved_by
WHERE reviewed_by IS NULL AND approved_by IS NOT NULL;
UPDATE quran_stations
SET reviewed_at = approved_at
WHERE reviewed_at IS NULL AND approved_at IS NOT NULL;

ALTER TABLE competition_results
  ADD COLUMN reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE competition_results
  ADD COLUMN reviewed_at TEXT;

UPDATE competition_results
SET reviewed_by = approved_by
WHERE reviewed_by IS NULL AND approved_by IS NOT NULL;
UPDATE competition_results
SET reviewed_at = approved_at
WHERE reviewed_at IS NULL AND approved_at IS NOT NULL;
