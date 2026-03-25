-- =====================================================
-- Database Migration: Complete Schema với Foreign Keys
-- =====================================================
-- File này định nghĩa toàn bộ schema với constraints

-- =====================================================
-- 1. NHÓM QUẢN TRỊ & NGƯỜI DÙNG
-- =====================================================

CREATE TABLE IF NOT EXISTS tenants (
    tenant_id VARCHAR(50) PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    tax_code VARCHAR(50) NOT NULL UNIQUE,
    contact_email VARCHAR(255) NOT NULL UNIQUE,
    contact_phone VARCHAR(20),
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS branches (
    branch_id VARCHAR(50) PRIMARY KEY,
    manager_id VARCHAR(50),
    branch_code VARCHAR(100) NOT NULL UNIQUE,
    branch_name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- Foreign Key: manager_id -> users.user_id (sẽ thêm sau tạo users)
);

CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50),
    branch_id VARCHAR(50),
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'warehouse_manager', 'warehouse_staff', 'transport_staff', 'tenant_admin')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE SET NULL,
    FOREIGN KEY (branch_id) REFERENCES branches(branch_id) ON DELETE SET NULL
);

-- Thêm foreign key cho branches.manager_id sau khi users được tạo
ALTER TABLE branches 
ADD CONSTRAINT fk_branches_manager_id 
FOREIGN KEY (manager_id) REFERENCES users(user_id) ON DELETE SET NULL;

-- =====================================================
-- 2. NHÓM KHÔNG GIAN KHO BÃI
-- =====================================================

CREATE TABLE IF NOT EXISTS warehouses (
    warehouse_id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL,
    manager_id VARCHAR(50),
    warehouse_code VARCHAR(100) NOT NULL UNIQUE,
    warehouse_name VARCHAR(255) NOT NULL,
    warehouse_type VARCHAR(50) NOT NULL CHECK (warehouse_type IN ('cold_storage', 'normal_storage')),
    warehouse_size VARCHAR(50) CHECK (warehouse_size IN ('small', 'medium', 'large', 'extra_large')),
    address TEXT NOT NULL,
    city VARCHAR(100),
    district VARCHAR(100),
    operating_hours VARCHAR(255),
    length DECIMAL(10, 2) NOT NULL,
    width DECIMAL(10, 2) NOT NULL,
    height DECIMAL(10, 2) NOT NULL,
    total_area DECIMAL(10, 2),
    usable_area DECIMAL(10, 2),
    temperature_min DECIMAL(5, 2),
    temperature_max DECIMAL(5, 2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(branch_id) ON DELETE CASCADE,
    FOREIGN KEY (manager_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS zones (
    zone_id VARCHAR(50) PRIMARY KEY,
    warehouse_id VARCHAR(50) NOT NULL,
    zone_code VARCHAR(50) NOT NULL,
    zone_name VARCHAR(255),
    zone_type VARCHAR(50) CHECK (zone_type IN ('cold_storage', 'normal_storage')),
    length DECIMAL(10, 2) NOT NULL,
    width DECIMAL(10, 2) NOT NULL,
    total_area DECIMAL(10, 2),
    is_rented BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,
    UNIQUE(warehouse_id, zone_code)
);

CREATE TABLE IF NOT EXISTS racks (
    rack_id VARCHAR(50) PRIMARY KEY,
    zone_id VARCHAR(50) NOT NULL,
    rack_code VARCHAR(50) NOT NULL,
    rack_size_type VARCHAR(50) CHECK (rack_size_type IN ('small', 'medium', 'large')),
    length DECIMAL(10, 2) NOT NULL,
    width DECIMAL(10, 2) NOT NULL,
    height DECIMAL(10, 2) NOT NULL,
    max_weight_capacity DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (zone_id) REFERENCES zones(zone_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS levels (
    level_id VARCHAR(50) PRIMARY KEY,
    rack_id VARCHAR(50) NOT NULL,
    level_number INTEGER NOT NULL,
    height_clearance DECIMAL(10, 2),
    max_weight DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rack_id) REFERENCES racks(rack_id) ON DELETE CASCADE,
    UNIQUE(rack_id, level_number)
);

CREATE TABLE IF NOT EXISTS slots (
    slot_id VARCHAR(50) PRIMARY KEY,
    level_id VARCHAR(50) NOT NULL,
    slot_code VARCHAR(50) NOT NULL UNIQUE,
    length DECIMAL(10, 2) NOT NULL,
    width DECIMAL(10, 2) NOT NULL,
    height DECIMAL(10, 2) NOT NULL,
    volume DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'EMPTY' CHECK (status IN ('EMPTY', 'RENTED', 'MAINTENANCE')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (level_id) REFERENCES levels(level_id) ON DELETE CASCADE
);

-- =====================================================
-- 3. NHÓM HỢP ĐỒNG & CHO THUÊ
-- =====================================================

CREATE TABLE IF NOT EXISTS rental_requests (
    request_id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    requested_start_date DATE NOT NULL,
    duration_days INTEGER NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contracts (
    contract_id VARCHAR(50) PRIMARY KEY,
    request_id VARCHAR(50),
    tenant_id VARCHAR(50) NOT NULL,
    approved_by VARCHAR(50),
    contract_code VARCHAR(50) NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    billing_cycle VARCHAR(50) CHECK (billing_cycle IN ('QUARTER', 'MONTH', 'YEAR', 'CUSTOM')),
    rental_duration_days INTEGER,
    total_rental_fee DECIMAL(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES rental_requests(request_id) ON DELETE SET NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS contract_items (
    item_id VARCHAR(50) PRIMARY KEY,
    contract_id VARCHAR(50) NOT NULL,
    rent_type VARCHAR(50) NOT NULL CHECK (rent_type IN ('ENTIRE_WAREHOUSE', 'ZONE', 'SLOT')),
    warehouse_id VARCHAR(50),
    zone_id VARCHAR(50),
    slot_id VARCHAR(50),
    unit_price DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,
    FOREIGN KEY (zone_id) REFERENCES zones(zone_id) ON DELETE CASCADE,
    FOREIGN KEY (slot_id) REFERENCES slots(slot_id) ON DELETE CASCADE
);

-- =====================================================
-- 4. NHÓM QUẢN LÝ VẬN CHUYỂN & HÀNG HÓA
-- =====================================================

CREATE TABLE IF NOT EXISTS transport_providers (
    provider_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    provider_type VARCHAR(50) CHECK (provider_type IN ('INTERNAL', 'EXTERNAL')),
    contact_info VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transport_stations (
    station_id VARCHAR(50) PRIMARY KEY,
    provider_id VARCHAR(50) NOT NULL,
    station_name VARCHAR(255) NOT NULL,
    address TEXT,
    manager_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES transport_providers(provider_id) ON DELETE CASCADE,
    FOREIGN KEY (manager_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS shipments (
    shipment_id VARCHAR(50) PRIMARY KEY,
    contract_id VARCHAR(50) NOT NULL,
    shipment_type VARCHAR(50) NOT NULL CHECK (shipment_type IN ('IMPORT', 'EXPORT')),
    provider_id VARCHAR(50),
    driver_id VARCHAR(50),
    supervisor_id VARCHAR(50),
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    scheduled_time TIMESTAMP,
    actual_start_time TIMESTAMP,
    actual_end_time TIMESTAMP,
    total_weight DECIMAL(10, 2),
    total_distance DECIMAL(10, 2),
    shipping_fee DECIMAL(15, 2),
    status VARCHAR(50) DEFAULT 'SCHEDULING' CHECK (status IN ('SCHEDULING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE,
    FOREIGN KEY (provider_id) REFERENCES transport_providers(provider_id) ON DELETE SET NULL,
    FOREIGN KEY (driver_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (supervisor_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS qr_tags (
    tag_id VARCHAR(50) PRIMARY KEY,
    shipment_id VARCHAR(50) NOT NULL,
    slot_id VARCHAR(50),
    qr_code VARCHAR(100) NOT NULL UNIQUE,
    product_details TEXT,
    status VARCHAR(50) CHECK (status IN ('IN_TRANSIT', 'STORED', 'DISPATCHED')),
    scanned_in_at TIMESTAMP,
    scanned_in_by VARCHAR(50),
    scanned_out_at TIMESTAMP,
    scanned_out_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id) ON DELETE CASCADE,
    FOREIGN KEY (slot_id) REFERENCES slots(slot_id) ON DELETE SET NULL,
    FOREIGN KEY (scanned_in_by) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (scanned_out_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- =====================================================
-- 5. NHÓM THÔNG BÁO
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications (
    notification_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('CONTRACT_EXPIRING', 'REQUEST_STATUS', 'SHIPMENT_TRACKING', 'PROMOTION', 'EMPTY_WAREHOUSE')),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- =====================================================
-- 6. NHÓM QUẢN LÝ GIÁ CẢ & THANH TOÁN
-- =====================================================

CREATE TABLE IF NOT EXISTS pricing_rules (
    pricing_rule_id VARCHAR(50) PRIMARY KEY,
    warehouse_id VARCHAR(50),
    zone_id VARCHAR(50),
    rent_type VARCHAR(50) NOT NULL CHECK (rent_type IN ('ENTIRE_WAREHOUSE', 'ZONE', 'SLOT')),
    min_days INTEGER NOT NULL,
    max_days INTEGER,
    price_per_day DECIMAL(15, 2),
    price_per_m2 DECIMAL(15, 2),
    price_per_pallet DECIMAL(15, 2),
    billing_cycle VARCHAR(50) CHECK (billing_cycle IN ('DAILY', 'MONTHLY', 'QUARTERLY', 'YEARLY')),
    bulk_discount_pct DECIMAL(5, 2),
    is_active BOOLEAN DEFAULT TRUE,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,
    FOREIGN KEY (zone_id) REFERENCES zones(zone_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoices (
    invoice_id VARCHAR(50) PRIMARY KEY,
    contract_id VARCHAR(50) NOT NULL,
    tenant_id VARCHAR(50) NOT NULL,
    invoice_code VARCHAR(50) NOT NULL UNIQUE,
    invoice_type VARCHAR(50) CHECK (invoice_type IN ('RENTAL', 'TRANSPORTATION', 'DEPOSIT', 'OTHER')),
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal DECIMAL(15, 2) NOT NULL,
    tax_percentage DECIMAL(5, 2) DEFAULT 10,
    tax_amount DECIMAL(15, 2) NOT NULL,
    total_amount DECIMAL(15, 2) NOT NULL,
    paid_amount DECIMAL(15, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
    payment_id VARCHAR(50) PRIMARY KEY,
    invoice_id VARCHAR(50),
    contract_id VARCHAR(50) NOT NULL,
    tenant_id VARCHAR(50) NOT NULL,
    payment_code VARCHAR(50) NOT NULL UNIQUE,
    payment_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('BANK_TRANSFER', 'CASH', 'CHECK', 'CREDIT_CARD', 'DIGITAL_WALLET')),
    transaction_code VARCHAR(100),
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    processed_by VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE SET NULL,
    FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    FOREIGN KEY (processed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- =====================================================
-- 7. NHÓM KHUYẾN MÃI
-- =====================================================

CREATE TABLE IF NOT EXISTS promotions (
    promotion_id VARCHAR(50) PRIMARY KEY,
    promotion_code VARCHAR(50) NOT NULL UNIQUE,
    promotion_name VARCHAR(255) NOT NULL,
    description TEXT,
    discount_type VARCHAR(50) NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT')),
    discount_value DECIMAL(15, 2) NOT NULL,
    applicable_to VARCHAR(50) NOT NULL CHECK (applicable_to IN ('ENTIRE_WAREHOUSE', 'ZONE', 'SLOT', 'ALL')),
    min_rental_days INTEGER,
    min_rental_value DECIMAL(15, 2),
    max_discount DECIMAL(15, 2),
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    max_usage INTEGER,
    current_usage INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 8. NHÓM AUDIT & LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50),
    action VARCHAR(50) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'EXPORT', 'IMPORT')),
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(50) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    description TEXT,
    ip_address VARCHAR(50),
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_warehouses_branch_id ON warehouses(branch_id);
CREATE INDEX idx_zones_warehouse_id ON zones(warehouse_id);
CREATE INDEX idx_slots_status ON slots(status);
CREATE INDEX idx_contracts_tenant_id ON contracts(tenant_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_rental_requests_tenant_id ON rental_requests(tenant_id);
CREATE INDEX idx_rental_requests_status ON rental_requests(status);
CREATE INDEX idx_shipments_contract_id ON shipments(contract_id);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_invoices_contract_id ON invoices(contract_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_payments_contract_id ON payments(contract_id);
CREATE INDEX idx_qr_tags_qr_code ON qr_tags(qr_code);
