-- =====================================================
-- Remove deprecated warehouse fields
-- =====================================================

BEGIN;

ALTER TABLE warehouses
    DROP COLUMN IF EXISTS warehouse_type,
    DROP COLUMN IF EXISTS warehouse_size;

COMMIT;
