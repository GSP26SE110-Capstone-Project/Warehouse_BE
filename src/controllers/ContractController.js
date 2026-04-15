import pool from '../config/db.js';
import { randomUUID } from 'crypto';
import { tableName as CONTRACT_TABLE } from '../models/Contract.js';
import { tableName as RENTAL_REQUEST_TABLE } from '../models/RentalRequest.js';
import { tableName as USER_TABLE } from '../models/User.js';
import { tableName as NOTIFICATION_TABLE } from '../models/Notification.js';
import { generatePrefixedId } from '../utils/idGenerator.js';

function mapContractRow(row) {
  if (!row) return null;
  return {
    contractId: row.contract_id,
    requestId: row.request_id,
    tenantId: row.tenant_id,
    approvedBy: row.approved_by,
    contractCode: row.contract_code,
    startDate: row.start_date,
    endDate: row.end_date,
    billingCycle: row.billing_cycle,
    rentalDurationDays: row.rental_duration_days,
    totalRentalFee: row.total_rental_fee,
    contractFileUrl: row.contract_file_url,
    sentAt: row.sent_at,
    tenantSignedAt: row.tenant_signed_at,
    signedBy: row.signed_by,
    signatureMethod: row.signature_method,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CONTRACT_TRANSITIONS = {
  DRAFT: ['SENT_TO_TENANT', 'CANCELLED'],
  SENT_TO_TENANT: ['SIGNED_BY_TENANT', 'CANCELLED'],
  SIGNED_BY_TENANT: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['EXPIRED', 'CANCELLED'],
  EXPIRED: [],
  CANCELLED: [],
};

async function getTenantIdForUser(userId) {
  const { rows } = await pool.query(
    `SELECT tenant_id FROM ${USER_TABLE} WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  return rows[0]?.tenant_id || null;
}

function assertValidStatusTransition(currentStatus, nextStatus) {
  if (!nextStatus || nextStatus === currentStatus) return true;
  const allowed = CONTRACT_TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
}

async function createNotification(client, userId, { type, title, content }) {
  if (!userId) return;
  await client.query(
    `
    INSERT INTO ${NOTIFICATION_TABLE} (notification_id, user_id, type, title, content, is_read)
    VALUES ($1, $2, $3, $4, $5, false)
    `,
    [randomUUID(), userId, type, title, content],
  );
}

// POST /contracts - Tạo contract mới
export async function createContract(req, res) {
  try {
    const {
      contractId: incomingContractId = null,
      requestId,
      tenantId = null,
      approvedBy = null,
      contractCode,
      startDate,
      endDate,
      billingCycle = null,
      rentalDurationDays = null,
      totalRentalFee,
      status = 'DRAFT',
    } = req.body;
    const contractId = incomingContractId || await generatePrefixedId(pool, {
      tableName: CONTRACT_TABLE,
      idColumn: 'contract_id',
      prefix: 'CTR',
    });

    if (!requestId || !contractCode || !startDate || !endDate || totalRentalFee === undefined) {
      return res.status(400).json({
        message: 'requestId, contractCode, startDate, endDate, totalRentalFee là bắt buộc',
      });
    }

    if (!assertValidStatusTransition('DRAFT', status) && status !== 'DRAFT') {
      return res.status(400).json({ message: 'Trạng thái khởi tạo contract không hợp lệ' });
    }

    const conflictQuery = `
      SELECT 1
      FROM ${CONTRACT_TABLE}
      WHERE contract_id = $1 OR contract_code = $2
      LIMIT 1;
    `;
    const { rows: conflictRows } = await pool.query(conflictQuery, [contractId, contractCode]);
    if (conflictRows.length > 0) {
      return res.status(409).json({ message: 'contractId hoặc contractCode đã tồn tại' });
    }

    const { rows: requestRows } = await pool.query(
      `
      SELECT request_id, tenant_id, status
      FROM ${RENTAL_REQUEST_TABLE}
      WHERE request_id = $1
      LIMIT 1
      `,
      [requestId],
    );
    const rentalRequest = requestRows[0];
    if (!rentalRequest) {
      return res.status(404).json({ message: 'Rental request không tồn tại' });
    }
    if (rentalRequest.status !== 'APPROVED') {
      return res.status(400).json({ message: 'Chỉ có thể tạo contract từ request đã APPROVED' });
    }

    const { rows: existingByRequestRows } = await pool.query(
      `SELECT contract_id FROM ${CONTRACT_TABLE} WHERE request_id = $1 LIMIT 1`,
      [requestId],
    );
    if (existingByRequestRows.length > 0) {
      return res.status(409).json({ message: 'Request này đã có contract' });
    }

    const query = `
      INSERT INTO ${CONTRACT_TABLE} (
        contract_id,
        request_id,
        tenant_id,
        approved_by,
        contract_code,
        start_date,
        end_date,
        billing_cycle,
        rental_duration_days,
        total_rental_fee,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    const values = [
      contractId,
      requestId,
      tenantId || rentalRequest.tenant_id,
      approvedBy,
      contractCode,
      startDate,
      endDate,
      billingCycle,
      rentalDurationDays,
      totalRentalFee,
      status,
    ];
    const { rows } = await pool.query(query, values);
    return res.status(201).json(mapContractRow(rows[0]));
  } catch (error) {
    console.error('Error creating contract:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /contracts - Danh sách contracts
export async function listContracts(req, res) {
  try {
    const { page = 1, limit = 10, tenantId, status, search } = req.query;
    const offset = (page - 1) * limit;
    const requesterRole = req.user?.role;
    const requesterUserId = req.user?.userId;

    let whereClause = 'WHERE 1=1';
    const filterValues = [];
    let filterParamIndex = 1;
    let resolvedTenantId = tenantId;

    if (requesterRole === 'tenant_admin') {
      resolvedTenantId = await getTenantIdForUser(requesterUserId);
      if (!resolvedTenantId) {
        return res.json({
          contracts: [],
          pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total: 0, totalPages: 0 },
        });
      }
    }

    if (resolvedTenantId) {
      whereClause += ` AND c.tenant_id = $${filterParamIndex}`;
      filterValues.push(resolvedTenantId);
      filterParamIndex++;
    }

    if (status) {
      whereClause += ` AND c.status = $${filterParamIndex}`;
      filterValues.push(status);
      filterParamIndex++;
    }

    if (search) {
      whereClause += ` AND c.contract_code ILIKE $${filterParamIndex}`;
      filterValues.push(`%${search}%`);
      filterParamIndex++;
    }

    const listLimitParam = filterParamIndex;
    const listOffsetParam = filterParamIndex + 1;
    const values = [...filterValues, limit, offset];

    const query = `
      SELECT c.*
      FROM ${CONTRACT_TABLE} c
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${listLimitParam} OFFSET $${listOffsetParam};
    `;
    const { rows } = await pool.query(query, values);

    const countQuery = `SELECT COUNT(*) as total FROM ${CONTRACT_TABLE} c ${whereClause};`;
    const { rows: countRows } = await pool.query(countQuery, filterValues);

    return res.json({
      contracts: rows.map(mapContractRow),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: parseInt(countRows[0].total, 10),
        totalPages: Math.ceil(countRows[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing contracts:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /contracts/:id - Lấy chi tiết contract
export async function getContractById(req, res) {
  try {
    const { id } = req.params;
    const requesterRole = req.user?.role;
    const requesterUserId = req.user?.userId;
    const query = `
      SELECT *
      FROM ${CONTRACT_TABLE}
      WHERE contract_id = $1
      LIMIT 1;
    `;
    const { rows } = await pool.query(query, [id]);
    const contract = mapContractRow(rows[0]);
    if (!contract) {
      return res.status(404).json({ message: 'Contract không tồn tại' });
    }

    if (requesterRole === 'tenant_admin') {
      const requesterTenantId = await getTenantIdForUser(requesterUserId);
      if (!requesterTenantId || contract.tenantId !== requesterTenantId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }
    return res.json(contract);
  } catch (error) {
    console.error('Error getting contract:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// PATCH /contracts/:id - Cập nhật contract
export async function updateContract(req, res) {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    delete updates.contractId;
    delete updates.createdAt;
    delete updates.updatedAt;

    const { rows: currentRows } = await pool.query(
      `SELECT * FROM ${CONTRACT_TABLE} WHERE contract_id = $1 LIMIT 1`,
      [id],
    );
    const current = currentRows[0];
    if (!current) {
      return res.status(404).json({ message: 'Contract không tồn tại' });
    }

    if (updates.status && !assertValidStatusTransition(current.status, updates.status)) {
      return res.status(400).json({
        message: `Không thể chuyển trạng thái từ ${current.status} sang ${updates.status}`,
      });
    }

    if (updates.contractCode) {
      const conflictQuery = `
        SELECT 1
        FROM ${CONTRACT_TABLE}
        WHERE contract_code = $1 AND contract_id <> $2
        LIMIT 1;
      `;
      const { rows: conflictRows } = await pool.query(conflictQuery, [updates.contractCode, id]);
      if (conflictRows.length > 0) {
        return res.status(409).json({ message: 'contractCode đã tồn tại' });
      }
    }

    const allowed = [
      'requestId',
      'tenantId',
      'approvedBy',
      'contractCode',
      'startDate',
      'endDate',
      'billingCycle',
      'rentalDurationDays',
      'totalRentalFee',
      'contractFileUrl',
      'sentAt',
      'tenantSignedAt',
      'signedBy',
      'signatureMethod',
      'status',
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
      UPDATE ${CONTRACT_TABLE}
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE contract_id = $${paramIndex}
      RETURNING *;
    `;
    const { rows } = await pool.query(query, values);
    const contract = mapContractRow(rows[0]);
    if (!contract) {
      return res.status(404).json({ message: 'Contract không tồn tại' });
    }
    return res.json(contract);
  } catch (error) {
    console.error('Error updating contract:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// DELETE /contracts/:id - Hủy contract (soft delete)
export async function deleteContract(req, res) {
  try {
    const { id } = req.params;
    const query = `
      UPDATE ${CONTRACT_TABLE}
      SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
      WHERE contract_id = $1
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [id]);
    const contract = mapContractRow(rows[0]);
    if (!contract) {
      return res.status(404).json({ message: 'Contract không tồn tại' });
    }

    return res.json({
      message: 'Contract đã được hủy',
      contract,
    });
  } catch (error) {
    console.error('Error deleting contract:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// POST /contracts/:id/send - Admin gui hop dong cho tenant
export async function sendContractToTenant(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { contractFileUrl } = req.body;

    await client.query('BEGIN');
    const { rows } = await client.query(
      `
      UPDATE ${CONTRACT_TABLE}
      SET
        contract_file_url = COALESCE($2, contract_file_url),
        sent_at = CURRENT_TIMESTAMP,
        status = 'SENT_TO_TENANT',
        updated_at = CURRENT_TIMESTAMP
      WHERE contract_id = $1
        AND status = 'DRAFT'
      RETURNING *;
      `,
      [id, contractFileUrl || null],
    );
    const contract = rows[0];
    if (!contract) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Contract không tồn tại hoặc không ở trạng thái DRAFT' });
    }

    const { rows: tenantAdminRows } = await client.query(
      `SELECT user_id FROM ${USER_TABLE} WHERE tenant_id = $1 AND role = 'tenant_admin'`,
      [contract.tenant_id],
    );
    for (const row of tenantAdminRows) {
      await createNotification(client, row.user_id, {
        type: 'REQUEST_STATUS',
        title: 'Hop dong da duoc gui',
        content: `Hop dong ${contract.contract_code} da duoc gui. Vui long kiem tra va ky.`,
      });
    }

    await client.query('COMMIT');
    return res.json(mapContractRow(contract));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error sending contract to tenant:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  } finally {
    client.release();
  }
}

// POST /contracts/:id/sign - Tenant ky hop dong
export async function signContractByTenant(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { signatureMethod = 'CONFIRM' } = req.body;
    const signedBy = req.user?.userId;
    if (!signedBy) return res.status(401).json({ message: 'Unauthorized' });

    const requesterTenantId = await getTenantIdForUser(signedBy);
    if (!requesterTenantId) {
      return res.status(403).json({ message: 'Tenant user không thuộc tenant nào' });
    }

    await client.query('BEGIN');
    const { rows } = await client.query(
      `
      UPDATE ${CONTRACT_TABLE}
      SET
        signature_method = $2,
        signed_by = $3,
        tenant_signed_at = CURRENT_TIMESTAMP,
        status = 'SIGNED_BY_TENANT',
        updated_at = CURRENT_TIMESTAMP
      WHERE contract_id = $1
        AND tenant_id = $4
        AND status = 'SENT_TO_TENANT'
      RETURNING *;
      `,
      [id, signatureMethod, signedBy, requesterTenantId],
    );
    const contract = rows[0];
    if (!contract) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: 'Contract không tồn tại/không thuộc tenant của bạn hoặc chưa ở trạng thái SENT_TO_TENANT',
      });
    }

    if (contract.approved_by) {
      await createNotification(client, contract.approved_by, {
        type: 'REQUEST_STATUS',
        title: 'Tenant da ky hop dong',
        content: `Hop dong ${contract.contract_code} da duoc tenant ky.`,
      });
    }

    await client.query('COMMIT');
    return res.json(mapContractRow(contract));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error signing contract:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  } finally {
    client.release();
  }
}

