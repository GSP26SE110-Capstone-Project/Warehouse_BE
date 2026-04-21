-- =====================================================
-- Extend contract_items for explicit rack/level assignment
-- =====================================================

BEGIN;

ALTER TABLE contract_items
    ADD COLUMN IF NOT EXISTS rack_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS level_id VARCHAR(50);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_contract_items_rack_id'
      AND table_name = 'contract_items'
  ) THEN
    ALTER TABLE contract_items
      ADD CONSTRAINT fk_contract_items_rack_id
      FOREIGN KEY (rack_id) REFERENCES racks(rack_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_contract_items_level_id'
      AND table_name = 'contract_items'
  ) THEN
    ALTER TABLE contract_items
      ADD CONSTRAINT fk_contract_items_level_id
      FOREIGN KEY (level_id) REFERENCES levels(level_id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE contract_items
    DROP CONSTRAINT IF EXISTS contract_items_rent_type_check;

ALTER TABLE contract_items
    ADD CONSTRAINT contract_items_rent_type_check
    CHECK (rent_type IN ('ENTIRE_WAREHOUSE', 'ZONE', 'SLOT', 'RACK', 'LEVEL'));

COMMIT;
