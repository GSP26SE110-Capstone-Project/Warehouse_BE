import pool from '../config/db.js';
import { tableName as BRANCH_TABLE } from '../models/Branch.js';
import { tableName as USER_TABLE } from '../models/User.js';
import { generatePrefixedId } from '../utils/idGenerator.js';

function mapBranchRow(row) {
  if (!row) return null;
  return {
    branchId: row.branch_id,
    managerId: row.manager_id,
    branchCode: row.branch_code,
    branchName: row.branch_name,
    city: row.city,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CREATE_REQUIRED_FIELDS = ['branchCode', 'branchName'];

// POST /branches
export async function createBranch(req, res) {
  try {
    const {
      managerId = null,
      branchCode,
      branchName,
      city = null,
      isActive = true,
    } = req.body;

    const branchId = await generatePrefixedId(pool, {
      tableName: BRANCH_TABLE,
      idColumn: 'branch_id',
      prefix: 'BR',
    });

    const requiredPayload = { branchCode, branchName };
    const missing = CREATE_REQUIRED_FIELDS.filter((field) =>
      requiredPayload[field] === undefined || requiredPayload[field] === null || requiredPayload[field] === ''
    );
    if (missing.length > 0) {
      return res.status(400).json({ message: `Thiếu các field bắt buộc: ${missing.join(', ')}` });
    }

    if (managerId) {
      const managerCheck = await pool.query(
        `SELECT 1 FROM ${USER_TABLE} WHERE user_id = $1 LIMIT 1;`,
        [managerId]
      );
      if (managerCheck.rows.length === 0) {
        return res.status(400).json({ message: 'managerId không tồn tại trong hệ thống' });
      }
    }

    const conflictQuery = `
      SELECT branch_id, branch_code
      FROM ${BRANCH_TABLE}
      WHERE branch_id = $1 OR branch_code = $2
      LIMIT 1;
    `;
    const { rows: conflictRows } = await pool.query(conflictQuery, [branchId, branchCode]);
    if (conflictRows.length > 0) {
      const existing = conflictRows[0];
      if (existing.branch_id === branchId) {
        return res.status(409).json({ message: 'branchId đã tồn tại, vui lòng thử lại' });
      }
      return res.status(409).json({ message: `branchCode "${branchCode}" đã tồn tại` });
    }

    const query = `
      INSERT INTO ${BRANCH_TABLE} (
        branch_id, manager_id, branch_code, branch_name, city, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [branchId, managerId, branchCode, branchName, city, isActive];
    const { rows } = await pool.query(query, values);
    return res.status(201).json(mapBranchRow(rows[0]));
  } catch (error) {
    console.error('Error creating branch:', error);
    if (error.code === '23503') {
      return res.status(400).json({ message: 'Không thể tạo branch: managerId không tồn tại' });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /branches
export async function listBranches(req, res) {
  try {
    const { page = 1, limit = 10, city, search, isActive } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const filterValues = [];
    let i = 1;

    if (city) {
      whereClause += ` AND b.city = $${i}`;
      filterValues.push(city);
      i++;
    }
    if (search) {
      whereClause += ` AND (b.branch_name ILIKE $${i} OR b.branch_code ILIKE $${i})`;
      filterValues.push(`%${search}%`);
      i++;
    }
    if (isActive === 'true' || isActive === 'false') {
      whereClause += ` AND b.is_active = $${i}`;
      filterValues.push(isActive === 'true');
      i++;
    }

    const query = `
      SELECT b.*, u.full_name as manager_name
      FROM ${BRANCH_TABLE} b
      LEFT JOIN users u ON b.manager_id = u.user_id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT $${i} OFFSET $${i + 1};
    `;
    const values = [...filterValues, limit, offset];
    const { rows } = await pool.query(query, values);

    const countQuery = `SELECT COUNT(*) as total FROM ${BRANCH_TABLE} b ${whereClause};`;
    const { rows: countRows } = await pool.query(countQuery, filterValues);

    return res.json({
      branches: rows.map(mapBranchRow),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: parseInt(countRows[0].total, 10),
        totalPages: Math.ceil(countRows[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing branches:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /branches/:id
export async function getBranchById(req, res) {
  try {
    const { id } = req.params;
    const query = `
      SELECT b.*, u.full_name as manager_name
      FROM ${BRANCH_TABLE} b
      LEFT JOIN users u ON b.manager_id = u.user_id
      WHERE b.branch_id = $1
      LIMIT 1;
    `;
    const { rows } = await pool.query(query, [id]);
    const branch = mapBranchRow(rows[0]);
    if (!branch) {
      return res.status(404).json({ message: 'Branch không tồn tại' });
    }
    return res.json(branch);
  } catch (error) {
    console.error('Error getting branch:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// PATCH /branches/:id
export async function updateBranch(req, res) {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    delete updates.branchId;
    delete updates.createdAt;
    delete updates.updatedAt;

    if (updates.branchCode) {
      const conflictQuery = `
        SELECT 1
        FROM ${BRANCH_TABLE}
        WHERE branch_code = $1 AND branch_id <> $2
        LIMIT 1;
      `;
      const { rows: conflictRows } = await pool.query(conflictQuery, [updates.branchCode, id]);
      if (conflictRows.length > 0) {
        return res.status(409).json({ message: 'branchCode đã tồn tại' });
      }
    }

    const allowed = ['managerId', 'branchCode', 'branchName', 'city', 'isActive'];
    const fields = [];
    const values = [];
    let i = 1;
    for (const key of Object.keys(updates)) {
      if (!allowed.includes(key)) continue;
      const dbField = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      fields.push(`${dbField} = $${i}`);
      values.push(updates[key]);
      i++;
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'Không có field nào để cập nhật' });
    }

    values.push(id);
    const query = `
      UPDATE ${BRANCH_TABLE}
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE branch_id = $${i}
      RETURNING *;
    `;
    const { rows } = await pool.query(query, values);
    const branch = mapBranchRow(rows[0]);
    if (!branch) {
      return res.status(404).json({ message: 'Branch không tồn tại' });
    }
    return res.json(branch);
  } catch (error) {
    console.error('Error updating branch:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// DELETE /branches/:id (soft delete)
export async function deleteBranch(req, res) {
  try {
    const { id } = req.params;
    const query = `
      UPDATE ${BRANCH_TABLE}
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE branch_id = $1
      RETURNING branch_id;
    `;
    const { rows } = await pool.query(query, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Branch không tồn tại' });
    }
    return res.json({ message: 'Đã xóa branch' });
  } catch (error) {
    console.error('Error deleting branch:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

