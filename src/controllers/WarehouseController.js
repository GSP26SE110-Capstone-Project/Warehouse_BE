import pool from '../config/db.js';
import { tableName as WAREHOUSE_TABLE } from '../models/Warehouse.js';

// Map DB row -> domain object
function mapWarehouseRow(row) {
  if (!row) return null;
  return {
    warehouseId: row.warehouse_id,
    branchId: row.branch_id,
    managerId: row.manager_id,
    warehouseCode: row.warehouse_code,
    warehouseName: row.warehouse_name,
    warehouseType: row.warehouse_type,
    warehouseSize: row.warehouse_size,
    address: row.address,
    city: row.city,
    district: row.district,
    operatingHours: row.operating_hours,
    length: row.length,
    width: row.width,
    height: row.height,
    totalArea: row.total_area,
    totalCapacity: row.total_capacity,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /warehouses - Danh sách warehouses (public cho tenant)
export async function listWarehouses(req, res) {
  try {
    const { page = 1, limit = 10, city, warehouseType, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE w.is_active = true';
    let values = [limit, offset];
    let paramIndex = 3;

    if (city) {
      whereClause += ` AND w.city = $${paramIndex}`;
      values.push(city);
      paramIndex++;
    }

    if (warehouseType) {
      whereClause += ` AND w.warehouse_type = $${paramIndex}`;
      values.push(warehouseType);
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (w.warehouse_name ILIKE $${paramIndex} OR w.address ILIKE $${paramIndex})`;
      values.push(`%${search}%`);
      paramIndex++;
    }

    const query = `
      SELECT w.*, b.branch_name, u.full_name as manager_name
      FROM ${WAREHOUSE_TABLE} w
      LEFT JOIN branches b ON w.branch_id = b.branch_id
      LEFT JOIN users u ON w.manager_id = u.user_id
      ${whereClause}
      ORDER BY w.created_at DESC
      LIMIT $1 OFFSET $2;
    `;

    const { rows } = await pool.query(query, values);
    const warehouses = rows.map(mapWarehouseRow);

    // Đếm tổng số
    const countQuery = `SELECT COUNT(*) as total FROM ${WAREHOUSE_TABLE} w ${whereClause}`;
    const countValues = values.slice(2);
    const { rows: countRows } = await pool.query(countQuery, countValues);

    return res.json({
      warehouses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countRows[0].total),
        totalPages: Math.ceil(countRows[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing warehouses:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /warehouses/:id - Lấy chi tiết warehouse
export async function getWarehouseById(req, res) {
  try {
    const { id } = req.params;

    const query = `
      SELECT w.*, b.branch_name, u.full_name as manager_name
      FROM ${WAREHOUSE_TABLE} w
      LEFT JOIN branches b ON w.branch_id = b.branch_id
      LEFT JOIN users u ON w.manager_id = u.user_id
      WHERE w.warehouse_id = $1 AND w.is_active = true;
    `;

    const { rows } = await pool.query(query, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Warehouse không tồn tại hoặc không hoạt động' });
    }

    return res.json(mapWarehouseRow(rows[0]));
  } catch (error) {
    console.error('Error getting warehouse:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /warehouses/:id/zones - Lấy zones trong warehouse
export async function getWarehouseZones(req, res) {
  try {
    const { id } = req.params;

    // Kiểm tra warehouse tồn tại
    const warehouseQuery = `SELECT 1 FROM ${WAREHOUSE_TABLE} WHERE warehouse_id = $1 AND is_active = true;`;
    const { rows: warehouseRows } = await pool.query(warehouseQuery, [id]);
    if (warehouseRows.length === 0) {
      return res.status(404).json({ message: 'Warehouse không tồn tại' });
    }

    const query = `
      SELECT z.*, COUNT(s.slot_id) as total_slots
      FROM zones z
      LEFT JOIN racks r ON z.zone_id = r.zone_id
      LEFT JOIN levels l ON r.rack_id = l.rack_id
      LEFT JOIN slots s ON l.level_id = s.level_id
      WHERE z.warehouse_id = $1
      GROUP BY z.zone_id
      ORDER BY z.zone_code;
    `;

    const { rows } = await pool.query(query, [id]);
    return res.json({ zones: rows });
  } catch (error) {
    console.error('Error getting warehouse zones:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}