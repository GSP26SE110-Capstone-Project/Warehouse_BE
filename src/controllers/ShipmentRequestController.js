import pool from '../config/db.js';
import { randomUUID } from 'crypto';
import { tableName as SHIPMENT_REQUEST_TABLE } from '../models/ShipmentRequest.js';
import { tableName as CONTRACT_TABLE } from '../models/Contract.js';
import { tableName as SHIPMENT_TABLE } from '../models/Shipment.js';
import { tableName as TRANSPORT_CONTRACT_TABLE } from '../models/TransportContract.js';
import { tableName as USER_TABLE } from '../models/User.js';
import { tableName as NOTIFICATION_TABLE } from '../models/Notification.js';
import { generatePrefixedId } from '../utils/idGenerator.js';

function mapShipmentRequestRow(row) {
  if (!row) return null;
  return {
    requestId: row.request_id,
    contractId: row.contract_id,
    tenantId: row.tenant_id,
    shipmentType: row.shipment_type,
    fromAddress: row.from_address,
    toAddress: row.to_address,
    preferredPickupTime: row.preferred_pickup_time,
    notes: row.notes,
    status: row.status,
    reviewedBy: row.reviewed_by,
    approvedAt: row.approved_at,
    rejectedReason: row.rejected_reason,
    shipmentId: row.shipment_id,
    transportContractId: row.transport_contract_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getTenantIdByUserId(userId) {
  const { rows } = await pool.query(`SELECT tenant_id FROM ${USER_TABLE} WHERE user_id = $1 LIMIT 1`, [userId]);
  return rows[0]?.tenant_id || null;
}

async function notifyUser(client, userId, title, content) {
  if (!userId) return;
  await client.query(
    `
    INSERT INTO ${NOTIFICATION_TABLE} (notification_id, user_id, type, title, content, is_read)
    VALUES ($1, $2, 'SHIPMENT_TRACKING', $3, $4, false)
    `,
    [randomUUID(), userId, title, content],
  );
}

// POST /shipment-requests
export async function createShipmentRequest(req, res) {
  try {
    const userId = req.user?.userId;
    const tenantIdFromUser = await getTenantIdByUserId(userId);
    if (!tenantIdFromUser) {
      return res.status(403).json({ message: 'Tài khoản tenant chưa gắn tenantId' });
    }

    const {
      requestId: incomingRequestId = null,
      contractId,
      shipmentType,
      fromAddress,
      toAddress,
      preferredPickupTime = null,
      notes = null,
    } = req.body;
    const requestId = incomingRequestId || await generatePrefixedId(pool, {
      tableName: SHIPMENT_REQUEST_TABLE,
      idColumn: 'request_id',
      prefix: 'SRQ',
    });

    if (!contractId || !shipmentType || !fromAddress || !toAddress) {
      return res.status(400).json({
        message: 'contractId, shipmentType, fromAddress, toAddress là bắt buộc',
      });
    }

    const { rows: contractRows } = await pool.query(
      `SELECT contract_id, tenant_id, status FROM ${CONTRACT_TABLE} WHERE contract_id = $1 LIMIT 1`,
      [contractId],
    );
    const contract = contractRows[0];
    if (!contract) return res.status(404).json({ message: 'Contract không tồn tại' });
    if (contract.tenant_id !== tenantIdFromUser) {
      return res.status(403).json({ message: 'Bạn không có quyền tạo yêu cầu cho contract này' });
    }
    if (contract.status === 'CANCELLED') {
      return res.status(400).json({ message: 'Không thể tạo yêu cầu vận chuyển cho contract đã hủy' });
    }

    const { rows: conflictRows } = await pool.query(
      `SELECT 1 FROM ${SHIPMENT_REQUEST_TABLE} WHERE request_id = $1 LIMIT 1`,
      [requestId],
    );
    if (conflictRows.length > 0) {
      return res.status(409).json({ message: 'requestId đã tồn tại' });
    }

    const { rows } = await pool.query(
      `
      INSERT INTO ${SHIPMENT_REQUEST_TABLE} (
        request_id, contract_id, tenant_id, shipment_type, from_address, to_address,
        preferred_pickup_time, notes, status, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', $9)
      RETURNING *;
      `,
      [
        requestId,
        contractId,
        tenantIdFromUser,
        shipmentType,
        fromAddress,
        toAddress,
        preferredPickupTime,
        notes,
        userId,
      ],
    );

    return res.status(201).json(mapShipmentRequestRow(rows[0]));
  } catch (error) {
    console.error('Error creating shipment request:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /shipment-requests
export async function listShipmentRequests(req, res) {
  try {
    const { page = 1, limit = 10, status, contractId } = req.query;
    const offset = (page - 1) * limit;
    const role = req.user?.role;
    const userId = req.user?.userId;
    const tenantId = role === 'tenant_admin' ? await getTenantIdByUserId(userId) : null;

    let whereClause = 'WHERE 1=1';
    const filterValues = [];
    let i = 1;

    if (tenantId) {
      whereClause += ` AND sr.tenant_id = $${i}`;
      filterValues.push(tenantId);
      i++;
    }
    if (status) {
      whereClause += ` AND sr.status = $${i}`;
      filterValues.push(status);
      i++;
    }
    if (contractId) {
      whereClause += ` AND sr.contract_id = $${i}`;
      filterValues.push(contractId);
      i++;
    }

    const { rows } = await pool.query(
      `
      SELECT sr.*
      FROM ${SHIPMENT_REQUEST_TABLE} sr
      ${whereClause}
      ORDER BY sr.created_at DESC
      LIMIT $${i} OFFSET $${i + 1}
      `,
      [...filterValues, limit, offset],
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) AS total FROM ${SHIPMENT_REQUEST_TABLE} sr ${whereClause}`,
      filterValues,
    );

    return res.json({
      requests: rows.map(mapShipmentRequestRow),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: parseInt(countRows[0].total, 10),
        totalPages: Math.ceil(countRows[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing shipment requests:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /shipment-requests/:id
export async function getShipmentRequestById(req, res) {
  try {
    const { id } = req.params;
    const role = req.user?.role;
    const userId = req.user?.userId;
    const tenantId = role === 'tenant_admin' ? await getTenantIdByUserId(userId) : null;

    const { rows } = await pool.query(
      `SELECT * FROM ${SHIPMENT_REQUEST_TABLE} WHERE request_id = $1 LIMIT 1`,
      [id],
    );
    const request = rows[0];
    if (!request) return res.status(404).json({ message: 'Shipment request không tồn tại' });
    if (tenantId && request.tenant_id !== tenantId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    return res.json(mapShipmentRequestRow(request));
  } catch (error) {
    console.error('Error getting shipment request:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// POST /shipment-requests/:id/approve
export async function approveShipmentRequest(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const reviewedBy = req.user?.userId || req.body.reviewedBy;

    await client.query('BEGIN');
    const { rows } = await client.query(
      `
      UPDATE ${SHIPMENT_REQUEST_TABLE}
      SET status = 'APPROVED', reviewed_by = $2, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE request_id = $1 AND status = 'PENDING'
      RETURNING *
      `,
      [id, reviewedBy],
    );
    const request = rows[0];
    if (!request) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Request không tồn tại hoặc đã được xử lý' });
    }

    const transportContractId = randomUUID();
    const contractCode = `TC-${Date.now()}`;
    await client.query(
      `
      INSERT INTO ${TRANSPORT_CONTRACT_TABLE} (
        transport_contract_id, shipment_request_id, tenant_id, contract_code, status, notes
      )
      VALUES ($1, $2, $3, $4, 'DRAFT', $5)
      `,
      [
        transportContractId,
        request.request_id,
        request.tenant_id,
        contractCode,
        request.notes,
      ],
    );

    await client.query(
      `
      UPDATE ${SHIPMENT_REQUEST_TABLE}
      SET transport_contract_id = $2, updated_at = CURRENT_TIMESTAMP
      WHERE request_id = $1
      `,
      [id, transportContractId],
    );

    const { rows: tenantUsers } = await client.query(
      `SELECT user_id FROM ${USER_TABLE} WHERE tenant_id = $1 AND role = 'tenant_admin'`,
      [request.tenant_id],
    );
    for (const row of tenantUsers) {
      await notifyUser(
        client,
        row.user_id,
        'Yeu cau van chuyen da duoc chap nhan',
        `Yeu cau ${request.request_id} da duoc chap nhan. Hop dong van chuyen: ${contractCode}.`,
      );
    }

    await client.query('COMMIT');
    return res.json({
      ...mapShipmentRequestRow(request),
      transportContractId,
      transportContractCode: contractCode,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error approving shipment request:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  } finally {
    client.release();
  }
}

// POST /shipment-requests/:id/reject
export async function rejectShipmentRequest(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const reviewedBy = req.user?.userId || req.body.reviewedBy;
    const { rejectedReason } = req.body;
    if (!rejectedReason) {
      return res.status(400).json({ message: 'rejectedReason là bắt buộc' });
    }

    await client.query('BEGIN');
    const { rows } = await client.query(
      `
      UPDATE ${SHIPMENT_REQUEST_TABLE}
      SET status = 'REJECTED', reviewed_by = $2, rejected_reason = $3, updated_at = CURRENT_TIMESTAMP
      WHERE request_id = $1 AND status = 'PENDING'
      RETURNING *
      `,
      [id, reviewedBy, rejectedReason],
    );
    const request = rows[0];
    if (!request) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Request không tồn tại hoặc đã được xử lý' });
    }

    const { rows: tenantUsers } = await client.query(
      `SELECT user_id FROM ${USER_TABLE} WHERE tenant_id = $1 AND role = 'tenant_admin'`,
      [request.tenant_id],
    );
    for (const row of tenantUsers) {
      await notifyUser(
        client,
        row.user_id,
        'Yeu cau van chuyen bi tu choi',
        `Yeu cau ${request.request_id} bi tu choi. Ly do: ${rejectedReason}`,
      );
    }

    await client.query('COMMIT');
    return res.json(mapShipmentRequestRow(request));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error rejecting shipment request:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  } finally {
    client.release();
  }
}

