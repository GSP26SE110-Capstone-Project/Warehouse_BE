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

// GET /branches/hierarchy?branchId=
export async function getBranchHierarchy(req, res) {
  try {
    const { branchId } = req.query;
    const values = [];
    let whereClause = '';
    if (branchId) {
      whereClause = 'WHERE b.branch_id = $1';
      values.push(branchId);
    }

    const query = `
      SELECT
        b.branch_id,
        b.branch_code,
        b.branch_name,
        b.city,
        b.is_active AS branch_is_active,
        w.warehouse_id,
        w.warehouse_code,
        w.warehouse_name,
        w.district,
        w.length AS warehouse_length,
        w.width AS warehouse_width,
        w.height AS warehouse_height,
        w.total_area AS warehouse_total_area,
        w.usable_area AS warehouse_usable_area,
        w.is_active AS warehouse_is_active,
        z.zone_id,
        z.zone_code,
        z.zone_name,
        z.length AS zone_length,
        z.width AS zone_width,
        z.total_area AS zone_total_area,
        z.is_rented,
        r.rack_id,
        r.rack_code,
        r.rack_size_type,
        r.length AS rack_length,
        r.width AS rack_width,
        r.height AS rack_height,
        r.max_weight_capacity,
        l.level_id,
        l.level_number,
        l.height_clearance,
        l.max_weight
      FROM ${BRANCH_TABLE} b
      LEFT JOIN warehouses w ON w.branch_id = b.branch_id
      LEFT JOIN zones z ON z.warehouse_id = w.warehouse_id
      LEFT JOIN racks r ON r.zone_id = z.zone_id
      LEFT JOIN levels l ON l.rack_id = r.rack_id
      ${whereClause}
      ORDER BY b.branch_code, w.warehouse_code, z.zone_code, r.rack_code, l.level_number;
    `;
    const { rows } = await pool.query(query, values);

    if (branchId && rows.length === 0) {
      return res.status(404).json({ message: 'Branch không tồn tại' });
    }

    const branchMap = new Map();
    for (const row of rows) {
      if (!branchMap.has(row.branch_id)) {
        branchMap.set(row.branch_id, {
          branchId: row.branch_id,
          branchCode: row.branch_code,
          branchName: row.branch_name,
          city: row.city,
          isActive: row.branch_is_active,
          warehouses: [],
        });
      }
      const branchNode = branchMap.get(row.branch_id);

      if (row.warehouse_id) {
        let warehouseNode = branchNode.warehouses.find((w) => w.warehouseId === row.warehouse_id);
        if (!warehouseNode) {
          warehouseNode = {
            warehouseId: row.warehouse_id,
            warehouseCode: row.warehouse_code,
            warehouseName: row.warehouse_name,
            district: row.district,
            length: row.warehouse_length,
            width: row.warehouse_width,
            height: row.warehouse_height,
            totalArea: row.warehouse_total_area,
            usableArea: row.warehouse_usable_area,
            isActive: row.warehouse_is_active,
            zones: [],
          };
          branchNode.warehouses.push(warehouseNode);
        }

        if (row.zone_id) {
          let zoneNode = warehouseNode.zones.find((z) => z.zoneId === row.zone_id);
          if (!zoneNode) {
            zoneNode = {
              zoneId: row.zone_id,
              zoneCode: row.zone_code,
              zoneName: row.zone_name,
              length: row.zone_length,
              width: row.zone_width,
              totalArea: row.zone_total_area,
              isRented: row.is_rented,
              racks: [],
            };
            warehouseNode.zones.push(zoneNode);
          }

          if (row.rack_id) {
            let rackNode = zoneNode.racks.find((r) => r.rackId === row.rack_id);
            if (!rackNode) {
              rackNode = {
                rackId: row.rack_id,
                rackCode: row.rack_code,
                rackSizeType: row.rack_size_type,
                length: row.rack_length,
                width: row.rack_width,
                height: row.rack_height,
                maxWeightCapacity: row.max_weight_capacity,
                levels: [],
              };
              zoneNode.racks.push(rackNode);
            }

            if (row.level_id) {
              const exists = rackNode.levels.some((l) => l.levelId === row.level_id);
              if (!exists) {
                rackNode.levels.push({
                  levelId: row.level_id,
                  levelNumber: row.level_number,
                  heightClearance: row.height_clearance,
                  maxWeight: row.max_weight,
                });
              }
            }
          }
        }
      }
    }

    return res.json({ branches: Array.from(branchMap.values()) });
  } catch (error) {
    console.error('Error getting branch hierarchy:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

