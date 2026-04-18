import pool from '../config/db.js';
import { tableName as USER_TABLE } from '../models/User.js';
import { generatePrefixedId } from '../utils/idGenerator.js';

// Map DB row -> domain object (camelCase cho phía API)
function mapUserRow(row) {
  if (!row) return null;
  const derivedStatus = row.status ?? (row.is_active === true ? 'active' : 'inactive');
  return {
    userId: row.user_id,
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

// POST /users
export async function createUser(req, res) {
  try {
    const {
      email,
      passwordHash, // đã hash sẵn ở middleware/service
      fullName,
      phone = null,
      role = 'tenant',
      status = 'active',
    } = req.body;
    const userId = await generatePrefixedId(pool, {
      tableName: USER_TABLE,
      idColumn: 'user_id',
      prefix: 'USR',
    });

    const isActive = status === 'active';

    const query = `
      INSERT INTO ${USER_TABLE} (
        user_id,
        email,
        password_hash,
        full_name,
        phone,
        role,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;

    const values = [userId, email, passwordHash, fullName, phone, role, isActive];
    const { rows } = await pool.query(query, values);

    return res.status(201).json(mapUserRow(rows[0]));
  } catch (err) {
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
      status,
      isActive,
      passwordHash, // đã hash sẵn nếu có đổi mật khẩu
    } = req.body;

    const allowedFieldsMap = {
      email: 'email',
      fullName: 'full_name',
      phone: 'phone',
      role: 'role',
      passwordHash: 'password_hash',
    };

    const setClauses = [];
    const values = [];
    let index = 1;

    const fields = { email, fullName, phone, role, passwordHash };

    for (const [key, dbColumn] of Object.entries(allowedFieldsMap)) {
      if (fields[key] !== undefined) {
        setClauses.push(`${dbColumn} = $${index}`);
        values.push(fields[key]);
        index += 1;
      }
    }

    if (isActive !== undefined) {
      setClauses.push(`is_active = $${index}`);
      values.push(Boolean(isActive));
      index += 1;
    } else if (status !== undefined) {
      if (status !== 'active' && status !== 'inactive') {
        return res.status(400).json({ message: 'status must be "active" or "inactive"' });
      }
      setClauses.push(`is_active = $${index}`);
      values.push(status === 'active');
      index += 1;
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
  deleteUser,
};

