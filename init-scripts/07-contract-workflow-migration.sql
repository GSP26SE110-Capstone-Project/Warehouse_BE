-- =====================================================
-- Migration: Contract workflow states (B1, B2, B3, B5)
-- =====================================================
-- Mục tiêu:
--   - Bổ sung cột gửi/ký hợp đồng
--   - Chuẩn hóa trạng thái hợp đồng theo flow mới
--   - Giữ tương thích dữ liệu cũ

BEGIN;

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_file_url TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS tenant_signed_at TIMESTAMP;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signed_by VARCHAR(50);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signature_method VARCHAR(20);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_contracts_signed_by'
      AND table_name = 'contracts'
  ) THEN
    ALTER TABLE contracts
    ADD CONSTRAINT fk_contracts_signed_by
    FOREIGN KEY (signed_by) REFERENCES users(user_id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contracts_status_check'
  ) THEN
    ALTER TABLE contracts DROP CONSTRAINT contracts_status_check;
  END IF;
END $$;

ALTER TABLE contracts
ADD CONSTRAINT contracts_status_check
CHECK (status IN ('DRAFT', 'SENT_TO_TENANT', 'SIGNED_BY_TENANT', 'ACTIVE', 'EXPIRED', 'CANCELLED'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contracts_signature_method_check'
  ) THEN
    ALTER TABLE contracts DROP CONSTRAINT contracts_signature_method_check;
  END IF;
END $$;

ALTER TABLE contracts
ADD CONSTRAINT contracts_signature_method_check
CHECK (signature_method IS NULL OR signature_method IN ('E_SIGN', 'CONFIRM'));

-- Dữ liệu cũ ACTIVE giữ nguyên.
-- Dữ liệu cũ NULL status đổi về DRAFT.
UPDATE contracts
SET status = 'DRAFT'
WHERE status IS NULL;

ALTER TABLE contracts ALTER COLUMN status SET DEFAULT 'DRAFT';

COMMIT;

