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
    created_by VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_shipment_requests_tenant_id ON shipment_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shipment_requests_status ON shipment_requests(status);

COMMIT;

