-- =====================================================
-- Remove deprecated zone_type field
-- =====================================================

BEGIN;

ALTER TABLE zones
    DROP COLUMN IF EXISTS zone_type;

COMMIT;
