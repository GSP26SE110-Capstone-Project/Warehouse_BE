-- =====================================================
-- Remove duplicated location fields
-- - warehouses.city
-- - branches.address
-- =====================================================

BEGIN;

ALTER TABLE warehouses
    DROP COLUMN IF EXISTS city;

ALTER TABLE branches
    DROP COLUMN IF EXISTS address;

COMMIT;
