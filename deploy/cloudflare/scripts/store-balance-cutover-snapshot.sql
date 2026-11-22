-- PRODUCTION SAFETY:
-- Do not execute against production without a verified D1 backup, a maintenance window,
-- and explicit user approval. This snapshots the EXISTING derived store balance so no
-- student's historical spendable balance is reduced by the forward-only separation.
-- It does not update or delete point_events, students, points, or QR records.
-- Idempotent: existing opening snapshots and an existing cutover marker are not overwritten.

WITH grouped AS (
  SELECT student_id,event_key,
    MAX(CASE WHEN kind='achievement' THEN points END) AS achievement_points,
    MAX(CASE WHEN kind='store' AND event_type<>'store_redemption' THEN points END) AS store_points
  FROM point_events
  WHERE reversed_at IS NULL AND event_type<>'store_redemption'
  GROUP BY student_id,event_key
),
grouped_totals AS (
  SELECT student_id,
    COALESCE(SUM(MAX(COALESCE(achievement_points,-100000),COALESCE(store_points,-100000))),0) AS gross
  FROM grouped
  GROUP BY student_id
),
redeemed AS (
  SELECT student_id,COALESCE(SUM(points),0) AS spent
  FROM point_events
  WHERE reversed_at IS NULL AND event_type='store_redemption' AND kind='store'
  GROUP BY student_id
),
legacy AS (
  SELECT s.id AS student_id,
    COALESCE(g.gross,0)+COALESCE(r.spent,0) AS balance
  FROM students s
  LEFT JOIN grouped_totals g ON g.student_id=s.id
  LEFT JOIN redeemed r ON r.student_id=s.id
)
INSERT OR IGNORE INTO student_store_opening_balances(student_id,opening_balance,as_of,snapshot_version)
SELECT s.id,COALESCE(l.balance,0),strftime('%Y-%m-%dT%H:%M:%fZ','now'),1
FROM students s
LEFT JOIN legacy l ON l.student_id=s.id;

-- Activate only after every current student has an opening snapshot.
INSERT OR IGNORE INTO point_balance_cutovers(id,active,completed_at,snapshot_version)
SELECT 1,1,strftime('%Y-%m-%dT%H:%M:%fZ','now'),1
WHERE (SELECT COUNT(*) FROM student_store_opening_balances)=(SELECT COUNT(*) FROM students);

-- Read-only verification output.
SELECT
  (SELECT COUNT(*) FROM students) AS students,
  (SELECT COUNT(*) FROM student_store_opening_balances) AS opening_snapshots,
  (SELECT COALESCE(SUM(opening_balance),0) FROM student_store_opening_balances) AS opening_store_total,
  (SELECT active FROM point_balance_cutovers WHERE id=1) AS cutover_active;
