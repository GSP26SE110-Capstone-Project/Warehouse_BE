import pool from '../config/db.js';
import { tableName as TENANT_TABLE } from '../models/Tenant.js';

// Map DB row -> domain object
function mapTenantRow(row) {
  if (!row) return null;
  return {
    tenantId: row.tenant_id,
    companyName: row.company_name,
    taxCode: row.tax_code,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    address: row.address,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// POST /tenants - Tạo tenant mới
export async function createTenant(req, res) {
  try {
    const {
      tenantId,
      companyName,
      taxCode,
      contactEmail,
      contactPhone,
      address,
    } = req.body;

    if (!tenantId || !companyName || !taxCode || !contactEmail) {
      return res.status(400).json({
        message: 'tenantId, companyName, taxCode, contactEmail là bắt buộc'
      });
    }

    // Kiểm tra trùng taxCode hoặc email
    const conflictQuery = `
      SELECT 1
      FROM ${TENANT_TABLE}
      WHERE tax_code = $1 OR contact_email = $2
      LIMIT 1;
    `;
    const { rows: conflictRows } = await pool.query(conflictQuery, [taxCode, contactEmail]);
    if (conflictRows.length > 0) {
      return res.status(409).json({ message: 'Tax code hoặc email đã tồn tại' });
    }

    const query = `
      INSERT INTO ${TENANT_TABLE} (
        tenant_id,
        company_name,
        tax_code,
        contact_email,
        contact_phone,
        address
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    const values = [tenantId, companyName, taxCode, contactEmail, contactPhone, address];
    const { rows } = await pool.query(query, values);

    return res.status(201).json(mapTenantRow(rows[0]));
  } catch (error) {
    console.error('Error creating tenant:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /tenants - Danh sách tenants
export async function listTenants(req, res) {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let values = [limit, offset];
    let paramIndex = 3;

    if (search) {
      whereClause = `WHERE company_name ILIKE $${paramIndex} OR contact_email ILIKE $${paramIndex}`;
      values.push(`%${search}%`);
      paramIndex++;
    }

    const query = `
      SELECT * FROM ${TENANT_TABLE}
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2;
    `;

    const { rows } = await pool.query(query, values);
    const tenants = rows.map(mapTenantRow);

    // Đếm tổng số
    const countQuery = `SELECT COUNT(*) as total FROM ${TENANT_TABLE} ${whereClause}`;
    const countValues = search ? [`%${search}%`] : [];
    const { rows: countRows } = await pool.query(countQuery, countValues);

    return res.json({
      tenants,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countRows[0].total),
        totalPages: Math.ceil(countRows[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing tenants:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /tenants/:id - Lấy chi tiết tenant
export async function getTenantById(req, res) {
  try {
    const { id } = req.params;

    const query = `SELECT * FROM ${TENANT_TABLE} WHERE tenant_id = $1;`;
    const { rows } = await pool.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Tenant không tồn tại' });
    }

    return res.json(mapTenantRow(rows[0]));
  } catch (error) {
    console.error('Error getting tenant:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// PATCH /tenants/:id - Cập nhật tenant
export async function updateTenant(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Kiểm tra tenant tồn tại
    const checkQuery = `SELECT 1 FROM ${TENANT_TABLE} WHERE tenant_id = $1;`;
    const { rows: checkRows } = await pool.query(checkQuery, [id]);
    if (checkRows.length === 0) {
      return res.status(404).json({ message: 'Tenant không tồn tại' });
    }

    // Build dynamic update query
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        const dbField = key.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
        fields.push(`${dbField} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({ message: 'Không có field nào để cập nhật' });
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE ${TENANT_TABLE}
      SET ${fields.join(', ')}
      WHERE tenant_id = $${paramIndex}
      RETURNING *;
    `;

    const { rows } = await pool.query(query, values);
    return res.json(mapTenantRow(rows[0]));
  } catch (error) {
    console.error('Error updating tenant:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /tenants/:id/branches - Lấy branches của tenant
export async function getTenantBranches(req, res) {
  try {
    const { id } = req.params;

    // Kiểm tra tenant tồn tại
    const tenantQuery = `SELECT 1 FROM ${TENANT_TABLE} WHERE tenant_id = $1;`;
    const { rows: tenantRows } = await pool.query(tenantQuery, [id]);
    if (tenantRows.length === 0) {
      return res.status(404).json({ message: 'Tenant không tồn tại' });
    }

    const query = `
      SELECT b.* FROM branches b
      WHERE b.tenant_id = $1
      ORDER BY b.created_at DESC;
    `;

    const { rows } = await pool.query(query, [id]);
    return res.json({ branches: rows });
  } catch (error) {
    console.error('Error getting tenant branches:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}