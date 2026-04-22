import pool from '../config/db.js';
import { randomUUID } from 'crypto';
import { tableName as CONTRACT_TABLE } from '../models/Contract.js';
import { tableName as RENTAL_REQUEST_TABLE } from '../models/RentalRequest.js';
import { tableName as CONTRACT_ITEM_TABLE } from '../models/ContractItem.js';
import { tableName as RACK_TABLE } from '../models/Rack.js';
import { tableName as LEVEL_TABLE } from '../models/Level.js';
import { tableName as ZONE_TABLE } from '../models/Zone.js';
import { tableName as WAREHOUSE_TABLE } from '../models/Warehouse.js';
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

async function getContractItemTargetIds(client, contractId) {
  const { rows } = await client.query(
    `
    SELECT rack_id, level_id
    FROM ${CONTRACT_ITEM_TABLE}
    WHERE contract_id = $1
    `,
    [contractId],
  );
  return {
    rackIds: [...new Set(rows.map((r) => r.rack_id).filter(Boolean))],
    levelIds: [...new Set(rows.map((r) => r.level_id).filter(Boolean))],
  };
}

async function syncRackAndLevelRentalStatus(client, { rackIds = [], levelIds = [] }) {
  if (rackIds.length > 0) {
    const rackPlaceholders = rackIds.map((_, idx) => `$${idx + 1}`).join(', ');
    await client.query(
      `
      UPDATE ${RACK_TABLE} r
      SET is_rented = EXISTS (
        SELECT 1
        FROM ${CONTRACT_ITEM_TABLE} ci
        JOIN ${CONTRACT_TABLE} c ON c.contract_id = ci.contract_id
        WHERE ci.rack_id = r.rack_id
          AND c.status IN ('SENT_TO_TENANT', 'SIGNED_BY_TENANT', 'ACTIVE')
      ),
      updated_at = CURRENT_TIMESTAMP
      WHERE r.rack_id IN (${rackPlaceholders})
      `,
      rackIds,
    );
  }

  if (levelIds.length > 0) {
    const levelPlaceholders = levelIds.map((_, idx) => `$${idx + 1}`).join(', ');
    await client.query(
      `
      UPDATE ${LEVEL_TABLE} l
      SET is_rented = EXISTS (
        SELECT 1
        FROM ${CONTRACT_ITEM_TABLE} ci
        JOIN ${CONTRACT_TABLE} c ON c.contract_id = ci.contract_id
        WHERE ci.level_id = l.level_id
          AND c.status IN ('SENT_TO_TENANT', 'SIGNED_BY_TENANT', 'ACTIVE')
      ),
      updated_at = CURRENT_TIMESTAMP
      WHERE l.level_id IN (${levelPlaceholders})
      `,
      levelIds,
    );
  }

  const warehouseIdSet = new Set();
  if (rackIds.length > 0) {
    const placeholders = rackIds.map((_, idx) => `$${idx + 1}`).join(', ');
    const { rows } = await client.query(
      `
      SELECT DISTINCT z.warehouse_id
      FROM ${RACK_TABLE} r
      JOIN ${ZONE_TABLE} z ON z.zone_id = r.zone_id
      WHERE r.rack_id IN (${placeholders})
      `,
      rackIds,
    );
    rows.forEach((r) => warehouseIdSet.add(r.warehouse_id));
  }
  if (levelIds.length > 0) {
    const placeholders = levelIds.map((_, idx) => `$${idx + 1}`).join(', ');
    const { rows } = await client.query(
      `
      SELECT DISTINCT z.warehouse_id
      FROM ${LEVEL_TABLE} l
      JOIN ${RACK_TABLE} r ON r.rack_id = l.rack_id
      JOIN ${ZONE_TABLE} z ON z.zone_id = r.zone_id
      WHERE l.level_id IN (${placeholders})
      `,
      levelIds,
    );
    rows.forEach((r) => warehouseIdSet.add(r.warehouse_id));
  }

  const warehouseIds = Array.from(warehouseIdSet);
  if (warehouseIds.length > 0) {
    const placeholders = warehouseIds.map((_, idx) => `$${idx + 1}`).join(', ');
    await client.query(
      `
      WITH warehouse_stats AS (
        SELECT
          w.warehouse_id,
          COUNT(DISTINCT r.rack_id) AS rack_count,
          COUNT(DISTINCT CASE WHEN r.is_rented THEN r.rack_id END) AS rented_rack_count,
          COUNT(DISTINCT l.level_id) AS level_count,
          COUNT(DISTINCT CASE WHEN l.is_rented THEN l.level_id END) AS rented_level_count
        FROM ${WAREHOUSE_TABLE} w
        LEFT JOIN ${ZONE_TABLE} z ON z.warehouse_id = w.warehouse_id
        LEFT JOIN ${RACK_TABLE} r ON r.zone_id = z.zone_id
        LEFT JOIN ${LEVEL_TABLE} l ON l.rack_id = r.rack_id
        WHERE w.warehouse_id IN (${placeholders})
        GROUP BY w.warehouse_id
      ),
      normalized AS (
        SELECT
          warehouse_id,
          CASE WHEN level_count > 0 THEN level_count ELSE rack_count END AS total_units,
          CASE WHEN level_count > 0 THEN rented_level_count ELSE rented_rack_count END AS rented_units
        FROM warehouse_stats
      )
      UPDATE ${WAREHOUSE_TABLE} w
      SET
        occupied_percent = CASE
          WHEN n.total_units <= 0 THEN 0
          ELSE ROUND((n.rented_units::numeric * 100.0) / n.total_units::numeric, 2)
        END,
        occupancy_status = CASE
          WHEN n.rented_units <= 0 THEN 'EMPTY'
          WHEN n.total_units > 0 AND n.rented_units >= n.total_units THEN 'FULL'
          ELSE 'PARTIAL'
        END,
        updated_at = CURRENT_TIMESTAMP
      FROM normalized n
      WHERE w.warehouse_id = n.warehouse_id
      `,
      warehouseIds,
    );
  }
}

// POST /contracts - Tạo contract mới
export async function createContract(req, res) {
  const client = await pool.connect();
  try {
    const {
      requestId,
      approvedBy = null,
      selectedRackIds = [],
      selectedLevelIds = [],
      totalRentalFee,
      status = 'DRAFT',
    } = req.body;
    const contractId = await generatePrefixedId(pool, {
      tableName: CONTRACT_TABLE,
      idColumn: 'contract_id',
      prefix: 'CTR',
    });

    if (!requestId || totalRentalFee === undefined) {
      return res.status(400).json({
        message: 'requestId, totalRentalFee là bắt buộc',
      });
    }
    if (!Number.isFinite(Number(totalRentalFee)) || Number(totalRentalFee) < 0) {
      return res.status(400).json({ message: 'totalRentalFee phải là số >= 0' });
    }

    if (!assertValidStatusTransition('DRAFT', status) && status !== 'DRAFT') {
      return res.status(400).json({ message: 'Trạng thái khởi tạo contract không hợp lệ' });
    }

    await client.query('BEGIN');

    const { rows: requestRows } = await client.query(
      `
      SELECT request_id, tenant_id, status, requested_start_date, rental_term_unit, duration_days, rental_type, warehouse_id
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

    const { rows: existingByRequestRows } = await client.query(
      `SELECT contract_id FROM ${CONTRACT_TABLE} WHERE request_id = $1 LIMIT 1`,
      [requestId],
    );
    if (existingByRequestRows.length > 0) {
      return res.status(409).json({ message: 'Request này đã có contract' });
    }

    const contractCode = `CTR-${rentalRequest.request_id}`;
    const startRaw = rentalRequest.requested_start_date;
    const startDate = startRaw instanceof Date ? startRaw.toISOString().slice(0, 10) : String(startRaw).slice(0, 10);
    const rentalDurationDays = Number(rentalRequest.duration_days);
    const startNoon = new Date(`${startDate}T12:00:00.000Z`);
    const endNoon = new Date(startNoon);
    endNoon.setUTCDate(endNoon.getUTCDate() + rentalDurationDays);
    const endDate = endNoon.toISOString().slice(0, 10);
    const billingCycle = rentalRequest.rental_term_unit;

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
      rentalRequest.tenant_id,
      approvedBy,
      contractCode,
      startDate,
      endDate,
      billingCycle,
      rentalDurationDays,
      totalRentalFee,
      status,
    ];

    const { rows } = await client.query(query, values);

    if (rentalRequest.rental_type === 'RACK') {
      if (!Array.isArray(selectedRackIds) || selectedRackIds.length === 0 || selectedLevelIds.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Request loại RACK yêu cầu selectedRackIds (không dùng selectedLevelIds)' });
      }
      const uniqueRackIds = [...new Set(selectedRackIds.filter((id) => typeof id === 'string' && id.trim() !== ''))];
      if (uniqueRackIds.length !== selectedRackIds.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'selectedRackIds chứa giá trị không hợp lệ' });
      }
      const placeholders = uniqueRackIds.map((_, idx) => `$${idx + 2}`).join(', ');
      const { rows: rackRows } = await client.query(
        `
        SELECT r.rack_id
        FROM ${RACK_TABLE} r
        INNER JOIN ${ZONE_TABLE} z ON z.zone_id = r.zone_id
        WHERE z.warehouse_id = $1 AND r.rack_id IN (${placeholders})
        `,
        [rentalRequest.warehouse_id, ...uniqueRackIds],
      );
      if (rackRows.length !== uniqueRackIds.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Có rack không tồn tại hoặc không thuộc warehouse của request' });
      }
      const itemUnitPrice = Number(totalRentalFee) / uniqueRackIds.length;
      for (const rackId of uniqueRackIds) {
        await client.query(
          `
          INSERT INTO ${CONTRACT_ITEM_TABLE}
          (item_id, contract_id, rent_type, warehouse_id, zone_id, rack_id, level_id, slot_id, unit_price)
          VALUES ($1, $2, 'RACK', $3, NULL, $4, NULL, NULL, $5)
          `,
          [randomUUID(), contractId, rentalRequest.warehouse_id, rackId, itemUnitPrice],
        );
      }
      await syncRackAndLevelRentalStatus(client, { rackIds: uniqueRackIds, levelIds: [] });
    } else if (rentalRequest.rental_type === 'LEVEL') {
      if (!Array.isArray(selectedLevelIds) || selectedLevelIds.length === 0 || selectedRackIds.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Request loại LEVEL yêu cầu selectedLevelIds (không dùng selectedRackIds)' });
      }
      const uniqueLevelIds = [...new Set(selectedLevelIds.filter((id) => typeof id === 'string' && id.trim() !== ''))];
      if (uniqueLevelIds.length !== selectedLevelIds.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'selectedLevelIds chứa giá trị không hợp lệ' });
      }
      const placeholders = uniqueLevelIds.map((_, idx) => `$${idx + 2}`).join(', ');
      const { rows: levelRows } = await client.query(
        `
        SELECT l.level_id
        FROM ${LEVEL_TABLE} l
        INNER JOIN ${RACK_TABLE} r ON r.rack_id = l.rack_id
        INNER JOIN ${ZONE_TABLE} z ON z.zone_id = r.zone_id
        WHERE z.warehouse_id = $1 AND l.level_id IN (${placeholders})
        `,
        [rentalRequest.warehouse_id, ...uniqueLevelIds],
      );
      if (levelRows.length !== uniqueLevelIds.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Có level không tồn tại hoặc không thuộc warehouse của request' });
      }
      const itemUnitPrice = Number(totalRentalFee) / uniqueLevelIds.length;
      for (const levelId of uniqueLevelIds) {
        await client.query(
          `
          INSERT INTO ${CONTRACT_ITEM_TABLE}
          (item_id, contract_id, rent_type, warehouse_id, zone_id, rack_id, level_id, slot_id, unit_price)
          VALUES ($1, $2, 'LEVEL', $3, NULL, NULL, $4, NULL, $5)
          `,
          [randomUUID(), contractId, rentalRequest.warehouse_id, levelId, itemUnitPrice],
        );
      }
      await syncRackAndLevelRentalStatus(client, { rackIds: [], levelIds: uniqueLevelIds });
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'rentalType của request không hợp lệ' });
    }

    await client.query('COMMIT');
    return res.status(201).json(mapContractRow(rows[0]));
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Error creating contract:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  } finally {
    client.release();
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
    if (updates.status !== undefined) {
      const { rackIds, levelIds } = await getContractItemTargetIds(pool, id);
      await syncRackAndLevelRentalStatus(pool, { rackIds, levelIds });
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
    const { rackIds, levelIds } = await getContractItemTargetIds(pool, id);
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
    await syncRackAndLevelRentalStatus(pool, { rackIds, levelIds });

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

    const { rackIds, levelIds } = await getContractItemTargetIds(client, id);
    await syncRackAndLevelRentalStatus(client, { rackIds, levelIds });

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

    const { rackIds, levelIds } = await getContractItemTargetIds(client, id);
    await syncRackAndLevelRentalStatus(client, { rackIds, levelIds });

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

