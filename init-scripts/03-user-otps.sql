-- =====================================================
-- Bảng OTP cho user (đăng ký / quên mật khẩu)
-- =====================================================
-- Chạy file này nếu database đã tồn tại trước khi bảng được thêm vào 03-complete-schema-with-fk.sql
-- Docker init: file chạy sau 03; CREATE IF NOT EXISTS an toàn khi bảng đã có.

CREATE TABLE IF NOT EXISTS user_otps (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('register', 'forgot_password')),
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_otps_user_type_created ON user_otps (user_id, type, created_at DESC);
