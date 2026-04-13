import pool from '../config/db.js';
import { tableName as SHIPMENT_TABLE } from '../models/Shipment.js';

function mapShipmentRow(row) {
  if (!row) return null;
  return {
    shipmentId: row.shipment_id,
    contractId: row.contract_id,
    shipmentType: row.shipment_type,
    providerId: row.provider_id,
    driverId: row.driver_id,
    supervisorId: row.supervisor_id,
    fromAddress: row.from_address,
    toAddress: row.to_address,
    scheduledTime: row.scheduled_time,
    actualStartTime: row.actual_start_time,
    actualEndTime: row.actual_end_time,
    totalWeight: row.total_weight,
    totalDistance: row.total_distance,
    shippingFee: row.shipping_fee,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// POST /shipments
export async function createShipment(req, res) {
  try {
    const {
      shipmentId,
      contractId,
      shipmentType,
      providerId = null,
      driverId = null,
      supervisorId = null,
      fromAddress,
      toAddress,
      scheduledTime = null,
      actualStartTime = null,
      actualEndTime = null,
      totalWeight = null,
      totalDistance = null,
      shippingFee = null,
      status = 'SCHEDULING',
    } = req.body;

    if (!shipmentId || !contractId || !shipmentType || !fromAddress || !toAddress) {
      return res.status(400).json({
        message: 'shipmentId, contractId, shipmentType, fromAddress, toAddress là bắt buộc',
      });
    }

    const conflictQuery = `SELECT 1 FROM ${SHIPMENT_TABLE} WHERE shipment_id = $1 LIMIT 1;`;
    const { rows: conflictRows } = await pool.query(conflictQuery, [shipmentId]);
    if (conflictRows.length > 0) {
      return res.status(409).json({ message: 'shipmentId đã tồn tại' });
    }

    const query = `
      INSERT INTO ${SHIPMENT_TABLE} (
        shipment_id, contract_id, shipment_type, provider_id, driver_id, supervisor_id,
        from_address, to_address, scheduled_time, actual_start_time, actual_end_time,
        total_weight, total_distance, shipping_fee, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *;
    `;
    const values = [
      shipmentId, contractId, shipmentType, providerId, driverId, supervisorId,
      fromAddress, toAddress, scheduledTime, actualStartTime, actualEndTime,
      totalWeight, totalDistance, shippingFee, status,
    ];
    const { rows } = await pool.query(query, values);
    return res.status(201).json(mapShipmentRow(rows[0]));
  } catch (error) {
    console.error('Error creating shipment:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /shipments
export async function listShipments(req, res) {
  try {
    const { page = 1, limit = 10, contractId, status, shipmentType, providerId } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const filterValues = [];
    let filterParamIndex = 1;

    if (contractId) {
      whereClause += ` AND s.contract_id = $${filterParamIndex}`;
      filterValues.push(contractId);
      filterParamIndex++;
    }
    if (status) {
      whereClause += ` AND s.status = $${filterParamIndex}`;
      filterValues.push(status);
      filterParamIndex++;
    }
    if (shipmentType) {
      whereClause += ` AND s.shipment_type = $${filterParamIndex}`;
      filterValues.push(shipmentType);
      filterParamIndex++;
    }
    if (providerId) {
      whereClause += ` AND s.provider_id = $${filterParamIndex}`;
      filterValues.push(providerId);
      filterParamIndex++;
    }

    const values = [...filterValues, limit, offset];
    const query = `
      SELECT s.*
      FROM ${SHIPMENT_TABLE} s
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${filterParamIndex} OFFSET $${filterParamIndex + 1};
    `;
    const { rows } = await pool.query(query, values);

    const countQuery = `SELECT COUNT(*) as total FROM ${SHIPMENT_TABLE} s ${whereClause};`;
    const { rows: countRows } = await pool.query(countQuery, filterValues);

    return res.json({
      shipments: rows.map(mapShipmentRow),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: parseInt(countRows[0].total, 10),
        totalPages: Math.ceil(countRows[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing shipments:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /shipments/:id
export async function getShipmentById(req, res) {
  try {
    const { id } = req.params;
    const query = `SELECT * FROM ${SHIPMENT_TABLE} WHERE shipment_id = $1 LIMIT 1;`;
    const { rows } = await pool.query(query, [id]);
    const shipment = mapShipmentRow(rows[0]);
    if (!shipment) {
      return res.status(404).json({ message: 'Shipment không tồn tại' });
    }
    return res.json(shipment);
  } catch (error) {
    console.error('Error getting shipment:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// PATCH /shipments/:id
export async function updateShipment(req, res) {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    delete updates.shipmentId;
    delete updates.createdAt;
    delete updates.updatedAt;

    const allowed = [
      'contractId', 'shipmentType', 'providerId', 'driverId', 'supervisorId',
      'fromAddress', 'toAddress', 'scheduledTime', 'actualStartTime', 'actualEndTime',
      'totalWeight', 'totalDistance', 'shippingFee', 'status',
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

    values.push(id);
    const query = `
      UPDATE ${SHIPMENT_TABLE}
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE shipment_id = $${paramIndex}
      RETURNING *;
    `;
    const { rows } = await pool.query(query, values);
    const shipment = mapShipmentRow(rows[0]);
    if (!shipment) {
      return res.status(404).json({ message: 'Shipment không tồn tại' });
    }
    return res.json(shipment);
  } catch (error) {
    console.error('Error updating shipment:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// DELETE /shipments/:id (soft delete -> CANCELLED)
export async function deleteShipment(req, res) {
  try {
    const { id } = req.params;
    const query = `
      UPDATE ${SHIPMENT_TABLE}
      SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
      WHERE shipment_id = $1
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [id]);
    const shipment = mapShipmentRow(rows[0]);
    if (!shipment) {
      return res.status(404).json({ message: 'Shipment không tồn tại' });
    }
    return res.json({
      message: 'Shipment đã được hủy',
      shipment,
    });
  } catch (error) {
    console.error('Error deleting shipment:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

