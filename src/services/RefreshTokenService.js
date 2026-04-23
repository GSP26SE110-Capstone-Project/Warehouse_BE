/**
 * RefreshTokenService — sinh, verify, revoke, rotate refresh token.
 *
 * Chiến lược (khác với access token ở JwtService.js):
 *   - Refresh token là OPAQUE random string (48 bytes → 96 ký tự hex),
 *     KHÔNG chứa payload có thể decode. Lý do:
 *       * Nếu leak thì không lộ userId/email như JWT.
 *       * Server có thể revoke bằng cách update DB (không cần blacklist).
 *   - DB chỉ lưu SHA-256 hash; plaintext chỉ về client 1 lần lúc issue.
 *   - TTL mặc định 30 ngày (ENV: JWT_REFRESH_EXPIRES_IN_DAYS).
 *
 * Công dụng các hàm:
 *   - issueRefreshToken(userId, context):
 *       Sinh token mới, lưu DB, trả { plainToken, tokenId, expiresAt }.
 *   - verifyAndConsumeRefreshToken(plainToken):
 *       Verify + phát hiện reuse. Dùng trong /api/auth/refresh (phase #3).
 *   - revokeRefreshToken(plainToken): đánh dấu revoked (logout).
 *   - revokeAllForUser(userId): logout all devices (khi ban / đổi password).
 *
 * Schema DB: init-scripts/21-refresh-tokens.sql.
 */

import crypto from 'crypto';
import pool from '../config/db.js';
import { tableName as REFRESH_TOKEN_TABLE } from '../models/RefreshToken.js';

/**
 * Số ngày sống của refresh token. Không dùng format 'Xd' của jsonwebtoken
 * vì refresh token không phải JWT — server tự tính `expires_at`.
 */
const REFRESH_EXPIRES_IN_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_IN_DAYS || 30);

/**
 * Số bytes random cho plaintext token.
 * 48 bytes → 96 ký tự hex, đủ entropy (~384-bit) để không brute-force.
 */
const TOKEN_BYTES = 48;

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function generatePlainToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

function generateTokenId() {
  return `RT${crypto.randomBytes(16).toString('hex')}`;
}

function computeExpiresAt() {
  const now = Date.now();
  const ttlMs = REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000;
  return new Date(now + ttlMs);
}

/**
 * Sinh refresh token mới và persist vào DB.
 *
 * @param {string} userId
 * @param {object} [context]
 * @param {string} [context.userAgent] - req.headers['user-agent'] (để audit).
 * @param {string} [context.ipAddress] - req.ip (để audit).
 * @param {import('pg').PoolClient} [context.client] - client đã BEGIN nếu nằm trong transaction.
 * @returns {Promise<{ plainToken: string, tokenId: string, expiresAt: Date }>}
 */
export async function issueRefreshToken(userId, context = {}) {
  const { userAgent = null, ipAddress = null, client = null } = context;
  const plainToken = generatePlainToken();
  const tokenId = generateTokenId();
  const tokenHash = sha256Hex(plainToken);
  const expiresAt = computeExpiresAt();

  const query = `
    INSERT INTO ${REFRESH_TOKEN_TABLE} (
      token_id, user_id, token_hash, expires_at, user_agent, ip_address
    )
    VALUES ($1, $2, $3, $4, $5, $6);
  `;
  const values = [
    tokenId,
    userId,
    tokenHash,
    expiresAt,
    userAgent ? String(userAgent).slice(0, 500) : null,
    ipAddress ? String(ipAddress).slice(0, 64) : null,
  ];

  const executor = client || pool;
  await executor.query(query, values);

  return { plainToken, tokenId, expiresAt };
}

/**
 * Verify refresh token và detect reuse.
 *
 * - Không tìm thấy: { valid: false, reason: 'not_found' }.
 * - Hết hạn: { valid: false, reason: 'expired' }.
 * - Đã revoke: { valid: false, reason: 'revoked', userId } — caller nên
 *   revoke toàn bộ token của user này (detected reuse = có khả năng leak).
 * - Hợp lệ: { valid: true, row } với row là raw DB row.
 *
 * KHÔNG tự xoá/revoke ở đây — để controller quyết định hành vi (rotate, revoke all…).
 *
 * @param {string} plainToken
 * @returns {Promise<{ valid: boolean, reason?: string, row?: object, userId?: string }>}
 */
export async function verifyRefreshToken(plainToken) {
  if (!plainToken || typeof plainToken !== 'string') {
    return { valid: false, reason: 'not_found' };
  }

  const tokenHash = sha256Hex(plainToken);
  const { rows } = await pool.query(
    `SELECT * FROM ${REFRESH_TOKEN_TABLE} WHERE token_hash = $1 LIMIT 1`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) return { valid: false, reason: 'not_found' };

  if (row.revoked_at) {
    return { valid: false, reason: 'revoked', userId: row.user_id };
  }
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return { valid: false, reason: 'expired', userId: row.user_id };
  }

  return { valid: true, row };
}

/**
 * Revoke 1 refresh token (logout một phiên).
 * Idempotent: gọi nhiều lần không lỗi.
 *
 * @param {string} plainToken
 * @returns {Promise<boolean>} true nếu có row được update.
 */
export async function revokeRefreshToken(plainToken) {
  if (!plainToken || typeof plainToken !== 'string') return false;
  const tokenHash = sha256Hex(plainToken);
  const { rowCount } = await pool.query(
    `UPDATE ${REFRESH_TOKEN_TABLE}
        SET revoked_at = CURRENT_TIMESTAMP
      WHERE token_hash = $1
        AND revoked_at IS NULL`,
    [tokenHash],
  );
  return rowCount > 0;
}

/**
 * Revoke tất cả refresh token của 1 user (logout all devices).
 * Dùng khi: user đổi mật khẩu, admin ban user, phát hiện reuse.
 *
 * @param {string} userId
 * @param {import('pg').PoolClient} [client] - nếu đang trong transaction.
 * @returns {Promise<number>} số token bị revoke.
 */
export async function revokeAllForUser(userId, client = null) {
  if (!userId) return 0;
  const executor = client || pool;
  const { rowCount } = await executor.query(
    `UPDATE ${REFRESH_TOKEN_TABLE}
        SET revoked_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
        AND revoked_at IS NULL`,
    [userId],
  );
  return rowCount;
}

/**
 * Đánh dấu 1 token cũ đã được thay thế bởi token mới (chain rotation).
 * Gọi sau khi issue token mới thành công trong flow /auth/refresh.
 *
 * @param {string} oldTokenId
 * @param {string} newTokenId
 * @param {import('pg').PoolClient} [client]
 */
export async function markReplacedBy(oldTokenId, newTokenId, client = null) {
  const executor = client || pool;
  await executor.query(
    `UPDATE ${REFRESH_TOKEN_TABLE}
        SET revoked_at = CURRENT_TIMESTAMP,
            replaced_by_id = $2
      WHERE token_id = $1
        AND revoked_at IS NULL`,
    [oldTokenId, newTokenId],
  );
}

export const refreshTokenExpiresInDays = REFRESH_EXPIRES_IN_DAYS;
