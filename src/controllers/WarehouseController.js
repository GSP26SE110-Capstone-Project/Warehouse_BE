import pool from "../config/db.js";
import { tableName as WAREHOUSE_TABLE } from "../models/Warehouse.js";
import { tableName as USER_TABLE } from "../models/User.js";
import { tableName as BRANCH_TABLE } from "../models/Branch.js";
import { tableName as CONTRACT_TABLE } from "../models/Contract.js";
import { tableName as CONTRACT_ITEM_TABLE } from "../models/ContractItem.js";
import { tableName as ZONE_TABLE } from "../models/Zone.js";
import { tableName as SLOT_TABLE } from "../models/Slot.js";
import { tableName as LEVEL_TABLE } from "../models/Level.js";
import { tableName as RACK_TABLE } from "../models/Rack.js";
import { generatePrefixedId } from "../utils/idGenerator.js";

// Map DB row -> domain object
function mapWarehouseRow(row) {
  if (!row) return null;
  return {
    warehouseId: row.warehouse_id,
    branchId: row.branch_id,
    managerId: row.manager_id,
    warehouseCode: row.warehouse_code,
    warehouseName: row.warehouse_name,
    address: row.address,
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

function mapZoneRow(row) {
  if (!row) return null;
  return {
    zoneId: row.zone_id,
    warehouseId: row.warehouse_id,
    zoneCode: row.zone_code,
    zoneName: row.zone_name,
    length: row.length,
    width: row.width,
    totalArea: row.total_area,
    isRented: row.is_rented,
    warehouseName: row.warehouse_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapZoneWithSlots(row) {
  if (!row) return null;
  return {
    ...mapZoneRow(row),
    totalSlots: row.total_slots !== undefined && row.total_slots !== null
      ? parseInt(row.total_slots, 10)
      : 0,
  };
}

const CREATE_REQUIRED_FIELDS = [
  "warehouseCode",
  "warehouseName",
  "address",
  "length",
  "width",
  "height",
];

function parsePositiveNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { error: `${fieldName} phải là số > 0` };
  }
  return { value: parsed };
}

function parseOptionalNonNegativeNumber(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return { value: null };
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { error: `${fieldName} phải là số >= 0` };
  }
  return { value: parsed };
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
    const { rows: currentUserRows } = await pool.query(currentUserQuery, [
      currentUserId,
    ]);
    if (currentUserRows[0]?.branch_id) return currentUserRows[0].branch_id;
  }

  return null;
}

// POST /warehouses - Tạo warehouse mới
export async function createWarehouse(req, res) {
  try {
    const {
      branchId: incomingBranchId = null,
      managerId = null,
      warehouseCode,
      warehouseName,
      address,
      district = null,
      operatingHours = null,
      length,
      width,
      height,
      totalArea,
      usableArea = null,
    } = req.body;
    const warehouseId = await generatePrefixedId(pool, {
      tableName: WAREHOUSE_TABLE,
      idColumn: "warehouse_id",
      prefix: "WH",
    });
    const branchId = await resolveBranchId({
      branchId: incomingBranchId,
      managerId,
      currentUserId: req.user?.userId,
    });

    const requiredPayload = {
      branchId,
      warehouseCode,
      warehouseName,
      address,
      length,
      width,
      height,
    };
    if (!branchId) {
      return res.status(400).json({
        message:
          "Không xác định được branchId. Hãy truyền branchId hoặc dùng manager/user có branchId hợp lệ",
      });
    }
    const missing = CREATE_REQUIRED_FIELDS.filter(
      (field) =>
        requiredPayload[field] === undefined ||
        requiredPayload[field] === null ||
        requiredPayload[field] === "",
    );
    if (missing.length > 0) {
      return res.status(400).json({
        message: `Thiếu các field bắt buộc: ${missing.join(", ")}`,
      });
    }

    const branchCheck = await pool.query(
      `SELECT 1 FROM ${BRANCH_TABLE} WHERE branch_id = $1 LIMIT 1;`,
      [branchId],
    );
    if (branchCheck.rows.length === 0) {
      return res
        .status(400)
        .json({ message: "branchId không tồn tại trong hệ thống" });
    }

    if (managerId) {
      const managerCheck = await pool.query(
        `SELECT 1 FROM ${USER_TABLE} WHERE user_id = $1 LIMIT 1;`,
        [managerId],
      );
      if (managerCheck.rows.length === 0) {
        return res
          .status(400)
          .json({ message: "managerId không tồn tại trong hệ thống" });
      }
    }

    const parsedLength = parsePositiveNumber(length, "length");
    if (parsedLength.error) {
      return res.status(400).json({ message: parsedLength.error });
    }
    const parsedWidth = parsePositiveNumber(width, "width");
    if (parsedWidth.error) {
      return res.status(400).json({ message: parsedWidth.error });
    }
    const parsedHeight = parsePositiveNumber(height, "height");
    if (parsedHeight.error) {
      return res.status(400).json({ message: parsedHeight.error });
    }

    const computedTotalArea = parsedLength.value * parsedWidth.value;
    if (totalArea !== undefined && totalArea !== null && totalArea !== "") {
      const parsedTotalArea = parsePositiveNumber(totalArea, "totalArea");
      if (parsedTotalArea.error) {
        return res.status(400).json({ message: parsedTotalArea.error });
      }
      if (Math.abs(parsedTotalArea.value - computedTotalArea) > 0.0001) {
        return res
          .status(400)
          .json({ message: "totalArea phải bằng length * width" });
      }
    }

    const parsedUsableArea = parseOptionalNonNegativeNumber(
      usableArea,
      "usableArea",
    );
    if (parsedUsableArea.error) {
      return res.status(400).json({ message: parsedUsableArea.error });
    }
    if (
      parsedUsableArea.value !== null &&
      parsedUsableArea.value > computedTotalArea
    ) {
      return res
        .status(400)
        .json({ message: "usableArea không được lớn hơn totalArea" });
    }

    const conflictQuery = `
      SELECT warehouse_id, warehouse_code
      FROM ${WAREHOUSE_TABLE}
      WHERE warehouse_id = $1 OR warehouse_code = $2
      LIMIT 1;
    `;
    const { rows: conflictRows } = await pool.query(conflictQuery, [
      warehouseId,
      warehouseCode,
    ]);
    if (conflictRows.length > 0) {
      const existing = conflictRows[0];
      if (existing.warehouse_id === warehouseId) {
        return res
          .status(409)
          .json({ message: "warehouseId đã tồn tại, vui lòng thử lại" });
      }
      return res
        .status(409)
        .json({ message: `warehouseCode "${warehouseCode}" đã tồn tại` });
    }

    const query = `
      INSERT INTO ${WAREHOUSE_TABLE} (
        warehouse_id,
        branch_id,
        manager_id,
        warehouse_code,
        warehouse_name,
        address,
        district,
        operating_hours,
        length,
        width,
        height,
        total_area,
        usable_area,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
      RETURNING *;
    `;
    const values = [
      warehouseId,
      branchId,
      managerId,
      warehouseCode,
      warehouseName,
      address,
      district,
      operatingHours,
      parsedLength.value,
      parsedWidth.value,
      parsedHeight.value,
      computedTotalArea,
      parsedUsableArea.value,
    ];
    const { rows } = await pool.query(query, values);
    return res.status(201).json(mapWarehouseRow(rows[0]));
  } catch (error) {
    console.error("Error creating warehouse:", error);
    if (error.code === "23503") {
      return res.status(400).json({
        message:
          "Không thể tạo warehouse: branchId hoặc managerId không tồn tại",
      });
    }
    if (error.code === "23505") {
      const detail = String(error.detail || "");
      if (detail.includes("warehouse_code")) {
        return res.status(409).json({ message: "warehouseCode đã tồn tại" });
      }
      if (detail.includes("warehouse_id")) {
        return res
          .status(409)
          .json({ message: "warehouseId đã tồn tại, vui lòng thử lại" });
      }
      return res.status(409).json({
        message: "Dữ liệu trùng lặp (ràng buộc unique trên database)",
      });
    }
    return res.status(500).json({ message: "Lỗi server" });
  }
}

// GET /warehouses - Danh sách warehouses (public cho tenant)
// Query vacant=true: kho chưa có hợp đồng ACTIVE (không thuê toàn kho / zone / slot nào trong kho)
export async function listWarehouses(req, res) {
  try {
    const { page = 1, limit = 10, search, vacant } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE w.is_active = true";
    const filterValues = [];
    let filterParamIndex = 1;

    if (vacant === "true" || vacant === true) {
      whereClause += `
        AND NOT EXISTS (
          SELECT 1
          FROM ${CONTRACT_ITEM_TABLE} ci
          INNER JOIN ${CONTRACT_TABLE} c ON c.contract_id = ci.contract_id AND c.status = 'ACTIVE'
          WHERE (
            (ci.rent_type = 'ENTIRE_WAREHOUSE' AND ci.warehouse_id = w.warehouse_id)
            OR (ci.rent_type = 'ZONE' AND ci.zone_id IN (
              SELECT z2.zone_id FROM ${ZONE_TABLE} z2 WHERE z2.warehouse_id = w.warehouse_id
            ))
            OR (ci.rent_type = 'SLOT' AND ci.slot_id IN (
              SELECT s.slot_id
              FROM ${SLOT_TABLE} s
              INNER JOIN ${LEVEL_TABLE} l ON l.level_id = s.level_id
              INNER JOIN ${RACK_TABLE} r ON r.rack_id = l.rack_id
              INNER JOIN ${ZONE_TABLE} z3 ON z3.zone_id = r.zone_id
              WHERE z3.warehouse_id = w.warehouse_id
            ))
          )
        )`;
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
    console.error("Error listing warehouses:", error);
    return res.status(500).json({ message: "Lỗi server" });
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
      return res.status(404).json({ message: "Warehouse không tồn tại" });
    }
    const existing = existingRows[0];

    if (updates.warehouseCode) {
      const conflictQuery = `
        SELECT 1
        FROM ${WAREHOUSE_TABLE}
        WHERE warehouse_code = $1 AND warehouse_id <> $2
        LIMIT 1;
      `;
      const { rows: conflictRows } = await pool.query(conflictQuery, [
        updates.warehouseCode,
        id,
      ]);
      if (conflictRows.length > 0) {
        return res.status(409).json({ message: "warehouseCode đã tồn tại" });
      }
    }

    const allowed = [
      "branchId",
      "managerId",
      "warehouseCode",
      "warehouseName",
      "address",
      "district",
      "operatingHours",
      "length",
      "width",
      "height",
      "totalArea",
      "usableArea",
      "isActive",
    ];

    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const key of Object.keys(updates)) {
      if (!allowed.includes(key)) continue;
      if (
        ["length", "width", "height", "totalArea", "usableArea"].includes(key)
      )
        continue;
      const dbField = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      fields.push(`${dbField} = $${paramIndex}`);
      values.push(updates[key]);
      paramIndex++;
    }

    if (fields.length === 0) {
      return res
        .status(400)
        .json({ message: "Không có field nào để cập nhật" });
    }

    const hasLength = Object.prototype.hasOwnProperty.call(updates, "length");
    const hasWidth = Object.prototype.hasOwnProperty.call(updates, "width");
    const hasHeight = Object.prototype.hasOwnProperty.call(updates, "height");
    const hasTotalArea = Object.prototype.hasOwnProperty.call(
      updates,
      "totalArea",
    );
    const hasUsableArea = Object.prototype.hasOwnProperty.call(
      updates,
      "usableArea",
    );

    let nextLength = Number(existing.length);
    let nextWidth = Number(existing.width);
    let nextTotalArea = Number(existing.total_area);

    if (hasLength) {
      const parsedLength = parsePositiveNumber(updates.length, "length");
      if (parsedLength.error)
        return res.status(400).json({ message: parsedLength.error });
      nextLength = parsedLength.value;
      fields.push(`length = $${paramIndex}`);
      values.push(parsedLength.value);
      paramIndex++;
    }

    if (hasWidth) {
      const parsedWidth = parsePositiveNumber(updates.width, "width");
      if (parsedWidth.error)
        return res.status(400).json({ message: parsedWidth.error });
      nextWidth = parsedWidth.value;
      fields.push(`width = $${paramIndex}`);
      values.push(parsedWidth.value);
      paramIndex++;
    }

    if (hasHeight) {
      const parsedHeight = parsePositiveNumber(updates.height, "height");
      if (parsedHeight.error)
        return res.status(400).json({ message: parsedHeight.error });
      fields.push(`height = $${paramIndex}`);
      values.push(parsedHeight.value);
      paramIndex++;
    }

    if (hasLength || hasWidth) {
      nextTotalArea = nextLength * nextWidth;
    }

    if (hasTotalArea) {
      const parsedTotalArea = parsePositiveNumber(
        updates.totalArea,
        "totalArea",
      );
      if (parsedTotalArea.error)
        return res.status(400).json({ message: parsedTotalArea.error });
      if (Math.abs(parsedTotalArea.value - nextLength * nextWidth) > 0.0001) {
        return res
          .status(400)
          .json({ message: "totalArea phải bằng length * width" });
      }
    }

    if (hasLength || hasWidth || hasTotalArea) {
      fields.push(`total_area = $${paramIndex}`);
      values.push(nextTotalArea);
      paramIndex++;
    }

    if (hasUsableArea) {
      const parsedUsableArea = parseOptionalNonNegativeNumber(
        updates.usableArea,
        "usableArea",
      );
      if (parsedUsableArea.error)
        return res.status(400).json({ message: parsedUsableArea.error });
      if (
        parsedUsableArea.value !== null &&
        parsedUsableArea.value > nextTotalArea
      ) {
        return res
          .status(400)
          .json({ message: "usableArea không được lớn hơn totalArea" });
      }
      fields.push(`usable_area = $${paramIndex}`);
      values.push(parsedUsableArea.value);
      paramIndex++;
    }

    values.push(id);
    const query = `
      UPDATE ${WAREHOUSE_TABLE}
      SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE warehouse_id = $${paramIndex}
      RETURNING *;
    `;
    const { rows } = await pool.query(query, values);
    return res.json(mapWarehouseRow(rows[0]));
  } catch (error) {
    console.error("Error updating warehouse:", error);
    return res.status(500).json({ message: "Lỗi server" });
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
      return res.status(404).json({ message: "Warehouse không tồn tại" });
    }

    return res.json({ message: "Đã xóa warehouse" });
  } catch (error) {
    console.error("Error deleting warehouse:", error);
    return res.status(500).json({ message: "Lỗi server" });
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
      return res
        .status(404)
        .json({ message: "Warehouse không tồn tại hoặc không hoạt động" });
    }

    return res.json(mapWarehouseRow(rows[0]));
  } catch (error) {
    console.error("Error getting warehouse:", error);
    return res.status(500).json({ message: "Lỗi server" });
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
      return res.status(404).json({ message: "Warehouse không tồn tại" });
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
    const zones = rows.map(mapZoneWithSlots);
    return res.json({ zones });
  } catch (error) {
    console.error("Error getting warehouse zones:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
}
