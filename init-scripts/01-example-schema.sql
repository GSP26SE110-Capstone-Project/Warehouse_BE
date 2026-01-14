-- File này là VÍ DỤ về cách tạo schema
-- PostgreSQL sẽ tự động chạy các file .sql trong thư mục init-scripts/
-- khi database được khởi tạo lần đầu

-- Lưu ý: File này chỉ chạy khi database MỚI được tạo
-- Nếu database đã tồn tại, file này sẽ KHÔNG chạy

-- Ví dụ: Tạo bảng users
-- CREATE TABLE IF NOT EXISTS users (
--     id SERIAL PRIMARY KEY,
--     username VARCHAR(50) UNIQUE NOT NULL,
--     email VARCHAR(100) UNIQUE NOT NULL,
--     password_hash VARCHAR(255) NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- Ví dụ: Tạo bảng products
-- CREATE TABLE IF NOT EXISTS products (
--     id SERIAL PRIMARY KEY,
--     name VARCHAR(255) NOT NULL,
--     description TEXT,
--     price DECIMAL(10, 2) NOT NULL,
--     stock_quantity INTEGER DEFAULT 0,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- Bạn có thể tạo các bảng khác ở đây
-- Sau đó tạo file 02-seed-data.sql để insert dữ liệu mẫu

