-- READ-ONLY preflight for the forward-only store-balance cutover.
-- Aggregate output only; no student identifiers and no writes.

WITH grouped AS (
  SELECT student_id,event_key,
    MAX(CASE WHEN kind='achievement' THEN points END) AS achievement_points,
    MAX(CASE WHEN kind='store' AND event_type<>'store_redemption' THEN points END) AS store_points
  FROM point_events
  WHERE reversed_at IS NULL AND event_type<>'store_redemption'
  GROUP BY student_id,event_key
),
redeemed AS (
  SELECT student_id,COALESCE(SUM(points),0) AS spent
  FROM point_events
  WHERE reversed_at IS NULL AND event_type='store_redemption' AND kind='store'
  GROUP BY student_id
),
totals AS (
  SELECT s.id AS student_id,
    COALESCE(SUM(MAX(COALESCE(g.achievement_points,-100000),COALESCE(g.store_points,-100000))),0)+COALESCE(MAX(r.spent),0) AS legacy_store_balance,
    COALESCE(SUM(COALESCE(g.store_points,0)),0)+COALESCE(MAX(r.spent),0) AS strict_store_balance
  FROM students s
  LEFT JOIN grouped g ON g.student_id=s.id
  LEFT JOIN redeemed r ON r.student_id=s.id
  GROUP BY s.id
)
SELECT
  COUNT(*) AS students,
  COALESCE(SUM(legacy_store_balance),0) AS current_legacy_store_total,
  COALESCE(SUM(strict_store_balance),0) AS strict_store_ledger_total,
  COALESCE(SUM(legacy_store_balance-strict_store_balance),0) AS difference_preserved_by_opening_snapshot,
  COUNT(CASE WHEN legacy_store_balance<>strict_store_balance THEN 1 END) AS students_affected,
  COALESCE(MAX(legacy_store_balance-strict_store_balance),0) AS largest_student_difference
FROM totals;
