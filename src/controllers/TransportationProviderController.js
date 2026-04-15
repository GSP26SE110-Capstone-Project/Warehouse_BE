import pool from '../config/db.js';
import { tableName as PROVIDER_TABLE } from '../models/TransportationProvider.js';
import { generatePrefixedId } from '../utils/idGenerator.js';

function mapProviderRow(row) {
  if (!row) return null;
  return {
    providerId: row.provider_id,
    name: row.name,
    providerType: row.provider_type,
    contactInfo: row.contact_info,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// POST /transportation-providers
export async function createTransportationProvider(req, res) {
  try {
    const {
      providerId: incomingProviderId = null,
      name,
      providerType = null,
      contactInfo = null,
      isActive = true,
    } = req.body;
    const providerId = incomingProviderId || await generatePrefixedId(pool, {
      tableName: PROVIDER_TABLE,
      idColumn: 'provider_id',
      prefix: 'TPR',
    });

    if (!name) {
      return res.status(400).json({ message: 'name là bắt buộc' });
    }

    const conflictQuery = `
      SELECT 1
      FROM ${PROVIDER_TABLE}
      WHERE provider_id = $1
      LIMIT 1;
    `;
    const { rows: conflictRows } = await pool.query(conflictQuery, [providerId]);
    if (conflictRows.length > 0) {
      return res.status(409).json({ message: 'providerId đã tồn tại' });
    }

    const query = `
      INSERT INTO ${PROVIDER_TABLE} (
        provider_id, name, provider_type, contact_info, is_active
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [providerId, name, providerType, contactInfo, isActive];
    const { rows } = await pool.query(query, values);
    return res.status(201).json(mapProviderRow(rows[0]));
  } catch (error) {
    console.error('Error creating transportation provider:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /transportation-providers
export async function listTransportationProviders(req, res) {
  try {
    const { page = 1, limit = 10, providerType, isActive, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const filterValues = [];
    let filterParamIndex = 1;

    if (providerType) {
      whereClause += ` AND p.provider_type = $${filterParamIndex}`;
      filterValues.push(providerType);
      filterParamIndex++;
    }

    if (isActive === 'true' || isActive === 'false') {
      whereClause += ` AND p.is_active = $${filterParamIndex}`;
      filterValues.push(isActive === 'true');
      filterParamIndex++;
    }

    if (search) {
      whereClause += ` AND p.name ILIKE $${filterParamIndex}`;
      filterValues.push(`%${search}%`);
      filterParamIndex++;
    }

    const values = [...filterValues, limit, offset];
    const query = `
      SELECT p.*
      FROM ${PROVIDER_TABLE} p
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${filterParamIndex} OFFSET $${filterParamIndex + 1};
    `;
    const { rows } = await pool.query(query, values);

    const countQuery = `SELECT COUNT(*) as total FROM ${PROVIDER_TABLE} p ${whereClause};`;
    const { rows: countRows } = await pool.query(countQuery, filterValues);

    return res.json({
      providers: rows.map(mapProviderRow),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: parseInt(countRows[0].total, 10),
        totalPages: Math.ceil(countRows[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing transportation providers:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /transportation-providers/:id
export async function getTransportationProviderById(req, res) {
  try {
    const { id } = req.params;
    const query = `
      SELECT *
      FROM ${PROVIDER_TABLE}
      WHERE provider_id = $1
      LIMIT 1;
    `;
    const { rows } = await pool.query(query, [id]);
    const provider = mapProviderRow(rows[0]);
    if (!provider) {
      return res.status(404).json({ message: 'Transportation provider không tồn tại' });
    }
    return res.json(provider);
  } catch (error) {
    console.error('Error getting transportation provider:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// PATCH /transportation-providers/:id
export async function updateTransportationProvider(req, res) {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    delete updates.providerId;
    delete updates.createdAt;
    delete updates.updatedAt;

    const allowed = ['name', 'providerType', 'contactInfo', 'isActive'];
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const key of Object.keys(updates)) {
      if (!allowed.includes(key)) continue;
      const dbField = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      fields.push(`${dbField} = $${paramIndex}`);
      values.push(updates[key]);
      paramIndex++;
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'Không có field nào để cập nhật' });
    }

    values.push(id);
    const query = `
      UPDATE ${PROVIDER_TABLE}
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE provider_id = $${paramIndex}
      RETURNING *;
    `;
    const { rows } = await pool.query(query, values);
    const provider = mapProviderRow(rows[0]);
    if (!provider) {
      return res.status(404).json({ message: 'Transportation provider không tồn tại' });
    }
    return res.json(provider);
  } catch (error) {
    console.error('Error updating transportation provider:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// DELETE /transportation-providers/:id (soft delete)
export async function deleteTransportationProvider(req, res) {
  try {
    const { id } = req.params;
    const query = `
      UPDATE ${PROVIDER_TABLE}
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE provider_id = $1
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [id]);
    const provider = mapProviderRow(rows[0]);
    if (!provider) {
      return res.status(404).json({ message: 'Transportation provider không tồn tại' });
    }
    return res.json({
      message: 'Transportation provider đã được vô hiệu hóa',
      provider,
    });
  } catch (error) {
    console.error('Error deleting transportation provider:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

