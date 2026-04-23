-- =====================================================
-- Bảng refresh_tokens — hỗ trợ refresh token flow cho Auth.
-- =====================================================
-- Thiết kế (xem AuthController + RefreshTokenService):
--   - Access token vẫn là JWT (stateless, TTL ngắn).
--   - Refresh token là OPAQUE string (48 bytes hex) — KHÔNG phải JWT.
--     Lý do: nếu DB bị leak thì chỉ thấy HASH, không replay được;
--            revoke = UPDATE revoked_at, không cần blacklist JWT.
--   - Plain token chỉ trả về client 1 lần (lúc issue). DB chỉ lưu SHA-256 hash.
--   - Rotation: khi /auth/refresh, revoke refresh hiện tại và cấp cặp mới
--     (lookup bằng token_hash; replace_with_id link sang bản mới để detect reuse).
--
-- Detect theft:
--   - Nếu client gửi refresh đã revoked_at NOT NULL → có thể token bị leak
--     (attacker dùng trước). Khi đó server có thể revoke cascade tất cả
--     token chung user_id (xử lý ở service layer).

CREATE TABLE IF NOT EXISTS refresh_tokens (
    token_id VARCHAR(50) PRIMARY KEY,           -- RT<uuid-like> hoặc random hex
    user_id VARCHAR(50) NOT NULL,
    token_hash VARCHAR(128) NOT NULL UNIQUE,    -- SHA-256 hex của plaintext token
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP NULL,                  -- NULL = còn hiệu lực
    replaced_by_id VARCHAR(50) NULL,            -- token mới sau khi rotate (FK self)
    user_agent VARCHAR(500) NULL,
    ip_address VARCHAR(64) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (replaced_by_id) REFERENCES refresh_tokens(token_id) ON DELETE SET NULL
);

-- Lookup nhanh khi client gửi refresh token (join by hash).
CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_hash
    ON refresh_tokens (token_hash);

-- Liệt kê session theo user (dùng cho admin xem device / "logout all").
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active
    ON refresh_tokens (user_id, revoked_at, expires_at);
