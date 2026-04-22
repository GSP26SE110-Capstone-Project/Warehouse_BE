import pool from '../config/db.js';
import { tableName as RACK_TABLE } from '../models/Rack.js';
import { tableName as ZONE_TABLE } from '../models/Zone.js';
import { generatePrefixedId } from '../utils/idGenerator.js';

function mapRackRow(row) {
  if (!row) return null;
  return {
    rackId: row.rack_id,
    zoneId: row.zone_id,
    rackCode: row.rack_code,
    rackSizeType: row.rack_size_type,
    length: row.length,
    width: row.width,
    height: row.height,
    maxWeightCapacity: row.max_weight_capacity,
    isRented: row.is_rented,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CREATE_REQUIRED_FIELDS = ['zoneId', 'rackCode', 'length', 'width', 'height'];

function parsePositiveNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { error: `${fieldName} phải là số > 0` };
  }
  return { value: parsed };
}

function parseOptionalNonNegativeNumber(value, fieldName) {
  if (value === undefined || value === null || value === '') return { value: null };
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { error: `${fieldName} phải là số >= 0` };
  }
  return { value: parsed };
}

// POST /racks
export async function createRack(req, res) {
  try {
    const {
      zoneId,
      rackCode,
      rackSizeType = null,
      length,
      width,
      height,
      maxWeightCapacity = null,
    } = req.body;

    const rackId = await generatePrefixedId(pool, {
      tableName: RACK_TABLE,
      idColumn: 'rack_id',
      prefix: 'RCK',
    });

    const requiredPayload = { zoneId, rackCode, length, width, height };
    const missing = CREATE_REQUIRED_FIELDS.filter((field) =>
      requiredPayload[field] === undefined || requiredPayload[field] === null || requiredPayload[field] === ''
    );
    if (missing.length > 0) {
      return res.status(400).json({ message: `Thiếu các field bắt buộc: ${missing.join(', ')}` });
    }

    const zoneCheck = await pool.query(
      `SELECT 1 FROM ${ZONE_TABLE} WHERE zone_id = $1 LIMIT 1;`,
      [zoneId]
    );
    if (zoneCheck.rows.length === 0) {
      return res.status(400).json({ message: 'zoneId không tồn tại trong hệ thống' });
    }

    const parsedLength = parsePositiveNumber(length, 'length');
    if (parsedLength.error) return res.status(400).json({ message: parsedLength.error });
    const parsedWidth = parsePositiveNumber(width, 'width');
    if (parsedWidth.error) return res.status(400).json({ message: parsedWidth.error });
    const parsedHeight = parsePositiveNumber(height, 'height');
    if (parsedHeight.error) return res.status(400).json({ message: parsedHeight.error });
    const parsedMaxWeight = parseOptionalNonNegativeNumber(maxWeightCapacity, 'maxWeightCapacity');
    if (parsedMaxWeight.error) return res.status(400).json({ message: parsedMaxWeight.error });

    const conflictQuery = `
      SELECT rack_id, zone_id, rack_code
      FROM ${RACK_TABLE}
      WHERE rack_id = $1 OR (zone_id = $2 AND rack_code = $3)
      LIMIT 1;
    `;
    const { rows: conflictRows } = await pool.query(conflictQuery, [rackId, zoneId, rackCode]);
    if (conflictRows.length > 0) {
      const existing = conflictRows[0];
      if (existing.rack_id === rackId) {
        return res.status(409).json({ message: 'rackId đã tồn tại, vui lòng thử lại' });
      }
      return res.status(409).json({ message: `rackCode "${rackCode}" đã tồn tại trong zone "${zoneId}"` });
    }

    const query = `
      INSERT INTO ${RACK_TABLE} (
        rack_id, zone_id, rack_code, rack_size_type, length, width, height, max_weight_capacity
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [
      rackId,
      zoneId,
      rackCode,
      rackSizeType,
      parsedLength.value,
      parsedWidth.value,
      parsedHeight.value,
      parsedMaxWeight.value,
    ];
    const { rows } = await pool.query(query, values);
    return res.status(201).json(mapRackRow(rows[0]));
  } catch (error) {
    console.error('Error creating rack:', error);
    if (error.code === '23503') {
      return res.status(400).json({ message: 'Không thể tạo rack: zoneId không tồn tại' });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /racks
export async function listRacks(req, res) {
  try {
    const { page = 1, limit = 10, zoneId, rackSizeType, search, isRented } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const filterValues = [];
    let i = 1;

    if (zoneId) {
      whereClause += ` AND r.zone_id = $${i}`;
      filterValues.push(zoneId);
      i++;
    }
    if (rackSizeType) {
      whereClause += ` AND r.rack_size_type = $${i}`;
      filterValues.push(rackSizeType);
      i++;
    }
    if (search) {
      whereClause += ` AND r.rack_code ILIKE $${i}`;
      filterValues.push(`%${search}%`);
      i++;
    }
    if (isRented === 'true' || isRented === 'false') {
      whereClause += ` AND r.is_rented = $${i}`;
      filterValues.push(isRented === 'true');
      i++;
    }

    const query = `
      SELECT r.*
      FROM ${RACK_TABLE} r
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT $${i} OFFSET $${i + 1};
    `;
    const values = [...filterValues, limit, offset];
    const { rows } = await pool.query(query, values);

    const countQuery = `SELECT COUNT(*) as total FROM ${RACK_TABLE} r ${whereClause};`;
    const { rows: countRows } = await pool.query(countQuery, filterValues);

    return res.json({
      racks: rows.map(mapRackRow),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: parseInt(countRows[0].total, 10),
        totalPages: Math.ceil(countRows[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing racks:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /racks/:id
export async function getRackById(req, res) {
  try {
    const { id } = req.params;
    const query = `SELECT * FROM ${RACK_TABLE} WHERE rack_id = $1 LIMIT 1;`;
    const { rows } = await pool.query(query, [id]);
    const rack = mapRackRow(rows[0]);
    if (!rack) {
      return res.status(404).json({ message: 'Rack không tồn tại' });
    }
    return res.json(rack);
  } catch (error) {
    console.error('Error getting rack:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// PATCH /racks/:id
export async function updateRack(req, res) {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    delete updates.rackId;
    delete updates.createdAt;
    delete updates.updatedAt;

    const currentQuery = `SELECT * FROM ${RACK_TABLE} WHERE rack_id = $1 LIMIT 1;`;
    const { rows: currentRows } = await pool.query(currentQuery, [id]);
    const currentRack = currentRows[0];
    if (!currentRack) {
      return res.status(404).json({ message: 'Rack không tồn tại' });
    }

    if (updates.rackCode) {
      const nextZoneId = updates.zoneId || currentRack.zone_id;
      const conflictQuery = `
        SELECT 1
        FROM ${RACK_TABLE}
        WHERE zone_id = $1 AND rack_code = $2 AND rack_id <> $3
        LIMIT 1;
      `;
      const { rows: conflictRows } = await pool.query(conflictQuery, [nextZoneId, updates.rackCode, id]);
      if (conflictRows.length > 0) {
        return res.status(409).json({ message: 'rackCode đã tồn tại trong zone' });
      }
    }

    const allowed = ['zoneId', 'rackCode', 'rackSizeType', 'length', 'width', 'height', 'maxWeightCapacity'];
    const fields = [];
    const values = [];
    let i = 1;
    for (const key of Object.keys(updates)) {
      if (!allowed.includes(key)) continue;
      if (['length', 'width', 'height', 'maxWeightCapacity'].includes(key)) continue;
      const dbField = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      fields.push(`${dbField} = $${i}`);
      values.push(updates[key]);
      i++;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'length')) {
      const parsed = parsePositiveNumber(updates.length, 'length');
      if (parsed.error) return res.status(400).json({ message: parsed.error });
      fields.push(`length = $${i}`);
      values.push(parsed.value);
      i++;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'width')) {
      const parsed = parsePositiveNumber(updates.width, 'width');
      if (parsed.error) return res.status(400).json({ message: parsed.error });
      fields.push(`width = $${i}`);
      values.push(parsed.value);
      i++;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'height')) {
      const parsed = parsePositiveNumber(updates.height, 'height');
      if (parsed.error) return res.status(400).json({ message: parsed.error });
      fields.push(`height = $${i}`);
      values.push(parsed.value);
      i++;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'maxWeightCapacity')) {
      const parsed = parseOptionalNonNegativeNumber(updates.maxWeightCapacity, 'maxWeightCapacity');
      if (parsed.error) return res.status(400).json({ message: parsed.error });
      fields.push(`max_weight_capacity = $${i}`);
      values.push(parsed.value);
      i++;
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'Không có field nào để cập nhật' });
    }

    values.push(id);
    const query = `
      UPDATE ${RACK_TABLE}
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE rack_id = $${i}
      RETURNING *;
    `;
    const { rows } = await pool.query(query, values);
    return res.json(mapRackRow(rows[0]));
  } catch (error) {
    console.error('Error updating rack:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// DELETE /racks/:id
export async function deleteRack(req, res) {
  try {
    const { id } = req.params;
    const query = `DELETE FROM ${RACK_TABLE} WHERE rack_id = $1 RETURNING rack_id;`;
    const { rows } = await pool.query(query, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Rack không tồn tại' });
    }
    return res.json({ message: 'Đã xóa rack' });
  } catch (error) {
    console.error('Error deleting rack:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

