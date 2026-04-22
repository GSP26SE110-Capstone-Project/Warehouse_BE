-- =====================================================
-- Add warehouse occupancy fields
-- =====================================================

BEGIN;

ALTER TABLE warehouses
    ADD COLUMN IF NOT EXISTS occupied_percent DECIMAL(5, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS occupancy_status VARCHAR(20) DEFAULT 'EMPTY';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_warehouses_occupancy_status'
      AND table_name = 'warehouses'
  ) THEN
    ALTER TABLE warehouses
      ADD CONSTRAINT chk_warehouses_occupancy_status
      CHECK (occupancy_status IN ('EMPTY', 'PARTIAL', 'FULL'));
  END IF;
END $$;

WITH warehouse_stats AS (
  SELECT
    w.warehouse_id,
    COUNT(DISTINCT r.rack_id) AS rack_count,
    COUNT(DISTINCT CASE WHEN r.is_rented THEN r.rack_id END) AS rented_rack_count,
    COUNT(DISTINCT l.level_id) AS level_count,
    COUNT(DISTINCT CASE WHEN l.is_rented THEN l.level_id END) AS rented_level_count
  FROM warehouses w
  LEFT JOIN zones z ON z.warehouse_id = w.warehouse_id
  LEFT JOIN racks r ON r.zone_id = z.zone_id
  LEFT JOIN levels l ON l.rack_id = r.rack_id
  GROUP BY w.warehouse_id
),
normalized AS (
  SELECT
    warehouse_id,
    CASE WHEN level_count > 0 THEN level_count ELSE rack_count END AS total_units,
    CASE WHEN level_count > 0 THEN rented_level_count ELSE rented_rack_count END AS rented_units
  FROM warehouse_stats
)
UPDATE warehouses w
SET
  occupied_percent = CASE
    WHEN n.total_units <= 0 THEN 0
    ELSE ROUND((n.rented_units::numeric * 100.0) / n.total_units::numeric, 2)
  END,
  occupancy_status = CASE
    WHEN n.rented_units <= 0 THEN 'EMPTY'
    WHEN n.total_units > 0 AND n.rented_units >= n.total_units THEN 'FULL'
    ELSE 'PARTIAL'
  END
FROM normalized n
WHERE w.warehouse_id = n.warehouse_id;

COMMIT;
