-- =====================================================
-- Migration: Shipment request flow (Flow 3)
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS shipment_requests (
    request_id VARCHAR(50) PRIMARY KEY,
    contract_id VARCHAR(50) NOT NULL,
    tenant_id VARCHAR(50) NOT NULL,
    shipment_type VARCHAR(50) NOT NULL CHECK (shipment_type IN ('IMPORT', 'EXPORT')),
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    preferred_pickup_time TIMESTAMP,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by VARCHAR(50),
    approved_at TIMESTAMP,
    rejected_reason TEXT,
    shipment_id VARCHAR(50),
    transport_contract_id VARCHAR(50),
    created_by VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS transport_contracts (
    transport_contract_id VARCHAR(50) PRIMARY KEY,
    shipment_request_id VARCHAR(50) NOT NULL UNIQUE,
    tenant_id VARCHAR(50) NOT NULL,
    contract_code VARCHAR(50) NOT NULL UNIQUE,
    file_url TEXT,
    sent_by VARCHAR(50),
    sent_at TIMESTAMP,
    signed_by VARCHAR(50),
    signed_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT_TO_TENANT', 'SIGNED_BY_TENANT', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shipment_request_id) REFERENCES shipment_requests(request_id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    FOREIGN KEY (sent_by) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (signed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

ALTER TABLE shipment_requests
ADD COLUMN IF NOT EXISTS transport_contract_id VARCHAR(50);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_shipment_requests_transport_contract'
      AND table_name = 'shipment_requests'
  ) THEN
    ALTER TABLE shipment_requests
    ADD CONSTRAINT fk_shipment_requests_transport_contract
    FOREIGN KEY (transport_contract_id) REFERENCES transport_contracts(transport_contract_id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shipment_requests_tenant_id ON shipment_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shipment_requests_status ON shipment_requests(status);
CREATE INDEX IF NOT EXISTS idx_transport_contracts_tenant_id ON transport_contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transport_contracts_status ON transport_contracts(status);

COMMIT;

