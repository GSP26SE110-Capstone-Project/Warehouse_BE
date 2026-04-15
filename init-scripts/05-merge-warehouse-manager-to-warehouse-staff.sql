-- =====================================================
-- Data Migration: Merge warehouse_manager into warehouse_staff
-- =====================================================
-- Mục đích:
--   1) Chuyển toàn bộ user có role = 'warehouse_manager' sang 'warehouse_staff'
--   2) Đảm bảo dữ liệu hợp lệ với CHECK constraint role mới
--
-- Script này an toàn để chạy nhiều lần (idempotent).

BEGIN;

UPDATE users
SET role = 'warehouse_staff',
    updated_at = CURRENT_TIMESTAMP
WHERE role = 'warehouse_manager';

COMMIT;
