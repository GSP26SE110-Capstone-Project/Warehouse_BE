import pool from '../config/db.js';
import { randomUUID } from 'crypto';
import { tableName as TRANSPORT_CONTRACT_TABLE } from '../models/TransportContract.js';
import { tableName as SHIPMENT_REQUEST_TABLE } from '../models/ShipmentRequest.js';
import { tableName as SHIPMENT_TABLE } from '../models/Shipment.js';
import { tableName as USER_TABLE } from '../models/User.js';
import { tableName as NOTIFICATION_TABLE } from '../models/Notification.js';

function mapTransportContractRow(row) {
  if (!row) return null;
  return {
    transportContractId: row.transport_contract_id,
    shipmentRequestId: row.shipment_request_id,
    tenantId: row.tenant_id,
    contractCode: row.contract_code,
    fileUrl: row.file_url,
    sentBy: row.sent_by,
    sentAt: row.sent_at,
    signedBy: row.signed_by,
    signedAt: row.signed_at,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getTenantIdByUserId(userId) {
  const { rows } = await pool.query(`SELECT tenant_id FROM ${USER_TABLE} WHERE user_id = $1 LIMIT 1`, [userId]);
  return rows[0]?.tenant_id || null;
}

async function createNotification(client, userId, title, content) {
  if (!userId) return;
  await client.query(
    `
    INSERT INTO ${NOTIFICATION_TABLE} (notification_id, user_id, type, title, content, is_read)
    VALUES ($1, $2, 'SHIPMENT_TRACKING', $3, $4, false)
    `,
    [randomUUID(), userId, title, content],
  );
}

// GET /transport-contracts/:id
export async function getTransportContractById(req, res) {
  try {
    const { id } = req.params;
    const role = req.user?.role;
    const userId = req.user?.userId;
    const tenantId = role === 'tenant_admin' ? await getTenantIdByUserId(userId) : null;

    const { rows } = await pool.query(
      `SELECT * FROM ${TRANSPORT_CONTRACT_TABLE} WHERE transport_contract_id = $1 LIMIT 1`,
      [id],
    );
    const contract = rows[0];
    if (!contract) return res.status(404).json({ message: 'Transport contract không tồn tại' });
    if (tenantId && contract.tenant_id !== tenantId) return res.status(403).json({ message: 'Forbidden' });
    return res.json(mapTransportContractRow(contract));
  } catch (error) {
    console.error('Error getting transport contract:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// POST /transport-contracts/:id/send
export async function sendTransportContract(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const sentBy = req.user?.userId || req.body.sentBy;
    const { fileUrl = null } = req.body;

    await client.query('BEGIN');
    const { rows } = await client.query(
      `
      UPDATE ${TRANSPORT_CONTRACT_TABLE}
      SET file_url = COALESCE($2, file_url),
          sent_by = $3,
          sent_at = CURRENT_TIMESTAMP,
          status = 'SENT_TO_TENANT',
          updated_at = CURRENT_TIMESTAMP
      WHERE transport_contract_id = $1
        AND status = 'DRAFT'
      RETURNING *;
      `,
      [id, fileUrl, sentBy],
    );
    const contract = rows[0];
    if (!contract) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Contract không tồn tại hoặc không ở trạng thái DRAFT' });
    }

    const { rows: tenantUserRows } = await client.query(
      `SELECT user_id FROM ${USER_TABLE} WHERE tenant_id = $1 AND role = 'tenant_admin'`,
      [contract.tenant_id],
    );
    for (const row of tenantUserRows) {
      await createNotification(
        client,
        row.user_id,
        'Hop dong van chuyen da duoc gui',
        `Hop dong ${contract.contract_code} da duoc gui. Vui long ky xac nhan.`,
      );
    }

    await client.query('COMMIT');
    return res.json(mapTransportContractRow(contract));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error sending transport contract:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  } finally {
    client.release();
  }
}

// POST /transport-contracts/:id/sign
export async function signTransportContract(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const signedBy = req.user?.userId;
    const {
      providerId = null,
      driverId = null,
      supervisorId = null,
      scheduledTime = null,
      totalWeight = null,
      totalDistance = null,
      shippingFee = null,
    } = req.body;
    const tenantId = await getTenantIdByUserId(signedBy);
    if (!tenantId) return res.status(403).json({ message: 'Tenant user chưa gắn tenantId' });

    await client.query('BEGIN');
    const { rows } = await client.query(
      `
      UPDATE ${TRANSPORT_CONTRACT_TABLE}
      SET signed_by = $2,
          signed_at = CURRENT_TIMESTAMP,
          status = 'SIGNED_BY_TENANT',
          updated_at = CURRENT_TIMESTAMP
      WHERE transport_contract_id = $1
        AND tenant_id = $3
        AND status = 'SENT_TO_TENANT'
      RETURNING *;
      `,
      [id, signedBy, tenantId],
    );
    const contract = rows[0];
    if (!contract) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Contract không hợp lệ hoặc chưa ở trạng thái SENT_TO_TENANT' });
    }

    const { rows: requestRows } = await client.query(
      `SELECT * FROM ${SHIPMENT_REQUEST_TABLE} WHERE request_id = $1 LIMIT 1`,
      [contract.shipment_request_id],
    );
    const request = requestRows[0];
    if (!request) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Shipment request gốc không tồn tại' });
    }

    let shipmentId = request.shipment_id;
    if (!shipmentId) {
      shipmentId = randomUUID();
      await client.query(
        `
        INSERT INTO ${SHIPMENT_TABLE} (
          shipment_id, contract_id, shipment_type, provider_id, driver_id, supervisor_id,
          from_address, to_address, scheduled_time, total_weight, total_distance, shipping_fee, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'SCHEDULING')
        `,
        [
          shipmentId,
          request.contract_id,
          request.shipment_type,
          providerId,
          driverId,
          supervisorId,
          request.from_address,
          request.to_address,
          scheduledTime || request.preferred_pickup_time,
          totalWeight,
          totalDistance,
          shippingFee,
        ],
      );

      await client.query(
        `UPDATE ${SHIPMENT_REQUEST_TABLE} SET shipment_id = $2, updated_at = CURRENT_TIMESTAMP WHERE request_id = $1`,
        [request.request_id, shipmentId],
      );
    }

    if (request.reviewed_by) {
      await createNotification(
        client,
        request.reviewed_by,
        'Tenant da ky hop dong van chuyen',
        `Hop dong ${contract.contract_code} da duoc ky. Shipment ${shipmentId} da duoc tao.`,
      );
    }
    if (driverId) {
      await createNotification(
        client,
        driverId,
        'Ban duoc phan cong van chuyen',
        `Ban duoc phan cong cho shipment ${shipmentId}.`,
      );
    }

    await client.query('COMMIT');
    return res.json({
      contract: mapTransportContractRow(contract),
      shipmentId,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error signing transport contract:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  } finally {
    client.release();
  }
}

