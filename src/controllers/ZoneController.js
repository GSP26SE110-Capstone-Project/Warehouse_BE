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

