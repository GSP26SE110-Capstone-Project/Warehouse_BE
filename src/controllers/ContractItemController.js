import pool from '../config/db.js';
import { tableName as CONTRACT_ITEM_TABLE } from '../models/ContractItem.js';
import { generatePrefixedId } from '../utils/idGenerator.js';

function mapContractItemRow(row) {
  if (!row) return null;
  return {
    itemId: row.item_id,
    contractId: row.contract_id,
    rentType: row.rent_type,
    warehouseId: row.warehouse_id,
    zoneId: row.zone_id,
    slotId: row.slot_id,
    unitPrice: row.unit_price,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateRentTypePayload({ rentType, warehouseId, zoneId, slotId }) {
  if (rentType === 'ENTIRE_WAREHOUSE') return Boolean(warehouseId);
  if (rentType === 'ZONE') return Boolean(zoneId);
  if (rentType === 'SLOT') return Boolean(slotId);
  return false;
}

// POST /contract-items - Tạo contract item
export async function createContractItem(req, res) {
  try {
    const {
      itemId: incomingItemId = null,
      contractId,
      rentType,
      warehouseId = null,
      zoneId = null,
      slotId = null,
      unitPrice,
    } = req.body;
    const itemId = incomingItemId || await generatePrefixedId(pool, {
      tableName: CONTRACT_ITEM_TABLE,
      idColumn: 'item_id',
      prefix: 'ITM',
    });

    if (!contractId || !rentType || unitPrice === undefined) {
      return res.status(400).json({
        message: 'contractId, rentType, unitPrice là bắt buộc',
      });
    }
    if (!validateRentTypePayload({ rentType, warehouseId, zoneId, slotId })) {
      return res.status(400).json({
        message: 'rentType không hợp lệ hoặc thiếu id tương ứng (warehouseId/zoneId/slotId)',
      });
    }

    const conflictQuery = `SELECT 1 FROM ${CONTRACT_ITEM_TABLE} WHERE item_id = $1 LIMIT 1;`;
    const { rows: conflictRows } = await pool.query(conflictQuery, [itemId]);
    if (conflictRows.length > 0) {
      return res.status(409).json({ message: 'itemId đã tồn tại' });
    }

    const query = `
      INSERT INTO ${CONTRACT_ITEM_TABLE} (
        item_id, contract_id, rent_type, warehouse_id, zone_id, slot_id, unit_price
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [itemId, contractId, rentType, warehouseId, zoneId, slotId, unitPrice];
    const { rows } = await pool.query(query, values);
    return res.status(201).json(mapContractItemRow(rows[0]));
  } catch (error) {
    console.error('Error creating contract item:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /contract-items - Danh sách contract items
export async function listContractItems(req, res) {
  try {
    const { contractId, rentType, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const filterValues = [];
    let filterParamIndex = 1;

    if (contractId) {
      whereClause += ` AND ci.contract_id = $${filterParamIndex}`;
      filterValues.push(contractId);
      filterParamIndex++;
    }
    if (rentType) {
      whereClause += ` AND ci.rent_type = $${filterParamIndex}`;
      filterValues.push(rentType);
      filterParamIndex++;
    }

    const values = [...filterValues, limit, offset];
    const query = `
      SELECT ci.*
      FROM ${CONTRACT_ITEM_TABLE} ci
      ${whereClause}
      ORDER BY ci.created_at DESC
      LIMIT $${filterParamIndex} OFFSET $${filterParamIndex + 1};
    `;
    const { rows } = await pool.query(query, values);

    const countQuery = `SELECT COUNT(*) as total FROM ${CONTRACT_ITEM_TABLE} ci ${whereClause};`;
    const { rows: countRows } = await pool.query(countQuery, filterValues);

    return res.json({
      items: rows.map(mapContractItemRow),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: parseInt(countRows[0].total, 10),
        totalPages: Math.ceil(countRows[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing contract items:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /contract-items/:id - Chi tiết contract item
export async function getContractItemById(req, res) {
  try {
    const { id } = req.params;
    const query = `SELECT * FROM ${CONTRACT_ITEM_TABLE} WHERE item_id = $1 LIMIT 1;`;
    const { rows } = await pool.query(query, [id]);
    const item = mapContractItemRow(rows[0]);
    if (!item) {
      return res.status(404).json({ message: 'Contract item không tồn tại' });
    }
    return res.json(item);
  } catch (error) {
    console.error('Error getting contract item:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// PATCH /contract-items/:id - Cập nhật contract item
export async function updateContractItem(req, res) {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    delete updates.itemId;
    delete updates.createdAt;
    delete updates.updatedAt;

    const currentQuery = `SELECT * FROM ${CONTRACT_ITEM_TABLE} WHERE item_id = $1 LIMIT 1;`;
    const { rows: currentRows } = await pool.query(currentQuery, [id]);
    if (currentRows.length === 0) {
      return res.status(404).json({ message: 'Contract item không tồn tại' });
    }
    const currentItem = mapContractItemRow(currentRows[0]);

    const allowed = ['contractId', 'rentType', 'warehouseId', 'zoneId', 'slotId', 'unitPrice'];
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

    const mergedItem = {
      ...currentItem,
      ...updates,
    };
    if (!validateRentTypePayload(mergedItem)) {
      return res.status(400).json({
        message: 'rentType không hợp lệ hoặc thiếu id tương ứng (warehouseId/zoneId/slotId)',
      });
    }

    values.push(id);
    const query = `
      UPDATE ${CONTRACT_ITEM_TABLE}
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE item_id = $${paramIndex}
      RETURNING *;
    `;
    const { rows } = await pool.query(query, values);
    const item = mapContractItemRow(rows[0]);
    return res.json(item);
  } catch (error) {
    console.error('Error updating contract item:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// DELETE /contract-items/:id - Xóa contract item
export async function deleteContractItem(req, res) {
  try {
    const { id } = req.params;
    const query = `DELETE FROM ${CONTRACT_ITEM_TABLE} WHERE item_id = $1 RETURNING item_id;`;
    const { rows } = await pool.query(query, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Contract item không tồn tại' });
    }
    return res.json({ message: 'Đã xóa contract item' });
  } catch (error) {
    console.error('Error deleting contract item:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

