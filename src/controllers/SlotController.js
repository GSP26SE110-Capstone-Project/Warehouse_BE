import pool from '../config/db.js';
import { tableName as SLOT_TABLE } from '../models/Slot.js';
import { generatePrefixedId } from '../utils/idGenerator.js';

function mapSlotRow(row) {
  if (!row) return null;
  return {
    slotId: row.slot_id,
    levelId: row.level_id,
    slotCode: row.slot_code,
    length: row.length,
    width: row.width,
    height: row.height,
    volume: row.volume,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CREATE_REQUIRED_FIELDS = ['levelId', 'slotCode', 'length', 'width', 'height'];

// POST /slots
export async function createSlot(req, res) {
  try {
    const {
      slotId: incomingSlotId = null,
      levelId,
      slotCode,
      length,
      width,
      height,
      status = 'EMPTY',
    } = req.body;

    const slotId = incomingSlotId || await generatePrefixedId(pool, {
      tableName: SLOT_TABLE,
      idColumn: 'slot_id',
      prefix: 'SLT',
    });

    const requiredPayload = { levelId, slotCode, length, width, height };
    const missing = CREATE_REQUIRED_FIELDS.filter((field) =>
      requiredPayload[field] === undefined || requiredPayload[field] === null || requiredPayload[field] === ''
    );
    if (missing.length > 0) {
      return res.status(400).json({ message: `Thiếu các field bắt buộc: ${missing.join(', ')}` });
    }

    const computedVolume = Number(length) * Number(width) * Number(height);
    if (Number.isNaN(computedVolume)) {
      return res.status(400).json({ message: 'length, width, height phải là số hợp lệ' });
    }

    const conflictQuery = `
      SELECT 1
      FROM ${SLOT_TABLE}
      WHERE slot_id = $1 OR slot_code = $2
      LIMIT 1;
    `;
    const { rows: conflictRows } = await pool.query(conflictQuery, [slotId, slotCode]);
    if (conflictRows.length > 0) {
      return res.status(409).json({ message: 'slotId hoặc slotCode đã tồn tại' });
    }

    const query = `
      INSERT INTO ${SLOT_TABLE} (
        slot_id, level_id, slot_code, length, width, height, volume, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [slotId, levelId, slotCode, length, width, height, computedVolume, status];
    const { rows } = await pool.query(query, values);
    return res.status(201).json(mapSlotRow(rows[0]));
  } catch (error) {
    console.error('Error creating slot:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /slots
export async function listSlots(req, res) {
  try {
    const { page = 1, limit = 10, levelId, status, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const filterValues = [];
    let i = 1;

    if (levelId) {
      whereClause += ` AND s.level_id = $${i}`;
      filterValues.push(levelId);
      i++;
    }
    if (status) {
      whereClause += ` AND s.status = $${i}`;
      filterValues.push(status);
      i++;
    }
    if (search) {
      whereClause += ` AND s.slot_code ILIKE $${i}`;
      filterValues.push(`%${search}%`);
      i++;
    }

    const query = `
      SELECT s.*
      FROM ${SLOT_TABLE} s
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${i} OFFSET $${i + 1};
    `;
    const { rows } = await pool.query(query, [...filterValues, limit, offset]);

    const countQuery = `SELECT COUNT(*) as total FROM ${SLOT_TABLE} s ${whereClause};`;
    const { rows: countRows } = await pool.query(countQuery, filterValues);

    return res.json({
      slots: rows.map(mapSlotRow),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: parseInt(countRows[0].total, 10),
        totalPages: Math.ceil(countRows[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing slots:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /slots/:id
export async function getSlotById(req, res) {
  try {
    const { id } = req.params;
    const query = `SELECT * FROM ${SLOT_TABLE} WHERE slot_id = $1 LIMIT 1;`;
    const { rows } = await pool.query(query, [id]);
    const slot = mapSlotRow(rows[0]);
    if (!slot) {
      return res.status(404).json({ message: 'Slot không tồn tại' });
    }
    return res.json(slot);
  } catch (error) {
    console.error('Error getting slot:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

const SLOT_STATUSES = ['EMPTY', 'RENTED', 'MAINTENANCE'];

// PATCH /slots/:id/status — chỉ đổi trạng thái (warehouse_staff / admin)
export async function updateSlotStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (status === undefined || status === null || status === '') {
      return res.status(400).json({ message: 'status là bắt buộc' });
    }
    if (!SLOT_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `status phải là một trong: ${SLOT_STATUSES.join(', ')}`,
      });
    }

    const query = `
      UPDATE ${SLOT_TABLE}
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE slot_id = $2
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [status, id]);
    const slot = mapSlotRow(rows[0]);
    if (!slot) {
      return res.status(404).json({ message: 'Slot không tồn tại' });
    }
    return res.json(slot);
  } catch (error) {
    console.error('Error updating slot status:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// PATCH /slots/:id
export async function updateSlot(req, res) {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    delete updates.slotId;
    delete updates.createdAt;
    delete updates.updatedAt;

    const currentQuery = `SELECT * FROM ${SLOT_TABLE} WHERE slot_id = $1 LIMIT 1;`;
    const { rows: currentRows } = await pool.query(currentQuery, [id]);
    const currentSlot = currentRows[0];
    if (!currentSlot) {
      return res.status(404).json({ message: 'Slot không tồn tại' });
    }

    if (updates.slotCode) {
      const conflictQuery = `
        SELECT 1
        FROM ${SLOT_TABLE}
        WHERE slot_code = $1 AND slot_id <> $2
        LIMIT 1;
      `;
      const { rows: conflictRows } = await pool.query(conflictQuery, [updates.slotCode, id]);
      if (conflictRows.length > 0) {
        return res.status(409).json({ message: 'slotCode đã tồn tại' });
      }
    }

    const allowed = ['levelId', 'slotCode', 'length', 'width', 'height', 'status'];
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

    const hasLength = Object.prototype.hasOwnProperty.call(updates, 'length');
    const hasWidth = Object.prototype.hasOwnProperty.call(updates, 'width');
    const hasHeight = Object.prototype.hasOwnProperty.call(updates, 'height');
    if (hasLength || hasWidth || hasHeight) {
      const nextLength = hasLength ? Number(updates.length) : Number(currentSlot.length);
      const nextWidth = hasWidth ? Number(updates.width) : Number(currentSlot.width);
      const nextHeight = hasHeight ? Number(updates.height) : Number(currentSlot.height);
      const nextVolume = nextLength * nextWidth * nextHeight;
      if (Number.isNaN(nextVolume)) {
        return res.status(400).json({ message: 'length, width, height phải là số hợp lệ' });
      }
      fields.push(`volume = $${i}`);
      values.push(nextVolume);
      i++;
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'Không có field nào để cập nhật' });
    }

    values.push(id);
    const query = `
      UPDATE ${SLOT_TABLE}
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE slot_id = $${i}
      RETURNING *;
    `;
    const { rows } = await pool.query(query, values);
    return res.json(mapSlotRow(rows[0]));
  } catch (error) {
    console.error('Error updating slot:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// DELETE /slots/:id
export async function deleteSlot(req, res) {
  try {
    const { id } = req.params;
    const query = `DELETE FROM ${SLOT_TABLE} WHERE slot_id = $1 RETURNING slot_id;`;
    const { rows } = await pool.query(query, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Slot không tồn tại' });
    }
    return res.json({ message: 'Đã xóa slot' });
  } catch (error) {
    console.error('Error deleting slot:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

