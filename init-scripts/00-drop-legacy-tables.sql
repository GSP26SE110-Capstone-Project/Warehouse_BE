-- =====================================================
-- Database Migration: Drop Legacy Tables
-- =====================================================
-- Xóa các bảng models cũ không còn sử dụng

-- Drop tables in reverse dependency order (child tables first)

-- Drop legacy tables that are no longer needed
DROP TABLE IF EXISTS layout_optimization_feedbacks CASCADE;
DROP TABLE IF EXISTS layout_optimizations CASCADE;
DROP TABLE IF EXISTS pallet_rows CASCADE;
DROP TABLE IF EXISTS pallet_templates CASCADE;
DROP TABLE IF EXISTS row_availability_summaries CASCADE;
DROP TABLE IF EXISTS cargo_batches CASCADE;
DROP TABLE IF EXISTS import_export_records CASCADE;
DROP TABLE IF EXISTS warehouse_layouts CASCADE;
DROP TABLE IF EXISTS transportation_hubs CASCADE;
DROP TABLE IF EXISTS transportation_price_rules CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;

-- Drop old contract/employee/company tables (replaced by new models)
DROP TABLE IF EXISTS contract_zones CASCADE;
DROP TABLE IF EXISTS contract_rows CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS system_logs CASCADE;

-- Note: Keep all active tables from the current schema.