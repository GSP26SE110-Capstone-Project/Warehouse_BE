import pool from '../config/db.js';
import { tableName as WAREHOUSE_TABLE } from '../models/Warehouse.js';
import { tableName as USER_TABLE } from '../models/User.js';

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
    usableArea: row.usable_area,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CREATE_REQUIRED_FIELDS = [
  'warehouseCode',
  'warehouseName',
  'warehouseType',
  'address',
  'length',
  'width',
  'height',
];

async function generateWarehouseId() {
  const query = `
    SELECT warehouse_id
    FROM ${WAREHOUSE_TABLE}
    WHERE warehouse_id ~ '^WH[0-9]+$'
    ORDER BY CAST(SUBSTRING(warehouse_id FROM 3) AS INTEGER) DESC
    LIMIT 1;
  `;
  const { rows } = await pool.query(query);
  const lastWarehouseId = rows[0]?.warehouse_id;
  const lastNumber = lastWarehouseId ? Number(lastWarehouseId.slice(2)) : 0;
  const nextNumber = Number.isNaN(lastNumber) ? 1 : lastNumber + 1;
  return `WH${String(nextNumber).padStart(4, '0')}`;
}

async function resolveBranchId({ branchId, managerId, currentUserId }) {
  if (branchId) return branchId;

  if (managerId) {
    const managerQuery = `
      SELECT branch_id
      FROM ${USER_TABLE}
      WHERE user_id = $1
      LIMIT 1;
    `;
    const { rows: managerRows } = await pool.query(managerQuery, [managerId]);
    if (managerRows[0]?.branch_id) return managerRows[0].branch_id;
  }

  if (currentUserId) {
    const currentUserQuery = `
      SELECT branch_id
      FROM ${USER_TABLE}
      WHERE user_id = $1
      LIMIT 1;
    `;
    const { rows: currentUserRows } = await pool.query(currentUserQuery, [currentUserId]);
    if (currentUserRows[0]?.branch_id) return currentUserRows[0].branch_id;
  }

  return null;
}

// POST /warehouses - Tạo warehouse mới
export async function createWarehouse(req, res) {
  try {
    const {
      warehouseId: incomingWarehouseId = null,
      branchId: incomingBranchId = null,
      managerId = null,
      warehouseCode,
      warehouseName,
      warehouseType,
      warehouseSize = null,
      address,
      city = null,
      district = null,
      operatingHours = null,
      length,
      width,
      height,
      usableArea = null,
    } = req.body;
    const warehouseId = incomingWarehouseId || await generateWarehouseId();
    const branchId = await resolveBranchId({
      branchId: incomingBranchId,
      managerId,
      currentUserId: req.user?.userId,
    });

    const requiredPayload = {
      branchId,
      warehouseCode,
      warehouseName,
      warehouseType,
      address,
      length,
      width,
      height,
    };
    if (!branchId) {
      return res.status(400).json({
        message: 'Không xác định được branchId. Hãy truyền branchId hoặc dùng manager/user có branchId hợp lệ',
      });
    }
    const missing = CREATE_REQUIRED_FIELDS.filter((field) => requiredPayload[field] === undefined || requiredPayload[field] === null || requiredPayload[field] === '');
    if (missing.length > 0) {
      return res.status(400).json({
        message: `Thiếu các field bắt buộc: ${missing.join(', ')}`,
      });
    }

    const totalArea = Number(length) * Number(width);
    if (Number.isNaN(totalArea)) {
      return res.status(400).json({ message: 'length và width phải là số hợp lệ' });
    }

    const conflictQuery = `
      SELECT 1
      FROM ${WAREHOUSE_TABLE}
      WHERE warehouse_id = $1 OR warehouse_code = $2
      LIMIT 1;
    `;
    const { rows: conflictRows } = await pool.query(conflictQuery, [warehouseId, warehouseCode]);
    if (conflictRows.length > 0) {
      return res.status(409).json({ message: 'warehouseId hoặc warehouseCode đã tồn tại' });
    }

    const query = `
      INSERT INTO ${WAREHOUSE_TABLE} (
        warehouse_id,
        branch_id,
        manager_id,
        warehouse_code,
        warehouse_name,
        warehouse_type,
        warehouse_size,
        address,
        city,
        district,
        operating_hours,
        length,
        width,
        height,
        total_area,
        usable_area,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true)
      RETURNING *;
    `;
    const values = [
      warehouseId,
      branchId,
      managerId,
      warehouseCode,
      warehouseName,
      warehouseType,
      warehouseSize,
      address,
      city,
      district,
      operatingHours,
      length,
      width,
      height,
      totalArea,
      usableArea,
    ];
    const { rows } = await pool.query(query, values);
    return res.status(201).json(mapWarehouseRow(rows[0]));
  } catch (error) {
    console.error('Error creating warehouse:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /warehouses - Danh sách warehouses (public cho tenant)
export async function listWarehouses(req, res) {
  try {
    const { page = 1, limit = 10, city, warehouseType, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE w.is_active = true';
    const filterValues = [];
    let filterParamIndex = 1;

    if (city) {
      whereClause += ` AND w.city = $${filterParamIndex}`;
      filterValues.push(city);
      filterParamIndex++;
    }

    if (warehouseType) {
      whereClause += ` AND w.warehouse_type = $${filterParamIndex}`;
      filterValues.push(warehouseType);
      filterParamIndex++;
    }

    if (search) {
      whereClause += ` AND (w.warehouse_name ILIKE $${filterParamIndex} OR w.address ILIKE $${filterParamIndex})`;
      filterValues.push(`%${search}%`);
      filterParamIndex++;
    }

    const values = [...filterValues, limit, offset];
    const listLimitParam = filterParamIndex;
    const listOffsetParam = filterParamIndex + 1;

    const query = `
      SELECT w.*, b.branch_name, u.full_name as manager_name
      FROM ${WAREHOUSE_TABLE} w
      LEFT JOIN branches b ON w.branch_id = b.branch_id
      LEFT JOIN users u ON w.manager_id = u.user_id
      ${whereClause}
      ORDER BY w.created_at DESC
      LIMIT $${listLimitParam} OFFSET $${listOffsetParam};
    `;

    const { rows } = await pool.query(query, values);
    const warehouses = rows.map(mapWarehouseRow);

    // Đếm tổng số
    const countQuery = `SELECT COUNT(*) as total FROM ${WAREHOUSE_TABLE} w ${whereClause}`;
    const { rows: countRows } = await pool.query(countQuery, filterValues);

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

// PATCH /warehouses/:id - Cập nhật warehouse
export async function updateWarehouse(req, res) {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    delete updates.warehouseId;
    delete updates.createdAt;
    delete updates.updatedAt;

    const checkQuery = `SELECT * FROM ${WAREHOUSE_TABLE} WHERE warehouse_id = $1;`;
    const { rows: existingRows } = await pool.query(checkQuery, [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ message: 'Warehouse không tồn tại' });
    }
    const existing = existingRows[0];

    if (updates.warehouseCode) {
      const conflictQuery = `
        SELECT 1
        FROM ${WAREHOUSE_TABLE}
        WHERE warehouse_code = $1 AND warehouse_id <> $2
        LIMIT 1;
      `;
      const { rows: conflictRows } = await pool.query(conflictQuery, [updates.warehouseCode, id]);
      if (conflictRows.length > 0) {
        return res.status(409).json({ message: 'warehouseCode đã tồn tại' });
      }
    }

    const allowed = [
      'branchId',
      'managerId',
      'warehouseCode',
      'warehouseName',
      'warehouseType',
      'warehouseSize',
      'address',
      'city',
      'district',
      'operatingHours',
      'length',
      'width',
      'height',
      'usableArea',
      'isActive',
    ];

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

    const hasLength = Object.prototype.hasOwnProperty.call(updates, 'length');
    const hasWidth = Object.prototype.hasOwnProperty.call(updates, 'width');
    if (hasLength || hasWidth) {
      const nextLength = hasLength ? Number(updates.length) : Number(existing.length);
      const nextWidth = hasWidth ? Number(updates.width) : Number(existing.width);
      const nextTotalArea = nextLength * nextWidth;
      if (Number.isNaN(nextTotalArea)) {
        return res.status(400).json({ message: 'length và width phải là số hợp lệ' });
      }
      fields.push(`total_area = $${paramIndex}`);
      values.push(nextTotalArea);
      paramIndex++;
    }

    values.push(id);
    const query = `
      UPDATE ${WAREHOUSE_TABLE}
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE warehouse_id = $${paramIndex}
      RETURNING *;
    `;
    const { rows } = await pool.query(query, values);
    return res.json(mapWarehouseRow(rows[0]));
  } catch (error) {
    console.error('Error updating warehouse:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// DELETE /warehouses/:id - Xóa mềm warehouse
export async function deleteWarehouse(req, res) {
  try {
    const { id } = req.params;

    const query = `
      UPDATE ${WAREHOUSE_TABLE}
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE warehouse_id = $1
      RETURNING warehouse_id;
    `;
    const { rows } = await pool.query(query, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Warehouse không tồn tại' });
    }

    return res.json({ message: 'Đã xóa warehouse' });
  } catch (error) {
    console.error('Error deleting warehouse:', error);
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