/**
 * JwtService — sinh/verify access token cho API.
 *
 * Access token: JWT ký HS256, stateless (không đọc DB khi verify).
 *   - TTL ngắn (mặc định 15 phút) để giảm thiệt hại khi bị leak.
 *   - Client hết hạn thì dùng refresh token gọi /api/auth/refresh
 *     (xem RefreshTokenService.js) để lấy access token mới.
 *
 * Refresh token KHÔNG phải JWT — là random opaque string, quản lý ở
 * RefreshTokenService.js (lưu hash trong bảng refresh_tokens).
 *
 * ENV:
 *   - JWT_SECRET            Secret HMAC (bắt buộc set ở production).
 *   - JWT_ACCESS_EXPIRES_IN Format ms / jsonwebtoken (vd: '15m', '1h'). Default '15m'.
 *   - JWT_EXPIRES_IN        (legacy) Fallback khi chưa set JWT_ACCESS_EXPIRES_IN.
 */

import jwt from 'jsonwebtoken';

const DEFAULT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';

/**
 * TTL access token. Ưu tiên JWT_ACCESS_EXPIRES_IN, fallback JWT_EXPIRES_IN
 * để không phá deploy cũ đang set biến này. Default 15m — ngắn vừa đủ
 * để refresh token flow có ý nghĩa.
 */
const ACCESS_TOKEN_EXPIRES_IN =
  process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '15m';

function buildClaims(user) {
  return {
    userId: user.userId,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

export function signAccessToken(user) {
  return jwt.sign(buildClaims(user), DEFAULT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, DEFAULT_SECRET);
}

export const accessTokenExpiresIn = ACCESS_TOKEN_EXPIRES_IN;
