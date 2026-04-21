-- =====================================================
-- SHIPMENT PACKAGES
-- Luu thong tin tung don vi hang hoa vat ly (thung/cuc/pallet)
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS shipment_packages (
    package_id VARCHAR(50) PRIMARY KEY,
    shipment_id VARCHAR(50) NOT NULL,
    import_export_record_id VARCHAR(50),
    slot_id VARCHAR(50),
    package_code VARCHAR(100) NOT NULL UNIQUE,
    code_value VARCHAR(255) NOT NULL UNIQUE,
    code_type VARCHAR(20) NOT NULL DEFAULT 'CODE128'
        CHECK (code_type IN ('CODE128', 'QRCODE')),
    quantity DECIMAL(15, 3),
    weight DECIMAL(15, 3),
    volume DECIMAL(15, 3),
    product_details TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'CREATED'
        CHECK (status IN ('CREATED', 'IN_TRANSIT', 'STORED', 'DISPATCHED', 'CANCELLED')),
    printed_at TIMESTAMP,
    scanned_in_at TIMESTAMP,
    scanned_in_by VARCHAR(50),
    scanned_out_at TIMESTAMP,
    scanned_out_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id) ON DELETE CASCADE,
    FOREIGN KEY (import_export_record_id) REFERENCES import_export_records(record_id) ON DELETE SET NULL,
    FOREIGN KEY (slot_id) REFERENCES slots(slot_id) ON DELETE SET NULL,
    FOREIGN KEY (scanned_in_by) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (scanned_out_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_shipment_packages_shipment_id
    ON shipment_packages(shipment_id);

CREATE INDEX IF NOT EXISTS idx_shipment_packages_import_export_record_id
    ON shipment_packages(import_export_record_id);

CREATE INDEX IF NOT EXISTS idx_shipment_packages_slot_id
    ON shipment_packages(slot_id);

CREATE INDEX IF NOT EXISTS idx_shipment_packages_package_code
    ON shipment_packages(package_code);

CREATE INDEX IF NOT EXISTS idx_shipment_packages_code_value
    ON shipment_packages(code_value);

CREATE INDEX IF NOT EXISTS idx_shipment_packages_status
    ON shipment_packages(status);

COMMIT;
