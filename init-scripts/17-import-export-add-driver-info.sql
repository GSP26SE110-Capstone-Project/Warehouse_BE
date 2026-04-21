-- =====================================================
-- Add driver transportation info to import_export_records
-- =====================================================

BEGIN;

ALTER TABLE import_export_records
    ADD COLUMN IF NOT EXISTS vehicle_plate_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS driver_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS driver_citizen_id VARCHAR(20);

COMMIT;
