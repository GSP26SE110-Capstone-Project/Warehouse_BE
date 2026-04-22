import pool from '../config/db.js';
import bcrypt from 'bcrypt';
import { tableName as USER_TABLE } from '../models/User.js';
import { generatePrefixedId } from '../utils/idGenerator.js';

const BCRYPT_SALT_ROUNDS = 10;

// Role mà admin được phép tạo qua POST /api/users.
// `tenant_admin` KHÔNG nằm trong whitelist: người dùng end-customer phải tự register
// qua /api/auth/register để xác thực email/OTP, admin không tạo thay.
const ADMIN_CREATABLE_ROLES = new Set(['admin', 'warehouse_staff', 'transport_staff']);

// Map DB row -> domain object (camelCase cho phía API)
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

// POST /users — Admin tạo tài khoản nội bộ (admin / warehouse_staff / transport_staff)
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

// GET /users/:id
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

// GET /users?status=active&limit=50&offset=0
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

// PATCH /users/:id
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

// POST /users/:id/restore - Kích hoạt lại account đã bị soft-delete (admin)
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

// DELETE /users/:id - Deactivate account (admin)
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

