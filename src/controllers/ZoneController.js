import pool from '../config/db.js';
import { tableName as ZONE_TABLE } from '../models/Zone.js';

function mapZoneRow(row) {
  if (!row) return null;
  return {
    zoneId: row.zone_id,
    warehouseId: row.warehouse_id,
    zoneCode: row.zone_code,
    zoneName: row.zone_name,
    zoneType: row.zone_type,
    length: row.length,
    width: row.width,
    totalArea: row.total_area,
    isRented: row.is_rented,
    warehouseName: row.warehouse_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /zones?available=true&warehouseId=...
export async function listZones(req, res) {
  try {
    const { available, warehouseId, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const filterValues = [];
    let paramIndex = 1;

    if (warehouseId) {
      whereClause += ` AND z.warehouse_id = $${paramIndex}`;
      filterValues.push(warehouseId);
      paramIndex++;
    }

    if (available === 'true') {
      whereClause += ` AND z.is_rented = false`;
    } else if (available === 'false') {
      whereClause += ` AND z.is_rented = true`;
    }

    const query = `
      SELECT z.*, w.warehouse_name
      FROM ${ZONE_TABLE} z
      LEFT JOIN warehouses w ON z.warehouse_id = w.warehouse_id
      ${whereClause}
      ORDER BY z.zone_code
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    const values = [...filterValues, limit, offset];
    const { rows } = await pool.query(query, values);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${ZONE_TABLE} z
      ${whereClause};
    `;
    const { rows: countRows } = await pool.query(countQuery, filterValues);

    return res.json({
      zones: rows.map(mapZoneRow),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: parseInt(countRows[0].total, 10),
        totalPages: Math.ceil(countRows[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing zones:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// POST /zones - Tạo zone mới
export async function createZone(req, res) {
  try {
    const {
      zoneId,
      warehouseId,
      zoneCode,
      zoneName = null,
      zoneType = null,
      length,
      width,
    } = req.body;

    if (!zoneId || !warehouseId || !zoneCode || length === undefined || width === undefined) {
      return res.status(400).json({ message: 'zoneId, warehouseId, zoneCode, length, width là bắt buộc' });
    }

    const totalArea = Number(length) * Number(width);

    const conflictQuery = `
      SELECT 1 FROM ${ZONE_TABLE}
      WHERE zone_id = $1 OR (warehouse_id = $2 AND zone_code = $3)
      LIMIT 1;
    `;
    const { rows: conflict } = await pool.query(conflictQuery, [zoneId, warehouseId, zoneCode]);
    if (conflict.length > 0) {
      return res.status(409).json({ message: 'zoneId hoặc zoneCode đã tồn tại trong kho' });
    }

    const insertQuery = `
      INSERT INTO ${ZONE_TABLE} (
        zone_id, warehouse_id, zone_code, zone_name, zone_type, length, width, total_area, is_rented
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
      RETURNING *;
    `;
    const { rows } = await pool.query(insertQuery, [
      zoneId, warehouseId, zoneCode, zoneName, zoneType, length, width, totalArea
    ]);
    return res.status(201).json(mapZoneRow(rows[0]));
  } catch (error) {
    console.error('Error creating zone:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /zones/:id - Lấy chi tiết zone
export async function getZoneById(req, res) {
  try {
    const { id } = req.params;
    const query = `
      SELECT z.*, w.warehouse_name
      FROM ${ZONE_TABLE} z
      LEFT JOIN warehouses w ON z.warehouse_id = w.warehouse_id
      WHERE z.zone_id = $1
      LIMIT 1;
    `;
    const { rows } = await pool.query(query, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Zone không tồn tại' });
    }
    return res.json(mapZoneRow(rows[0]));
  } catch (error) {
    console.error('Error getting zone:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// PATCH /zones/:id - Cập nhật zone
export async function updateZone(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Không cho cập nhật khóa chính
    delete updates.zoneId;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    const allowed = ['warehouseId', 'zoneCode', 'zoneName', 'zoneType', 'length', 'width', 'isRented'];
    for (const key of Object.keys(updates)) {
      if (!allowed.includes(key)) continue;
      const dbField = key.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
      fields.push(`${dbField} = $${paramIndex}`);
      values.push(updates[key]);
      paramIndex++;
    }

    // Nếu có length/width thì cập nhật total_area
    const hasLength = Object.prototype.hasOwnProperty.call(updates, 'length');
    const hasWidth = Object.prototype.hasOwnProperty.call(updates, 'width');
    if (hasLength || hasWidth) {
      // Cập nhật total_area = (length or existing) * (width or existing)
      fields.push(`total_area = COALESCE($${paramIndex}, (SELECT length FROM ${ZONE_TABLE} WHERE zone_id = $${paramIndex + 2})) * COALESCE($${paramIndex + 1}, (SELECT width FROM ${ZONE_TABLE} WHERE zone_id = $${paramIndex + 2}))`);
      values.push(hasLength ? updates.length : null);
      values.push(hasWidth ? updates.width : null);
      paramIndex += 2;
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'Không có field nào để cập nhật' });
    }

    values.push(id);
    const query = `
      UPDATE ${ZONE_TABLE}
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE zone_id = $${paramIndex}
      RETURNING *;
    `;
    const { rows } = await pool.query(query, values);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Zone không tồn tại' });
    }
    return res.json(mapZoneRow(rows[0]));
  } catch (error) {
    console.error('Error updating zone:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// DELETE /zones/:id - Xóa zone
export async function deleteZone(req, res) {
  try {
    const { id } = req.params;
    // Không cho xóa nếu đang is_rented = true
    const checkQuery = `SELECT is_rented FROM ${ZONE_TABLE} WHERE zone_id = $1;`;
    const { rows: checkRows } = await pool.query(checkQuery, [id]);
    if (checkRows.length === 0) {
      return res.status(404).json({ message: 'Zone không tồn tại' });
    }
    if (checkRows[0].is_rented) {
      return res.status(400).json({ message: 'Không thể xóa zone đang được thuê' });
    }

    const del = await pool.query(`DELETE FROM ${ZONE_TABLE} WHERE zone_id = $1;`, [id]);
    return res.json({ message: 'Đã xóa zone' });
  } catch (error) {
    console.error('Error deleting zone:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}