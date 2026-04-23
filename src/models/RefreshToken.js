/**
 * Lưu refresh token đã cấp để hỗ trợ revoke / rotate.
 *
 * Không lưu plaintext token — chỉ lưu SHA-256 hash ở cột `token_hash`.
 * Plain token chỉ về client 1 lần duy nhất khi issue.
 *
 * Schema: init-scripts/21-refresh-tokens.sql
 */
export const tableName = 'refresh_tokens';

export default { tableName };
