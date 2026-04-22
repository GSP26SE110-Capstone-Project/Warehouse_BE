-- =====================================================
-- Add is_rented for racks and levels
-- =====================================================

BEGIN;

ALTER TABLE racks
    ADD COLUMN IF NOT EXISTS is_rented BOOLEAN DEFAULT FALSE;

ALTER TABLE levels
    ADD COLUMN IF NOT EXISTS is_rented BOOLEAN DEFAULT FALSE;

-- Backfill based on contract items and contract status
UPDATE racks r
SET is_rented = EXISTS (
    SELECT 1
    FROM contract_items ci
    JOIN contracts c ON c.contract_id = ci.contract_id
    WHERE ci.rack_id = r.rack_id
      AND c.status IN ('SENT_TO_TENANT', 'SIGNED_BY_TENANT', 'ACTIVE')
);

UPDATE levels l
SET is_rented = EXISTS (
    SELECT 1
    FROM contract_items ci
    JOIN contracts c ON c.contract_id = ci.contract_id
    WHERE ci.level_id = l.level_id
      AND c.status IN ('SENT_TO_TENANT', 'SIGNED_BY_TENANT', 'ACTIVE')
);

COMMIT;
