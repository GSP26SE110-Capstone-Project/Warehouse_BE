import pool from '../config/db.js';
import { randomUUID } from 'crypto';
import { tableName as RENTAL_REQUEST_TABLE } from '../models/RentalRequest.js';
import { tableName as RENTAL_REQUEST_ZONE_TABLE } from '../models/RentalRequestZone.js';
import { tableName as ZONE_TABLE } from '../models/Zone.js';
import { tableName as CONTRACT_TABLE } from '../models/Contract.js';
import { tableName as CONTRACT_ITEM_TABLE } from '../models/ContractItem.js';
import { tableName as NOTIFICATION_TABLE } from '../models/Notification.js';
import { tableName as USER_TABLE } from '../models/User.js';
import { tableName as TENANT_TABLE } from '../models/Tenant.js';
import { generatePrefixedId } from '../utils/idGenerator.js';

function trimTenantId(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return String(value);
  const t = value.trim();
  return t === '' ? null : t;
}

// Map DB row -> domain object
function mapRentalRequestRow(row) {
  if (!row) return null;
  return {
    requestId: row.request_id,
    customerType: row.customer_type,
    tenantId: row.tenant_id,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    warehouseId: row.warehouse_id,
    storageType: row.storage_type,
    status: row.status,
    requestedStartDate: row.requested_start_date,
    rentalTermUnit: row.rental_term_unit,
    rentalTermValue: row.rental_term_value,
    durationDays: row.duration_days,
    goodsType: row.goods_type,
    goodsDescription: row.goods_description,
    goodsQuantity: row.goods_quantity,
    goodsWeightKg: row.goods_weight_kg,
    notes: row.notes,
    approvedBy: row.approved_by,
    rejectedReason: row.rejected_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function calculateDurationDays(rentalTermUnit, rentalTermValue) {
  const normalizedUnit = String(rentalTermUnit || '').toUpperCase();
  const unitToDays = {
    MONTH: 30,
    QUARTER: 90,
    YEAR: 365,
  };
  return unitToDays[normalizedUnit] * Number(rentalTermValue);
}

function validateRentalRequestPayload(payload, { isUpdate = false } = {}) {
  const required = [
    'customerType',
    'contactName',
    'contactPhone',
    'contactEmail',
    'warehouseId',
    'requestedStartDate',
    'rentalTermUnit',
    'rentalTermValue',
    'goodsType',
    'goodsQuantity',
    'goodsWeightKg',
  ];

  if (!isUpdate) {
    for (const field of required) {
      if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
        return `${field} là bắt buộc`;
      }
    }
  }

  const customerType = String(payload.customerType || '').toLowerCase();
  if (customerType && !['individual', 'business'].includes(customerType)) {
    return 'customerType chỉ chấp nhận individual hoặc business';
  }
  if (customerType === 'business' && !payload.tenantId) {
    return 'tenantId là bắt buộc khi customerType = business';
  }

  const storageType = String(payload.storageType || 'normal').toLowerCase();
  if (storageType !== 'normal') {
    return 'Hiện tại chỉ hỗ trợ storageType = normal';
  }

  const rentalTermUnit = String(payload.rentalTermUnit || '').toUpperCase();
  if (rentalTermUnit && !['MONTH', 'QUARTER', 'YEAR'].includes(rentalTermUnit)) {
    return 'rentalTermUnit chỉ chấp nhận MONTH, QUARTER hoặc YEAR';
  }

  if (
    payload.rentalTermValue !== undefined &&
    (!Number.isInteger(Number(payload.rentalTermValue)) || Number(payload.rentalTermValue) <= 0)
  ) {
    return 'rentalTermValue phải là số nguyên dương';
  }

  if (
    payload.goodsQuantity !== undefined &&
    (Number(payload.goodsQuantity) <= 0 || Number.isNaN(Number(payload.goodsQuantity)))
  ) {
    return 'goodsQuantity phải lớn hơn 0';
  }

  if (
    payload.goodsWeightKg !== undefined &&
    (Number(payload.goodsWeightKg) < 0 || Number.isNaN(Number(payload.goodsWeightKg)))
  ) {
    return 'goodsWeightKg phải >= 0';
  }

  return null;
}

async function findNotifiedUserIds(client, rentalRequestRow) {
  const result = new Set();
  if (rentalRequestRow.tenant_id) {
    const { rows } = await client.query(
      `SELECT user_id FROM ${USER_TABLE} WHERE tenant_id = $1 AND role = 'tenant_admin'`,
      [rentalRequestRow.tenant_id],
    );
    rows.forEach((row) => result.add(row.user_id));
  }

  if (rentalRequestRow.contact_email) {
    const { rows } = await client.query(
      `SELECT user_id FROM ${USER_TABLE} WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [rentalRequestRow.contact_email],
    );
    if (rows[0]?.user_id) result.add(rows[0].user_id);
  }
  return Array.from(result);
}

async function createNotifications(client, userIds, { type, title, content }) {
  for (const userId of userIds) {
    await client.query(
      `
      INSERT INTO ${NOTIFICATION_TABLE} (notification_id, user_id, type, title, content, is_read)
      VALUES ($1, $2, $3, $4, $5, false)
      `,
      [randomUUID(), userId, type, title, content],
    );
  }
}

// POST /rental-requests - Tạo rental request mới
export async function createRentalRequest(req, res) {
  const {
    customerType,
    tenantId,
    contactName,
    contactPhone,
    contactEmail,
    warehouseId,
    storageType = 'normal',
    requestedStartDate,
    rentalTermUnit,
    rentalTermValue,
    goodsType,
    goodsDescription,
    goodsQuantity,
    goodsWeightKg,
    notes,
    selectedZones, // array of zoneIds
  } = req.body;

  const validationError = validateRentalRequestPayload({
    customerType,
    tenantId: trimTenantId(tenantId),
    contactName,
    contactPhone,
    contactEmail,
    warehouseId,
    storageType,
    requestedStartDate,
    rentalTermUnit,
    rentalTermValue,
    goodsType,
    goodsDescription,
    goodsQuantity,
    goodsWeightKg,
  });
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const normalizedCustomerType = String(customerType).toLowerCase();
  const normalizedStorageType = String(storageType || 'normal').toLowerCase();
  const normalizedTermUnit = String(rentalTermUnit).toUpperCase();
  const normalizedTermValue = Number(rentalTermValue);
  const computedDurationDays = calculateDurationDays(normalizedTermUnit, normalizedTermValue);

  const tenantIdFromBody = trimTenantId(tenantId);
  let effectiveTenantId = tenantIdFromBody;

  if (!effectiveTenantId && req.user?.userId) {
    const { rows: userRows } = await pool.query(
      `SELECT tenant_id FROM ${USER_TABLE} WHERE user_id = $1 LIMIT 1`,
      [req.user.userId],
    );
    effectiveTenantId = userRows[0]?.tenant_id ? String(userRows[0].tenant_id).trim() : null;
    if (effectiveTenantId === '') effectiveTenantId = null;
  }

  if (!effectiveTenantId) {
    return res.status(400).json({
      message:
        'Thiếu tenantId. Cột tenant_id trong database là NOT NULL: với customerType = individual hãy gửi tenantId trong body hoặc đăng nhập bằng user đã gắn tenant; với business thì tenantId là bắt buộc trong body.',
    });
  }

  const { rows: tenantRows } = await pool.query(
    `SELECT 1 FROM ${TENANT_TABLE} WHERE tenant_id = $1 LIMIT 1`,
    [effectiveTenantId],
  );
  if (tenantRows.length === 0) {
    return res.status(400).json({ message: 'tenantId không tồn tại trong hệ thống' });
  }

  const requestId = await generatePrefixedId(pool, {
    tableName: RENTAL_REQUEST_TABLE,
    idColumn: 'request_id',
    prefix: 'RRQ',
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Tạo rental request
    const requestQuery = `
      INSERT INTO ${RENTAL_REQUEST_TABLE} (
        request_id,
        customer_type,
        tenant_id,
        contact_name,
        contact_phone,
        contact_email,
        warehouse_id,
        storage_type,
        requested_start_date,
        rental_term_unit,
        rental_term_value,
        duration_days,
        goods_type,
        goods_description,
        goods_quantity,
        goods_weight_kg,
        notes,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'PENDING')
      RETURNING *;
    `;

    const requestValues = [
      requestId,
      normalizedCustomerType,
      effectiveTenantId,
      contactName,
      contactPhone,
      contactEmail,
      warehouseId,
      normalizedStorageType,
      requestedStartDate,
      normalizedTermUnit,
      normalizedTermValue,
      computedDurationDays,
      goodsType,
      goodsDescription ?? null,
      goodsQuantity,
      goodsWeightKg,
      notes,
    ];
    const { rows: requestRows } = await client.query(requestQuery, requestValues);

    // Thêm zones đã chọn (nếu có)
    if (selectedZones !== undefined) {
      if (!Array.isArray(selectedZones)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'selectedZones phải là mảng zoneId' });
      }

      const sanitizedZoneIds = selectedZones.filter(
        (zoneId) => typeof zoneId === 'string' && zoneId.trim() !== ''
      );

      if (sanitizedZoneIds.length !== selectedZones.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'selectedZones chứa zoneId không hợp lệ' });
      }

      if (sanitizedZoneIds.length > 0) {
        const uniqueZoneIds = [...new Set(sanitizedZoneIds)];
        const zonePlaceholders = uniqueZoneIds.map((_, i) => `$${i + 2}`).join(', ');
        const { rows: existingZones } = await client.query(
          `SELECT zone_id FROM ${ZONE_TABLE} WHERE warehouse_id = $1 AND zone_id IN (${zonePlaceholders})`,
          [warehouseId, ...uniqueZoneIds],
        );
        const foundIds = new Set(existingZones.map((r) => r.zone_id));
        const invalidZoneIds = uniqueZoneIds.filter((zid) => !foundIds.has(zid));
        if (invalidZoneIds.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            message:
              'Một hoặc nhiều zone không tồn tại hoặc không thuộc warehouse đã chọn (kiểm tra zone_id trong DB)',
            invalidZoneIds,
          });
        }

        const placeholders = uniqueZoneIds
          .map((_, index) => `($1, $${index + 2})`)
          .join(', ');
        const zoneQuery = `
          INSERT INTO ${RENTAL_REQUEST_ZONE_TABLE} (rental_request_id, zone_id)
          VALUES ${placeholders};
        `;
        await client.query(zoneQuery, [requestId, ...uniqueZoneIds]);
      }
    }

    await client.query('COMMIT');

    const result = mapRentalRequestRow(requestRows[0]);
    if (Array.isArray(selectedZones)) {
      const sanitized = selectedZones.filter(
        (zoneId) => typeof zoneId === 'string' && zoneId.trim() !== '',
      );
      result.selectedZones = sanitized.length ? [...new Set(sanitized)] : [];
    } else {
      result.selectedZones = [];
    }

    return res.status(201).json(result);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    console.error('Error creating rental request:', error);
    if (error.code === '23502') {
      return res.status(400).json({ message: 'Dữ liệu không hợp lệ: thiếu giá trị bắt buộc (ví dụ tenant_id)' });
    }
    if (error.code === '23503') {
      return res.status(400).json({ message: 'Không thể tạo rental request: warehouseId hoặc tenantId không tồn tại' });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  } finally {
    client.release();
  }
}

// GET /rental-requests - Danh sách rental requests
export async function listRentalRequests(req, res) {
  try {
    const { page = 1, limit = 10, status, tenantId } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let values = [limit, offset];
    let paramIndex = 3;

    if (status) {
      whereClause += ` AND rr.status = $${paramIndex}`;
      values.push(status);
      paramIndex++;
    }

    if (tenantId) {
      whereClause += ` AND rr.tenant_id = $${paramIndex}`;
      values.push(tenantId);
      paramIndex++;
    }

    const query = `
      SELECT rr.*, t.company_name as tenant_name
      FROM ${RENTAL_REQUEST_TABLE} rr
      LEFT JOIN tenants t ON rr.tenant_id = t.tenant_id
      WHERE 1=1 ${whereClause}
      ORDER BY rr.created_at DESC
      LIMIT $1 OFFSET $2;
    `;

    const { rows } = await pool.query(query, values);
    const requests = rows.map(mapRentalRequestRow);

    // Đếm tổng số
    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${RENTAL_REQUEST_TABLE} rr
      WHERE 1=1 ${whereClause};
    `;
    const countValues = values.slice(2); // Remove limit and offset
    const { rows: countRows } = await pool.query(countQuery, countValues);

    return res.json({
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countRows[0].total),
        totalPages: Math.ceil(countRows[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing rental requests:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /rental-requests/:id - Lấy chi tiết rental request
export async function getRentalRequestById(req, res) {
  try {
    const { id } = req.params;

    const query = `
      SELECT rr.*, t.company_name as tenant_name
      FROM ${RENTAL_REQUEST_TABLE} rr
      LEFT JOIN tenants t ON rr.tenant_id = t.tenant_id
      WHERE rr.request_id = $1;
    `;
    const { rows } = await pool.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Rental request không tồn tại' });
    }

    const request = mapRentalRequestRow(rows[0]);

    // Lấy zones đã chọn
    const zonesQuery = `
      SELECT z.*, rrz.zone_id
      FROM ${RENTAL_REQUEST_ZONE_TABLE} rrz
      JOIN ${ZONE_TABLE} z ON rrz.zone_id = z.zone_id
      WHERE rrz.rental_request_id = $1;
    `;
    const { rows: zonesRows } = await pool.query(zonesQuery, [id]);
    request.selectedZones = zonesRows;

    return res.json(request);
  } catch (error) {
    console.error('Error getting rental request:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// PATCH /rental-requests/:id - Cập nhật rental request
export async function updateRentalRequest(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Kiểm tra request tồn tại và status = PENDING
    const checkQuery = `SELECT * FROM ${RENTAL_REQUEST_TABLE} WHERE request_id = $1;`;
    const { rows: checkRows } = await pool.query(checkQuery, [id]);
    if (checkRows.length === 0) {
      return res.status(404).json({ message: 'Rental request không tồn tại' });
    }
    if (checkRows[0].status !== 'PENDING') {
      return res.status(400).json({ message: 'Không thể cập nhật request đã được xử lý' });
    }

    const current = mapRentalRequestRow(checkRows[0]);
    const merged = {
      ...current,
      ...updates,
    };
    const validationError = validateRentalRequestPayload(merged, { isUpdate: true });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    // Build dynamic update query
    const allowedFields = [
      'customerType',
      'tenantId',
      'contactName',
      'contactPhone',
      'contactEmail',
      'warehouseId',
      'storageType',
      'requestedStartDate',
      'rentalTermUnit',
      'rentalTermValue',
      'goodsType',
      'goodsDescription',
      'goodsQuantity',
      'goodsWeightKg',
      'notes',
    ];

    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      if (
        updates[key] === undefined ||
        key === 'selectedZones' ||
        !allowedFields.includes(key) ||
        key === 'rentalTermUnit' ||
        key === 'rentalTermValue'
      ) {
        return;
      }
      const dbField = key.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
      fields.push(`${dbField} = $${paramIndex}`);
      let nextValue = updates[key];
      if (key === 'customerType') nextValue = String(updates[key]).toLowerCase();
      if (key === 'storageType') nextValue = String(updates[key]).toLowerCase();
      values.push(nextValue);
      paramIndex++;
    });

    if (updates.rentalTermUnit !== undefined || updates.rentalTermValue !== undefined) {
      const normalizedTermUnit = String(merged.rentalTermUnit).toUpperCase();
      const normalizedTermValue = Number(merged.rentalTermValue);
      const computedDurationDays = calculateDurationDays(normalizedTermUnit, normalizedTermValue);

      fields.push(`rental_term_unit = $${paramIndex}`);
      values.push(normalizedTermUnit);
      paramIndex++;

      fields.push(`rental_term_value = $${paramIndex}`);
      values.push(normalizedTermValue);
      paramIndex++;

      fields.push(`duration_days = $${paramIndex}`);
      values.push(computedDurationDays);
      paramIndex++;
    }

    if (String(merged.customerType || '').toLowerCase() === 'individual') {
      fields.push(`tenant_id = $${paramIndex}`);
      values.push(null);
      paramIndex++;
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'Không có field nào để cập nhật' });
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE ${RENTAL_REQUEST_TABLE}
      SET ${fields.join(', ')}
      WHERE request_id = $${paramIndex}
      RETURNING *;
    `;

    const { rows } = await pool.query(query, values);
    return res.json(mapRentalRequestRow(rows[0]));
  } catch (error) {
    console.error('Error updating rental request:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// POST /rental-requests/:id/approve - Approve rental request
export async function approveRentalRequest(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const approvedBy = req.user?.userId;

    if (!approvedBy) {
      return res.status(400).json({ message: 'Không xác định được người duyệt; vui lòng đăng nhập lại' });
    }

    await client.query('BEGIN');

    const updateQuery = `
      UPDATE ${RENTAL_REQUEST_TABLE}
      SET status = 'APPROVED', approved_by = $2, updated_at = CURRENT_TIMESTAMP
      WHERE request_id = $1 AND status = 'PENDING'
      RETURNING *;
    `;

    const { rows } = await client.query(updateQuery, [id, approvedBy]);
    const approvedRequest = rows[0];
    if (!approvedRequest) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Request không tồn tại hoặc đã được xử lý' });
    }

    const { rows: existingContractRows } = await client.query(
      `SELECT contract_id FROM ${CONTRACT_TABLE} WHERE request_id = $1 LIMIT 1`,
      [id],
    );
    let generatedContractId = existingContractRows[0]?.contract_id || null;

    if (!generatedContractId && approvedRequest.tenant_id) {
      generatedContractId = randomUUID();
      const contractCode = `CT-${Date.now()}`;

      const startRaw = approvedRequest.requested_start_date;
      const startStr =
        startRaw instanceof Date
          ? startRaw.toISOString().slice(0, 10)
          : String(startRaw).slice(0, 10);
      const durationDays = Number(approvedRequest.duration_days);
      const startNoon = new Date(`${startStr}T12:00:00.000Z`);
      const endNoon = new Date(startNoon);
      endNoon.setUTCDate(endNoon.getUTCDate() + durationDays);
      const endStr = endNoon.toISOString().slice(0, 10);

      await client.query(
        `
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
        VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, $8, $9, $10, $11)
        `,
        [
          generatedContractId,
          approvedRequest.request_id,
          approvedRequest.tenant_id,
          approvedBy,
          contractCode,
          startStr,
          endStr,
          approvedRequest.rental_term_unit,
          durationDays,
          0,
          'ACTIVE',
        ],
      );

      const { rows: zoneLinks } = await client.query(
        `
        SELECT rrz.zone_id, z.warehouse_id
        FROM ${RENTAL_REQUEST_ZONE_TABLE} rrz
        INNER JOIN ${ZONE_TABLE} z ON z.zone_id = rrz.zone_id
        WHERE rrz.rental_request_id = $1
        `,
        [id],
      );

      if (zoneLinks.length > 0) {
        for (const row of zoneLinks) {
          await client.query(
            `
            INSERT INTO ${CONTRACT_ITEM_TABLE} (
              item_id, contract_id, rent_type, warehouse_id, zone_id, slot_id, unit_price
            )
            VALUES ($1, $2, 'ZONE', $3, $4, NULL, 0)
            `,
            [randomUUID(), generatedContractId, row.warehouse_id, row.zone_id],
          );
        }
      } else {
        await client.query(
          `
          INSERT INTO ${CONTRACT_ITEM_TABLE} (
            item_id, contract_id, rent_type, warehouse_id, zone_id, slot_id, unit_price
          )
          VALUES ($1, $2, 'ENTIRE_WAREHOUSE', $3, NULL, NULL, 0)
          `,
          [randomUUID(), generatedContractId, approvedRequest.warehouse_id],
        );
      }
    }

    const userIds = await findNotifiedUserIds(client, approvedRequest);
    if (userIds.length > 0) {
      await createNotifications(client, userIds, {
        type: 'REQUEST_STATUS',
        title: 'Don thue kho da duoc chap nhan',
        content: `Yeu cau ${approvedRequest.request_id} da duoc duyet. Hop dong nhap: ${generatedContractId}.`,
      });
    }

    await client.query('COMMIT');
    return res.json({
      ...mapRentalRequestRow(approvedRequest),
      generatedContractId,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error approving rental request:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  } finally {
    client.release();
  }
}

// POST /rental-requests/:id/reject - Reject rental request
export async function rejectRentalRequest(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const approvedBy = req.user?.userId;
    const { rejectedReason } = req.body;
    if (!approvedBy) {
      return res.status(400).json({ message: 'Không xác định được người xử lý; vui lòng đăng nhập lại' });
    }
    if (!rejectedReason) {
      return res.status(400).json({ message: 'rejectedReason là bắt buộc' });
    }

    await client.query('BEGIN');

    const query = `
      UPDATE ${RENTAL_REQUEST_TABLE}
      SET status = 'REJECTED', approved_by = $2, rejected_reason = $3, updated_at = CURRENT_TIMESTAMP
      WHERE request_id = $1 AND status = 'PENDING'
      RETURNING *;
    `;

    const { rows } = await client.query(query, [id, approvedBy, rejectedReason]);
    const rejectedRequest = rows[0];
    if (!rejectedRequest) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Request không tồn tại hoặc đã được xử lý' });
    }

    const userIds = await findNotifiedUserIds(client, rejectedRequest);
    if (userIds.length > 0) {
      await createNotifications(client, userIds, {
        type: 'REQUEST_STATUS',
        title: 'Don thue kho da bi tu choi',
        content: `Yeu cau ${rejectedRequest.request_id} bi tu choi. Ly do: ${rejectedReason}`,
      });
    }

    await client.query('COMMIT');
    return res.json(mapRentalRequestRow(rejectedRequest));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error rejecting rental request:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  } finally {
    client.release();
  }
}
