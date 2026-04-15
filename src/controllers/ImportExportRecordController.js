import pool from '../config/db.js';
import { tableName as RECORD_TABLE } from '../models/ImportExportRecord.js';

function mapRecordRow(row) {
  if (!row) return null;
  return {
    recordId: row.record_id,
    contractId: row.contract_id,
    warehouseId: row.warehouse_id,
    scopeType: row.scope_type,
    zoneId: row.zone_id,
    slotId: row.slot_id,
    recordType: row.record_type,
    recordCode: row.record_code,
    scheduledDatetime: row.scheduled_datetime,
    actualDatetime: row.actual_datetime,
    quantity: row.quantity,
    weight: row.weight,
    isFullZone: row.is_full_zone,
    responsibleStaffId: row.responsible_staff_id,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    status: row.status,
    cancelReason: row.cancel_reason,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateScope({ scopeType, zoneId, slotId }) {
  if (scopeType === 'WAREHOUSE') return true;
  if (scopeType === 'ZONE') return Boolean(zoneId);
  if (scopeType === 'SLOT') return Boolean(slotId);
  return false;
}

// POST /import-export-records
export async function createImportExportRecord(req, res) {
  try {
    const {
      recordId,
      contractId,
      warehouseId,
      scopeType = 'ZONE',
      zoneId = null,
      slotId = null,
      recordType,
      recordCode,
      scheduledDatetime,
      actualDatetime = null,
      quantity = null,
      weight = null,
      isFullZone = false,
      responsibleStaffId = null,
      approvedBy = null,
      approvedAt = null,
      status = 'PENDING',
      cancelReason = null,
      notes = null,
    } = req.body;

    if (!recordId || !contractId || !warehouseId || !recordType || !recordCode || !scheduledDatetime) {
      return res.status(400).json({
        message: 'recordId, contractId, warehouseId, recordType, recordCode, scheduledDatetime là bắt buộc',
      });
    }

    if (!validateScope({ scopeType, zoneId, slotId })) {
      return res.status(400).json({
        message: 'scopeType không hợp lệ hoặc thiếu zoneId/slotId tương ứng',
      });
    }

    const conflictQuery = `
      SELECT 1
      FROM ${RECORD_TABLE}
      WHERE record_id = $1 OR record_code = $2
      LIMIT 1;
    `;
    const { rows: conflictRows } = await pool.query(conflictQuery, [recordId, recordCode]);
    if (conflictRows.length > 0) {
      return res.status(409).json({ message: 'recordId hoặc recordCode đã tồn tại' });
    }

    const query = `
      INSERT INTO ${RECORD_TABLE} (
        record_id, contract_id, warehouse_id, scope_type, zone_id, slot_id,
        record_type, record_code, scheduled_datetime, actual_datetime, quantity,
        weight, is_full_zone, responsible_staff_id, approved_by, approved_at,
        status, cancel_reason, notes
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16,
        $17, $18, $19
      )
      RETURNING *;
    `;
    const values = [
      recordId, contractId, warehouseId, scopeType, zoneId, slotId,
      recordType, recordCode, scheduledDatetime, actualDatetime, quantity,
      weight, isFullZone, responsibleStaffId, approvedBy, approvedAt,
      status, cancelReason, notes,
    ];
    const { rows } = await pool.query(query, values);
    return res.status(201).json(mapRecordRow(rows[0]));
  } catch (error) {
    console.error('Error creating import-export record:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /import-export-records
export async function listImportExportRecords(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      contractId,
      warehouseId,
      recordType,
      status,
      scopeType,
      scheduledFrom,
      scheduledTo,
      search,
    } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const filterValues = [];
    let i = 1;

    if (contractId) {
      whereClause += ` AND r.contract_id = $${i}`;
      filterValues.push(contractId);
      i++;
    }
    if (warehouseId) {
      whereClause += ` AND r.warehouse_id = $${i}`;
      filterValues.push(warehouseId);
      i++;
    }
    if (recordType) {
      whereClause += ` AND r.record_type = $${i}`;
      filterValues.push(recordType);
      i++;
    }
    if (status) {
      whereClause += ` AND r.status = $${i}`;
      filterValues.push(status);
      i++;
    }
    if (scopeType) {
      whereClause += ` AND r.scope_type = $${i}`;
      filterValues.push(scopeType);
      i++;
    }
    if (scheduledFrom) {
      whereClause += ` AND r.scheduled_datetime >= $${i}`;
      filterValues.push(scheduledFrom);
      i++;
    }
    if (scheduledTo) {
      whereClause += ` AND r.scheduled_datetime <= $${i}`;
      filterValues.push(scheduledTo);
      i++;
    }
    if (search) {
      whereClause += ` AND r.record_code ILIKE $${i}`;
      filterValues.push(`%${search}%`);
      i++;
    }

    const values = [...filterValues, limit, offset];
    const query = `
      SELECT r.*
      FROM ${RECORD_TABLE} r
      ${whereClause}
      ORDER BY r.scheduled_datetime DESC, r.created_at DESC
      LIMIT $${i} OFFSET $${i + 1};
    `;
    const { rows } = await pool.query(query, values);

    const countQuery = `SELECT COUNT(*) as total FROM ${RECORD_TABLE} r ${whereClause};`;
    const { rows: countRows } = await pool.query(countQuery, filterValues);

    return res.json({
      records: rows.map(mapRecordRow),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: parseInt(countRows[0].total, 10),
        totalPages: Math.ceil(countRows[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing import-export records:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /import-export-records/:id
export async function getImportExportRecordById(req, res) {
  try {
    const { id } = req.params;
    const query = `SELECT * FROM ${RECORD_TABLE} WHERE record_id = $1 LIMIT 1;`;
    const { rows } = await pool.query(query, [id]);
    const record = mapRecordRow(rows[0]);
    if (!record) {
      return res.status(404).json({ message: 'Import/export record không tồn tại' });
    }
    return res.json(record);
  } catch (error) {
    console.error('Error getting import-export record:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// PATCH /import-export-records/:id
export async function updateImportExportRecord(req, res) {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    delete updates.recordId;
    delete updates.createdAt;
    delete updates.updatedAt;

    const currentQuery = `SELECT * FROM ${RECORD_TABLE} WHERE record_id = $1 LIMIT 1;`;
    const { rows: currentRows } = await pool.query(currentQuery, [id]);
    if (currentRows.length === 0) {
      return res.status(404).json({ message: 'Import/export record không tồn tại' });
    }
    const current = mapRecordRow(currentRows[0]);

    if (updates.recordCode) {
      const conflictQuery = `
        SELECT 1
        FROM ${RECORD_TABLE}
        WHERE record_code = $1 AND record_id <> $2
        LIMIT 1;
      `;
      const { rows: conflictRows } = await pool.query(conflictQuery, [updates.recordCode, id]);
      if (conflictRows.length > 0) {
        return res.status(409).json({ message: 'recordCode đã tồn tại' });
      }
    }

    const merged = { ...current, ...updates };
    if (!validateScope(merged)) {
      return res.status(400).json({
        message: 'scopeType không hợp lệ hoặc thiếu zoneId/slotId tương ứng',
      });
    }

    const allowed = [
      'contractId', 'warehouseId', 'scopeType', 'zoneId', 'slotId',
      'recordType', 'recordCode', 'scheduledDatetime', 'actualDatetime',
      'quantity', 'weight', 'isFullZone', 'responsibleStaffId',
      'approvedBy', 'approvedAt', 'status', 'cancelReason', 'notes',
    ];

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
      UPDATE ${RECORD_TABLE}
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE record_id = $${i}
      RETURNING *;
    `;
    const { rows } = await pool.query(query, values);
    return res.json(mapRecordRow(rows[0]));
  } catch (error) {
    console.error('Error updating import-export record:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// DELETE /import-export-records/:id (soft delete -> CANCELLED)
export async function deleteImportExportRecord(req, res) {
  try {
    const { id } = req.params;
    const query = `
      UPDATE ${RECORD_TABLE}
      SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
      WHERE record_id = $1
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [id]);
    const record = mapRecordRow(rows[0]);
    if (!record) {
      return res.status(404).json({ message: 'Import/export record không tồn tại' });
    }
    return res.json({
      message: 'Import/export record đã được hủy',
      record,
    });
  } catch (error) {
    console.error('Error deleting import-export record:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

