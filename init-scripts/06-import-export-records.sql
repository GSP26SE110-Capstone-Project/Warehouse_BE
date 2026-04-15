-- =====================================================
-- IMPORT / EXPORT RECORDS
-- Luu y: file init-scripts chi auto-run khi database tao moi.
-- Neu DB da ton tai, hay chay file nay thu cong.
-- =====================================================

CREATE TABLE IF NOT EXISTS import_export_records (
    record_id VARCHAR(50) PRIMARY KEY,
    contract_id VARCHAR(50) NOT NULL,
    warehouse_id VARCHAR(50) NOT NULL,
    scope_type VARCHAR(20) NOT NULL DEFAULT 'ZONE'
        CHECK (scope_type IN ('WAREHOUSE', 'ZONE', 'SLOT')),
    zone_id VARCHAR(50),
    slot_id VARCHAR(50),
    record_type VARCHAR(20) NOT NULL
        CHECK (record_type IN ('IMPORT', 'EXPORT')),
    record_code VARCHAR(100) NOT NULL UNIQUE,
    scheduled_datetime TIMESTAMP NOT NULL,
    actual_datetime TIMESTAMP,
    quantity DECIMAL(15, 3),
    weight DECIMAL(15, 3),
    is_full_zone BOOLEAN DEFAULT FALSE,
    responsible_staff_id VARCHAR(50),
    approved_by VARCHAR(50),
    approved_at TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED')),
    cancel_reason TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,
    FOREIGN KEY (zone_id) REFERENCES zones(zone_id) ON DELETE SET NULL,
    FOREIGN KEY (slot_id) REFERENCES slots(slot_id) ON DELETE SET NULL,
    FOREIGN KEY (responsible_staff_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_import_export_records_contract_id
    ON import_export_records(contract_id);

CREATE INDEX IF NOT EXISTS idx_import_export_records_warehouse_id
    ON import_export_records(warehouse_id);

CREATE INDEX IF NOT EXISTS idx_import_export_records_record_type
    ON import_export_records(record_type);

CREATE INDEX IF NOT EXISTS idx_import_export_records_scheduled_datetime
    ON import_export_records(scheduled_datetime);

CREATE INDEX IF NOT EXISTS idx_import_export_records_status
    ON import_export_records(status);

