-- =====================================================
-- Backfill: gan tenant "ngam" cho moi user tenant_admin
-- chua co tenant_id (da register truoc khi bat auto-tenant
-- trong AuthController.register).
-- Idempotent: chay lai khong sinh trung, khong loi.
-- =====================================================

DO $$
DECLARE
  r RECORD;
  v_next_num INT;
  v_tenant_id TEXT;
  v_existing_tenant_id TEXT;
BEGIN
  FOR r IN
    SELECT user_id, email, phone, full_name
    FROM users
    WHERE role = 'tenant_admin'
      AND tenant_id IS NULL
    ORDER BY created_at
  LOOP
    -- Neu da co tenant voi contact_email = user.email thi reuse
    SELECT tenant_id INTO v_existing_tenant_id
    FROM tenants
    WHERE LOWER(contact_email) = LOWER(r.email)
    LIMIT 1;

    IF v_existing_tenant_id IS NOT NULL THEN
      UPDATE users SET tenant_id = v_existing_tenant_id
      WHERE user_id = r.user_id AND tenant_id IS NULL;
      CONTINUE;
    END IF;

    -- Sinh tenant_id ke tiep theo pattern TN####
    SELECT COALESCE(MAX(CAST(SUBSTRING(tenant_id FROM 3) AS INTEGER)), 0) + 1
      INTO v_next_num
    FROM tenants
    WHERE tenant_id ~ '^TN[0-9]+$';

    v_tenant_id := 'TN' || LPAD(v_next_num::TEXT, 4, '0');

    INSERT INTO tenants (
      tenant_id, company_name, tax_code, contact_email, contact_phone, is_active
    ) VALUES (
      v_tenant_id,
      COALESCE(r.full_name, r.email),
      'IND-' || r.user_id,
      r.email,
      r.phone,
      TRUE
    );

    UPDATE users
    SET tenant_id = v_tenant_id
    WHERE user_id = r.user_id
      AND tenant_id IS NULL;
  END LOOP;
END $$;
