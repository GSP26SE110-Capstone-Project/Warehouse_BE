-- =====================================================
-- Simplify rental_requests input scope
-- - remove contact_* (derive from tenant profile)
-- - remove storage_type
-- - add rental_type (RACK | LEVEL)
-- =====================================================

BEGIN;

ALTER TABLE rental_requests
    ADD COLUMN IF NOT EXISTS rental_type VARCHAR(20);

UPDATE rental_requests
SET rental_type = COALESCE(rental_type, 'RACK');

ALTER TABLE rental_requests
    ALTER COLUMN tenant_id SET NOT NULL,
    ALTER COLUMN rental_type SET NOT NULL,
    ALTER COLUMN rental_type SET DEFAULT 'RACK';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_rental_requests_rental_type'
      AND table_name = 'rental_requests'
  ) THEN
    ALTER TABLE rental_requests
      ADD CONSTRAINT chk_rental_requests_rental_type
      CHECK (rental_type IN ('RACK', 'LEVEL'));
  END IF;
END $$;

ALTER TABLE rental_requests
    DROP COLUMN IF EXISTS contact_name,
    DROP COLUMN IF EXISTS contact_phone,
    DROP COLUMN IF EXISTS contact_email,
    DROP COLUMN IF EXISTS storage_type;

COMMIT;
