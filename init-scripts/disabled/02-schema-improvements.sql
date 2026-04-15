-- ===============================================
-- SCHEMA IMPROVEMENTS - CHECK CONSTRAINTS & VALIDATIONS
-- File này chứa các cải thiện cho schema database
-- ===============================================

-- ===============================================
-- 1. ADD CHECK CONSTRAINTS FOR ENUM VALUES
-- ===============================================

-- User table constraints
ALTER TABLE "User" 
ADD CONSTRAINT chk_user_role 
CHECK (role IN ('admin', 'warehouse_manager', 'delivery_staff', 'customer'));

ALTER TABLE "User" 
ADD CONSTRAINT chk_user_status 
CHECK (status IN ('active', 'inactive', 'suspended'));

-- Employee table constraints
ALTER TABLE Employee 
ADD CONSTRAINT chk_employee_role 
CHECK (role IN ('warehouse_manager', 'delivery_staff', 'admin'));

-- Warehouse table constraints
ALTER TABLE Warehouse 
ADD CONSTRAINT chk_warehouse_type 
CHECK (warehouse_type IN ('cold_storage', 'normal_storage'));

ALTER TABLE Warehouse 
ADD CONSTRAINT chk_warehouse_size 
CHECK (warehouse_size IN ('small', 'medium', 'large', 'extra_large'));

ALTER TABLE Warehouse 
ADD CONSTRAINT chk_warehouse_dimensions 
CHECK (length > 0 AND width > 0 AND height > 0);

-- Zone table constraints
ALTER TABLE Zone 
ADD CONSTRAINT chk_zone_status 
CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved'));

ALTER TABLE Zone 
ADD CONSTRAINT chk_zone_levels 
CHECK (levels >= 1 AND levels <= 4);

ALTER TABLE Zone 
ADD CONSTRAINT chk_zone_dimensions 
CHECK (length > 0 AND width > 0 AND height > 0);

-- RentalRequest table constraints
ALTER TABLE RentalRequest 
ADD CONSTRAINT chk_rental_request_status 
CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));

ALTER TABLE RentalRequest 
ADD CONSTRAINT chk_rental_request_duration_type 
CHECK (rental_duration_type IN ('monthly', 'quarterly', 'yearly', 'custom'));

ALTER TABLE RentalRequest 
ADD CONSTRAINT chk_rental_request_dates 
CHECK (end_date > start_date);

ALTER TABLE RentalRequest 
ADD CONSTRAINT chk_rental_request_custom_days 
CHECK (custom_duration_days IS NULL OR custom_duration_days >= 15);

-- Contract table constraints
ALTER TABLE Contract 
ADD CONSTRAINT chk_contract_status 
CHECK (status IN ('pending', 'active', 'expired', 'terminated'));

ALTER TABLE Contract 
ADD CONSTRAINT chk_contract_dates 
CHECK (end_date > start_date);

-- ImportExportRecord table constraints
ALTER TABLE ImportExportRecord 
ADD CONSTRAINT chk_import_export_record_type 
CHECK (record_type IN ('import', 'export'));

ALTER TABLE ImportExportRecord 
ADD CONSTRAINT chk_import_export_status 
CHECK (status IN ('pending', 'approved', 'completed', 'cancelled'));

-- Shipment table constraints
ALTER TABLE Shipment 
ADD CONSTRAINT chk_shipment_status 
CHECK (status IN ('pending', 'assigned', 'in_transit', 'delivered', 'cancelled'));

-- Invoice table constraints
ALTER TABLE Invoice 
ADD CONSTRAINT chk_invoice_type 
CHECK (invoice_type IN ('rental', 'transportation', 'deposit', 'other'));

ALTER TABLE Invoice 
ADD CONSTRAINT chk_invoice_status 
CHECK (status IN ('unpaid', 'partial', 'paid', 'overdue', 'cancelled'));

ALTER TABLE Invoice 
ADD CONSTRAINT chk_invoice_tax_percentage 
CHECK (tax_percentage >= 0 AND tax_percentage <= 100);

ALTER TABLE Invoice 
ADD CONSTRAINT chk_invoice_amounts 
CHECK (total_amount >= 0 AND paid_amount >= 0 AND balance_amount >= 0);

-- Payment table constraints
ALTER TABLE Payment 
ADD CONSTRAINT chk_payment_method 
CHECK (payment_method IN ('bank_transfer', 'cash', 'credit_card', 'check'));

-- Notification table constraints
ALTER TABLE Notification 
ADD CONSTRAINT chk_notification_type 
CHECK (notification_type IN ('contract_expiry', 'rental_status', 'import_export', 'warehouse_available', 'promotion', 'payment_due'));

-- Promotion table constraints
ALTER TABLE Promotion 
ADD CONSTRAINT chk_promotion_discount_type 
CHECK (discount_type IN ('percentage', 'fixed_amount'));

ALTER TABLE Promotion 
ADD CONSTRAINT chk_promotion_applies_to 
CHECK (applies_to IN ('rental', 'transportation', 'both'));

ALTER TABLE Promotion 
ADD CONSTRAINT chk_promotion_dates 
CHECK (valid_to > valid_from);

ALTER TABLE Promotion 
ADD CONSTRAINT chk_promotion_discount_value 
CHECK (discount_value > 0);

-- SystemLog table constraints
ALTER TABLE SystemLog 
ADD CONSTRAINT chk_system_log_action_type 
CHECK (action_type IN ('create', 'update', 'delete', 'login', 'logout'));

-- TransportationProvider table constraints
ALTER TABLE TransportationProvider 
ADD CONSTRAINT chk_transportation_provider_type 
CHECK (provider_type IN ('internal', 'third_party'));

-- PricingRule table constraints
ALTER TABLE PricingRule 
ADD CONSTRAINT chk_pricing_rule_duration_type 
CHECK (rental_duration_type IN ('monthly', 'quarterly', 'yearly', 'custom'));

ALTER TABLE PricingRule 
ADD CONSTRAINT chk_pricing_rule_dates 
CHECK (effective_to IS NULL OR effective_to > effective_from);

ALTER TABLE PricingRule 
ADD CONSTRAINT chk_pricing_rule_prices 
CHECK (price_per_m2 >= 0 OR price_per_pallet >= 0);

-- LayoutOptimization table constraints
ALTER TABLE LayoutOptimization 
ADD CONSTRAINT chk_layout_optimization_confidence 
CHECK (rag_confidence_score >= 0 AND rag_confidence_score <= 1);

ALTER TABLE LayoutOptimization 
ADD CONSTRAINT chk_layout_optimization_dimensions 
CHECK (input_length > 0 AND input_width > 0 AND input_height > 0);

-- ===============================================
-- 2. ADD NOT NULL CONSTRAINTS
-- ===============================================

-- User table
ALTER TABLE "User" ALTER COLUMN role SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN status SET NOT NULL;

-- Warehouse table
ALTER TABLE Warehouse ALTER COLUMN warehouse_type SET NOT NULL;
ALTER TABLE Warehouse ALTER COLUMN warehouse_size SET NOT NULL;

-- ImportExportRecord table
ALTER TABLE ImportExportRecord ALTER COLUMN record_type SET NOT NULL;

-- Invoice table
ALTER TABLE Invoice ALTER COLUMN invoice_type SET NOT NULL;

-- ===============================================
-- 3. ADD FOREIGN KEY CONSTRAINTS WITH ACTIONS
-- ===============================================

-- Company table
ALTER TABLE Company 
DROP CONSTRAINT IF EXISTS company_user_id_fkey,
ADD CONSTRAINT company_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES "User"(user_id) 
ON DELETE SET NULL ON UPDATE CASCADE;

-- Employee table
ALTER TABLE Employee 
DROP CONSTRAINT IF EXISTS employee_user_id_fkey,
ADD CONSTRAINT employee_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES "User"(user_id) 
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE Employee 
DROP CONSTRAINT IF EXISTS employee_warehouse_id_fkey,
ADD CONSTRAINT employee_warehouse_id_fkey 
FOREIGN KEY (warehouse_id) REFERENCES Warehouse(warehouse_id) 
ON DELETE SET NULL ON UPDATE CASCADE;

-- Contract table
ALTER TABLE Contract 
DROP CONSTRAINT IF EXISTS contract_rental_request_id_fkey,
ADD CONSTRAINT contract_rental_request_id_fkey 
FOREIGN KEY (rental_request_id) REFERENCES RentalRequest(rental_request_id) 
ON DELETE SET NULL ON UPDATE CASCADE;

-- CargoBatch table
ALTER TABLE CargoBatch 
DROP CONSTRAINT IF EXISTS cargo_batch_export_record_id_fkey,
ADD CONSTRAINT cargo_batch_export_record_id_fkey 
FOREIGN KEY (export_record_id) REFERENCES ImportExportRecord(record_id) 
ON DELETE SET NULL ON UPDATE CASCADE;

-- ===============================================
-- 4. ADD PERFORMANCE INDEXES
-- ===============================================

-- User indexes
CREATE INDEX IF NOT EXISTS idx_user_email ON "User"(email);
CREATE INDEX IF NOT EXISTS idx_user_role_status ON "User"(role, status);

-- Company indexes
CREATE INDEX IF NOT EXISTS idx_company_user_id ON Company(user_id);
CREATE INDEX IF NOT EXISTS idx_company_tax_code ON Company(tax_code);

-- Employee indexes
CREATE INDEX IF NOT EXISTS idx_employee_warehouse_id ON Employee(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_employee_role_active ON Employee(role, is_active);

-- Warehouse indexes
CREATE INDEX IF NOT EXISTS idx_warehouse_type_size ON Warehouse(warehouse_type, warehouse_size);
CREATE INDEX IF NOT EXISTS idx_warehouse_city_district ON Warehouse(city, district);

-- Zone indexes
CREATE INDEX IF NOT EXISTS idx_zone_warehouse_status ON Zone(warehouse_id, status);
CREATE INDEX IF NOT EXISTS idx_zone_position ON Zone(warehouse_id, position_row, position_column);

-- Contract indexes
CREATE INDEX IF NOT EXISTS idx_contract_company_status ON Contract(company_id, status);
CREATE INDEX IF NOT EXISTS idx_contract_dates ON Contract(start_date, end_date) 
WHERE status = 'active';

-- ImportExportRecord indexes
CREATE INDEX IF NOT EXISTS idx_import_export_contract_zone ON ImportExportRecord(contract_id, zone_id);
CREATE INDEX IF NOT EXISTS idx_import_export_status_date ON ImportExportRecord(status, scheduled_datetime);

-- Shipment indexes
CREATE INDEX IF NOT EXISTS idx_shipment_provider_status ON Shipment(provider_id, status);
CREATE INDEX IF NOT EXISTS idx_shipment_dates ON Shipment(scheduled_pickup_time, scheduled_delivery_time);

-- Invoice indexes
CREATE INDEX IF NOT EXISTS idx_invoice_company_status ON Invoice(company_id, status);
CREATE INDEX IF NOT EXISTS idx_invoice_due_date ON Invoice(due_date) 
WHERE status IN ('unpaid', 'partial');

-- Payment indexes
CREATE INDEX IF NOT EXISTS idx_payment_invoice ON Payment(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_date ON Payment(payment_date);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notification_user_unread ON Notification(user_id, is_read, sent_at);

-- ===============================================
-- 5. ADD SOFT DELETE COLUMNS (Optional)
-- ===============================================

-- Uncomment if you want to implement soft delete
-- ALTER TABLE "User" ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
-- ALTER TABLE Company ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
-- ALTER TABLE Warehouse ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
-- ALTER TABLE Zone ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
-- ALTER TABLE Contract ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

-- Create partial indexes for soft delete
-- CREATE INDEX IF NOT EXISTS idx_user_active ON "User"(email) WHERE deleted_at IS NULL;
-- CREATE INDEX IF NOT EXISTS idx_warehouse_active ON Warehouse(warehouse_id) WHERE deleted_at IS NULL;

-- ===============================================
-- 6. ADD AUDIT FIELDS (Optional)
-- ===============================================

-- Uncomment if you want to add audit fields
-- ALTER TABLE Company ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES "User"(user_id);
-- ALTER TABLE Company ADD COLUMN IF NOT EXISTS updated_by VARCHAR REFERENCES "User"(user_id);
-- ALTER TABLE Warehouse ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES "User"(user_id);
-- ALTER TABLE Warehouse ADD COLUMN IF NOT EXISTS updated_by VARCHAR REFERENCES "User"(user_id);

-- ===============================================
-- 7. ADD FUNCTIONS FOR AUTO-CALCULATION
-- ===============================================

-- Function to calculate zone area and volume
CREATE OR REPLACE FUNCTION calculate_zone_area()
RETURNS TRIGGER AS $$
BEGIN
  NEW.area = NEW.length * NEW.width;
  NEW.volume = NEW.length * NEW.width * NEW.height * NEW.levels;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate invoice balance
CREATE OR REPLACE FUNCTION calculate_invoice_balance()
RETURNS TRIGGER AS $$
BEGIN
  NEW.balance_amount = NEW.total_amount - COALESCE(NEW.paid_amount, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate invoice item amount
CREATE OR REPLACE FUNCTION calculate_invoice_item_amount()
RETURNS TRIGGER AS $$
BEGIN
  NEW.amount = NEW.quantity * NEW.unit_price;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- 8. ADD TRIGGERS FOR AUTO-CALCULATION
-- ===============================================

-- Trigger for Zone area/volume calculation
DROP TRIGGER IF EXISTS trigger_calculate_zone_area ON Zone;
CREATE TRIGGER trigger_calculate_zone_area
BEFORE INSERT OR UPDATE OF length, width, height, levels
ON Zone
FOR EACH ROW
EXECUTE FUNCTION calculate_zone_area();

-- Trigger for Invoice balance calculation
DROP TRIGGER IF EXISTS trigger_calculate_invoice_balance ON Invoice;
CREATE TRIGGER trigger_calculate_invoice_balance
BEFORE INSERT OR UPDATE OF total_amount, paid_amount
ON Invoice
FOR EACH ROW
EXECUTE FUNCTION calculate_invoice_balance();

-- Trigger for InvoiceItem amount calculation
DROP TRIGGER IF EXISTS trigger_calculate_invoice_item_amount ON InvoiceItem;
CREATE TRIGGER trigger_calculate_invoice_item_amount
BEFORE INSERT OR UPDATE OF quantity, unit_price
ON InvoiceItem
FOR EACH ROW
EXECUTE FUNCTION calculate_invoice_item_amount();

-- ===============================================
-- 9. ADD COMPOSITE UNIQUE CONSTRAINTS
-- ===============================================

-- PricingRule: Prevent duplicate pricing rules
CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_rule_unique 
ON PricingRule(warehouse_id, zone_id, rental_duration_type, effective_from) 
WHERE is_active = true;

-- ===============================================
-- 10. ADD EMAIL VALIDATION (Optional)
-- ===============================================

-- Uncomment if you want strict email validation
-- ALTER TABLE "User" 
-- ADD CONSTRAINT chk_user_email_format 
-- CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- ALTER TABLE Company 
-- ADD CONSTRAINT chk_company_email_format 
-- CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- ===============================================
-- NOTES
-- ===============================================
-- 1. Run this script AFTER creating the base schema
-- 2. Some constraints may fail if existing data violates them
-- 3. Review and fix any data issues before applying constraints
-- 4. Test thoroughly in development before applying to production
-- 5. Consider creating a backup before running this script
