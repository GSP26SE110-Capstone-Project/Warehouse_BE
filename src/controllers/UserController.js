/**
 * @fileoverview
 * UserController quản lý các endpoint cho resource `users`:
 *   - POST   /api/users           : admin tạo tài khoản nội bộ
 *   - GET    /api/users           : list
 *   - GET    /api/users/:id       : chi tiết
 *   - PATCH  /api/users/:id       : cập nhật hồ sơ
 *   - POST   /api/users/:id/restore : kích hoạt lại user đã soft-delete
 *   - DELETE /api/users/:id       : soft delete (flip is_active = false)
 *
 * Nguyên tắc thiết kế (xem thêm docs/ARCHITECTURE.md):
 *   - Password luôn hash ở server bằng bcrypt (saltRounds=10). Client gửi plaintext.
 *   - PATCH KHÔNG dùng để đổi mật khẩu: đi qua flow forgot-password/reset-password.
 *   - PATCH KHÔNG dùng để toggle active: đi qua DELETE + POST /:id/restore.
 *   - Admin không tạo được user role `tenant_admin` — end-user phải tự register.
 *   - Response không bao giờ chứa password_hash (delete trong mapper).
 */

import pool from '../config/db.js';
import bcrypt from 'bcrypt';
import { tableName as USER_TABLE } from '../models/User.js';
import { generatePrefixedId } from '../utils/idGenerator.js';
import { revokeAllForUser as revokeAllRefreshTokensForUser } from '../services/RefreshTokenService.js';

/**
 * Số vòng salt bcrypt khi hash password.
 * 10 là trade-off giữa speed và security cho traffic MVP.
 * Mỗi đơn vị tăng lên gấp đôi thời gian hash.
 */
const BCRYPT_SALT_ROUNDS = 10;

/**
 * Whitelist role mà admin được phép tạo qua POST /api/users.
 *
 * `tenant_admin` KHÔNG nằm trong whitelist: end-customer phải tự register
 * qua /api/auth/register để hệ thống xác thực email bằng OTP. Việc này
 * đảm bảo tenant_admin luôn là người thật (chống admin mạo danh) và đi
 * đúng flow tạo implicit tenant.
 *
 * Dùng Set để lookup O(1) thay vì Array.includes O(n).
 */
const ADMIN_CREATABLE_ROLES = new Set(['admin', 'warehouse_staff', 'transport_staff']);

/**
 * Map 1 row từ Postgres (snake_case) sang domain object (camelCase) cho API.
 *
 * Lưu ý:
 * - Trả `tenantId`/`branchId` = null thay vì undefined để FE xử lý nhất quán.
 * - `status` được derive từ `is_active` để backward-compatible với FE cũ
 *   đang đọc `status` ('active' | 'inactive').
 * - `passwordHash` vẫn được map ở đây, nhưng các handler sẽ `delete` ra
 *   trước khi trả response — không được để lộ hash ra ngoài.
 *
 * @param {object} row Row từ query `SELECT * FROM users`.
 * @returns {object|null} Domain object hoặc null nếu row falsy.
 */
function mapUserRow(row) {
  if (!row) return null;
  const derivedStatus = row.status ?? (row.is_active === true ? 'active' : 'inactive');
  return {
    userId: row.user_id,
    tenantId: row.tenant_id ?? null,
    branchId: row.branch_id ?? null,
    username: row.username ?? undefined,
    email: row.email,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role,
    status: derivedStatus,
    isActive: row.is_active ?? derivedStatus === 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * POST /api/users — Admin tạo tài khoản nội bộ.
 *
 * Body yêu cầu:
 *   - email (string, bắt buộc)
 *   - password (string, plaintext, bắt buộc; server tự hash)
 *   - fullName (string, bắt buộc)
 *   - role (string, bắt buộc, phải thuộc ADMIN_CREATABLE_ROLES)
 *   - username (string, optional, mặc định = email)
 *   - phone (string, optional)
 *
 * Các response:
 *   - 201: user mới tạo (không có passwordHash)
 *   - 400: thiếu field hoặc role không hợp lệ
 *   - 401/403: handler ở middleware (requireAuth, requireRoles('admin'))
 *   - 409: email hoặc username trùng (Postgres 23505)
 *
 * Tenant/branch:
 *   - Staff nội bộ không gắn tenant/branch — luôn NULL.
 *   - `is_active` luôn TRUE (bỏ flow kích hoạt thủ công).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function createUser(req, res) {
  try {
    const {
      email,
      password,
      fullName,
      role,
      username: usernameBody,
      phone = null,
    } = req.body;

    const emailTrim = typeof email === 'string' ? email.trim() : '';
    const fullNameTrim = typeof fullName === 'string' ? fullName.trim() : '';
    const passwordStr = typeof password === 'string' ? password : '';
    const roleTrim = typeof role === 'string' ? role.trim() : '';
    const usernameTrim =
      typeof usernameBody === 'string' && usernameBody.trim()
        ? usernameBody.trim()
        : emailTrim;

    if (!emailTrim || !passwordStr || !fullNameTrim || !roleTrim) {
      return res.status(400).json({
        message: 'Thiếu thông tin: email, password, fullName và role là bắt buộc',
      });
    }

    if (!ADMIN_CREATABLE_ROLES.has(roleTrim)) {
      return res.status(400).json({
        message: `role không hợp lệ. Admin chỉ được tạo: ${[...ADMIN_CREATABLE_ROLES].join(', ')}. Với tenant_admin, end-user phải tự register.`,
      });
    }

    const passwordHash = await bcrypt.hash(passwordStr, BCRYPT_SALT_ROUNDS);

    const userId = await generatePrefixedId(pool, {
      tableName: USER_TABLE,
      idColumn: 'user_id',
      prefix: 'USR',
    });

    // Staff nội bộ (admin/warehouse_staff/transport_staff) không thuộc tenant/branch
    // cụ thể nên tenant_id và branch_id để NULL. is_active mặc định TRUE vì mọi
    // tài khoản tạo mới phải luôn hoạt động được (không còn flow kích hoạt thủ công).
    const query = `
      INSERT INTO ${USER_TABLE} (
        user_id,
        tenant_id,
        branch_id,
        username,
        email,
        password_hash,
        full_name,
        phone,
        role,
        is_active
      )
      VALUES ($1, NULL, NULL, $2, $3, $4, $5, $6, $7, TRUE)
      RETURNING *;
    `;

    const values = [
      userId,
      usernameTrim,
      emailTrim,
      passwordHash,
      fullNameTrim,
      phone || null,
      roleTrim,
    ];

    const { rows } = await pool.query(query, values);
    const mapped = mapUserRow(rows[0]);
    delete mapped.passwordHash;
    return res.status(201).json(mapped);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Email hoặc username đã tồn tại' });
    }
    console.error('Error creating user:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * GET /api/users/:id — Chi tiết user theo ID.
 *
 * Hiện tại không yêu cầu auth (endpoint mở). Roadmap sẽ bổ sung
 * requireAuth + cho phép tenant_admin chỉ xem user thuộc tenant mình.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns 200 user | 404 nếu không tồn tại
 */
export async function getUserById(req, res) {
  try {
    const { id } = req.params;
    const query = `
      SELECT *
      FROM ${USER_TABLE}
      WHERE user_id = $1
      LIMIT 1;
    `;
    const { rows } = await pool.query(query, [id]);
    const user = mapUserRow(rows[0]);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(user);
  } catch (err) {
    console.error('Error fetching user by id:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * GET /api/users — List user có phân trang, filter theo status.
 *
 * Query params:
 *   - status: 'active' | 'inactive' (optional) — map sang is_active.
 *   - limit: số (mặc định 50).
 *   - offset: số (mặc định 0).
 *
 * Sort cố định theo created_at DESC. Không expose cột hash.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function listUsers(req, res) {
  try {
    const { status } = req.query;
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;

    const whereClauses = [];
    const values = [];
    let index = 1;

    if (status === 'active' || status === 'inactive') {
      whereClauses.push(`is_active = $${index}`);
      values.push(status === 'active');
      index += 1;
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT *
      FROM ${USER_TABLE}
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT $${index} OFFSET $${index + 1};
    `;

    values.push(limit, offset);
    const { rows } = await pool.query(query, values);
    const users = rows.map(mapUserRow);

    return res.json(users);
  } catch (err) {
    console.error('Error listing users:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * PATCH /api/users/:id — Cập nhật hồ sơ user (admin-only).
 *
 * Body optional fields (gửi ít nhất 1):
 *   - email, fullName, phone, role
 *
 * Giới hạn:
 *   - Nếu có `role` thì phải nằm trong ADMIN_CREATABLE_ROLES (không cho
 *     đẩy user lên `tenant_admin` qua PATCH để tránh mạo danh).
 *   - Không nhận password/passwordHash (đổi mật khẩu qua flow auth riêng).
 *   - Không nhận isActive/status (toggle active qua DELETE + restore).
 *
 * SQL động: chỉ build SET clause cho các field thực sự có trong body.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns 200 user | 400 nếu body rỗng hoặc role sai | 404 nếu id không tồn tại
 */
export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const {
      email,
      fullName,
      phone,
      role,
    } = req.body;

    // PATCH chỉ cập nhật profile. Các flow khác đi qua endpoint chuyên trách:
    //  - Đổi mật khẩu: POST /api/auth/forgot-password -> reset-password (OTP email).
    //  - Vô hiệu hoá: DELETE /api/users/:id.
    //  - Kích hoạt lại: POST /api/users/:id/restore.
    const allowedFieldsMap = {
      email: 'email',
      fullName: 'full_name',
      phone: 'phone',
      role: 'role',
    };

    // Nếu admin đổi role thì phải nằm trong whitelist (giống POST /api/users).
    // Không cho đẩy lên `tenant_admin` qua PATCH để tránh mạo danh tenant.
    if (role !== undefined) {
      const roleTrim = typeof role === 'string' ? role.trim() : '';
      if (!roleTrim || !ADMIN_CREATABLE_ROLES.has(roleTrim)) {
        return res.status(400).json({
          message: `role không hợp lệ. Chỉ được chuyển thành: ${[...ADMIN_CREATABLE_ROLES].join(', ')}.`,
        });
      }
    }

    const setClauses = [];
    const values = [];
    let index = 1;

    const fields = { email, fullName, phone, role };

    for (const [key, dbColumn] of Object.entries(allowedFieldsMap)) {
      if (fields[key] !== undefined) {
        setClauses.push(`${dbColumn} = $${index}`);
        values.push(fields[key]);
        index += 1;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = NOW()`);

    const query = `
      UPDATE ${USER_TABLE}
      SET ${setClauses.join(', ')}
      WHERE user_id = $${index}
      RETURNING *;
    `;

    values.push(id);
    const { rows } = await pool.query(query, values);
    const user = mapUserRow(rows[0]);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(user);
  } catch (err) {
    console.error('Error updating user:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * POST /api/users/:id/restore — Kích hoạt lại user đã bị soft delete (admin-only).
 *
 * Flow:
 *   1. SELECT user_id, is_active FROM users WHERE user_id = $1.
 *   2. Nếu không tìm thấy → 404.
 *   3. Nếu đang active → 409 (idempotent-safe, không phá state).
 *   4. UPDATE is_active = true, updated_at = NOW().
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns 200 { message, user } | 404 | 409
 */
export async function restoreUser(req, res) {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `SELECT user_id, is_active FROM ${USER_TABLE} WHERE user_id = $1 LIMIT 1`,
      [id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (rows[0].is_active === true) {
      return res.status(409).json({ message: 'User đang active, không cần restore' });
    }

    const { rows: updated } = await pool.query(
      `UPDATE ${USER_TABLE}
          SET is_active = true, updated_at = NOW()
        WHERE user_id = $1
        RETURNING *`,
      [id],
    );
    const user = mapUserRow(updated[0]);
    delete user.passwordHash;

    return res.json({
      message: 'Account restored successfully',
      user,
    });
  } catch (err) {
    console.error('Error restoring user:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * DELETE /api/users/:id — Soft deactivate user (admin-only).
 *
 * Không xoá row — chỉ flip `is_active = false` để giữ referential
 * integrity (các bảng contracts, invoices, rental_requests có thể
 * tham chiếu user này).
 *
 * Để kích hoạt lại: POST /api/users/:id/restore.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns 200 { message, user } | 404
 */
export async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    const query = `
      UPDATE ${USER_TABLE}
      SET is_active = false, updated_at = NOW()
      WHERE user_id = $1
      RETURNING *;
    `;

    const { rows } = await pool.query(query, [id]);
    const user = mapUserRow(rows[0]);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Ban/deactivate = revoke mọi refresh token đang sống của user,
    // buộc họ không refresh được access token mới. Access token hiện
    // hành vẫn hợp lệ tới khi hết hạn (stateless JWT) — nhưng TTL ngắn
    // nên ảnh hưởng tối đa vài phút.
    await revokeAllRefreshTokensForUser(user.userId);

    return res.json({
      message: 'Account deactivated successfully',
      user,
    });
  } catch (err) {
    console.error('Error deactivating user:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export default {
  createUser,
  getUserById,
  listUsers,
  updateUser,
  restoreUser,
  deleteUser,
};

