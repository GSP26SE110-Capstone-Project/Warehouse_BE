-- =====================================================
-- Migration: Extend rental_requests for Flow C
-- =====================================================
-- Mục tiêu:
--   - Bổ sung thông tin khách hàng + hàng hóa cho rental_requests
--   - Chuẩn hóa kỳ hạn thuê theo rental_term_unit + rental_term_value
--   - Cố định storage_type = 'normal' ở tầng DB
--
-- Lưu ý:
--   - Script idempotent, chạy nhiều lần an toàn.
--   - Dữ liệu cũ được backfill để không bị vỡ khi thêm NOT NULL.

BEGIN;

-- 1) Add columns (safe if already exists)
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS customer_type VARCHAR(20);
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255);
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS warehouse_id VARCHAR(50);
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS storage_type VARCHAR(20);
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS rental_term_unit VARCHAR(20);
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS rental_term_value INTEGER;
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS goods_type VARCHAR(255);
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS goods_description TEXT;
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS goods_quantity DECIMAL(15, 2);
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS goods_weight_kg DECIMAL(15, 2);
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS approved_by VARCHAR(50);
ALTER TABLE rental_requests ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

-- 2) Backfill old rows
UPDATE rental_requests rr
SET
  customer_type = COALESCE(rr.customer_type, 'business'),
  contact_name = COALESCE(rr.contact_name, t.company_name, 'Unknown Contact'),
  contact_phone = COALESCE(rr.contact_phone, t.contact_phone, 'N/A'),
  contact_email = COALESCE(rr.contact_email, t.contact_email, 'unknown@example.com'),
  storage_type = COALESCE(rr.storage_type, 'normal'),
  rental_term_unit = COALESCE(rr.rental_term_unit, 'MONTH'),
  rental_term_value = COALESCE(rr.rental_term_value, GREATEST(1, CEIL(COALESCE(rr.duration_days, 30)::numeric / 30))::int),
  goods_type = COALESCE(rr.goods_type, 'general_goods'),
  goods_quantity = COALESCE(rr.goods_quantity, 1),
  goods_weight_kg = COALESCE(rr.goods_weight_kg, 0)
FROM tenants t
WHERE rr.tenant_id = t.tenant_id;

-- Fallback for rows not joined with tenants
UPDATE rental_requests
SET
  customer_type = COALESCE(customer_type, 'business'),
  contact_name = COALESCE(contact_name, 'Unknown Contact'),
  contact_phone = COALESCE(contact_phone, 'N/A'),
  contact_email = COALESCE(contact_email, 'unknown@example.com'),
  storage_type = COALESCE(storage_type, 'normal'),
  rental_term_unit = COALESCE(rental_term_unit, 'MONTH'),
  rental_term_value = COALESCE(rental_term_value, GREATEST(1, CEIL(COALESCE(duration_days, 30)::numeric / 30))::int),
  goods_type = COALESCE(goods_type, 'general_goods'),
  goods_quantity = COALESCE(goods_quantity, 1),
  goods_weight_kg = COALESCE(goods_weight_kg, 0)
WHERE customer_type IS NULL
   OR contact_name IS NULL
   OR contact_phone IS NULL
   OR contact_email IS NULL
   OR storage_type IS NULL
   OR rental_term_unit IS NULL
   OR rental_term_value IS NULL
   OR goods_type IS NULL
   OR goods_quantity IS NULL
   OR goods_weight_kg IS NULL;

-- 3) Required defaults for new rows
ALTER TABLE rental_requests ALTER COLUMN storage_type SET DEFAULT 'normal';
ALTER TABLE rental_requests ALTER COLUMN customer_type SET DEFAULT 'business';

-- 4) Set NOT NULL after backfill
ALTER TABLE rental_requests ALTER COLUMN customer_type SET NOT NULL;
ALTER TABLE rental_requests ALTER COLUMN contact_name SET NOT NULL;
ALTER TABLE rental_requests ALTER COLUMN contact_phone SET NOT NULL;
ALTER TABLE rental_requests ALTER COLUMN contact_email SET NOT NULL;
ALTER TABLE rental_requests ALTER COLUMN storage_type SET NOT NULL;
ALTER TABLE rental_requests ALTER COLUMN rental_term_unit SET NOT NULL;
ALTER TABLE rental_requests ALTER COLUMN rental_term_value SET NOT NULL;
ALTER TABLE rental_requests ALTER COLUMN goods_type SET NOT NULL;
ALTER TABLE rental_requests ALTER COLUMN goods_quantity SET NOT NULL;
ALTER TABLE rental_requests ALTER COLUMN goods_weight_kg SET NOT NULL;

-- 5) Constraints (only create if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_rental_requests_customer_type'
  ) THEN
    ALTER TABLE rental_requests
    ADD CONSTRAINT chk_rental_requests_customer_type
    CHECK (customer_type IN ('individual', 'business'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_rental_requests_storage_type'
  ) THEN
    ALTER TABLE rental_requests
    ADD CONSTRAINT chk_rental_requests_storage_type
    CHECK (storage_type IN ('normal'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_rental_requests_rental_term_unit'
  ) THEN
    ALTER TABLE rental_requests
    ADD CONSTRAINT chk_rental_requests_rental_term_unit
    CHECK (rental_term_unit IN ('MONTH', 'QUARTER', 'YEAR'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_rental_requests_rental_term_value'
  ) THEN
    ALTER TABLE rental_requests
    ADD CONSTRAINT chk_rental_requests_rental_term_value
    CHECK (rental_term_value > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_rental_requests_goods_quantity'
  ) THEN
    ALTER TABLE rental_requests
    ADD CONSTRAINT chk_rental_requests_goods_quantity
    CHECK (goods_quantity > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_rental_requests_goods_weight_kg'
  ) THEN
    ALTER TABLE rental_requests
    ADD CONSTRAINT chk_rental_requests_goods_weight_kg
    CHECK (goods_weight_kg >= 0);
  END IF;
END $$;

-- 6) Foreign keys (only create if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_rental_requests_warehouse_id'
      AND table_name = 'rental_requests'
  ) THEN
    ALTER TABLE rental_requests
    ADD CONSTRAINT fk_rental_requests_warehouse_id
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_rental_requests_approved_by'
      AND table_name = 'rental_requests'
  ) THEN
    ALTER TABLE rental_requests
    ADD CONSTRAINT fk_rental_requests_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(user_id) ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
