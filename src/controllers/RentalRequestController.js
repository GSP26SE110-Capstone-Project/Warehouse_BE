import pool from '../config/db.js';
import { randomUUID } from 'crypto';
import { tableName as RENTAL_REQUEST_TABLE } from '../models/RentalRequest.js';
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
    warehouseId: row.warehouse_id,
    rentalType: row.rental_type,
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
    'warehouseId',
    'rentalType',
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
  if (payload.tenantId !== undefined && (!String(payload.tenantId).trim())) {
    return 'tenantId không hợp lệ';
  }

  const rentalType = String(payload.rentalType || '').toUpperCase();
  if (rentalType && !['RACK', 'LEVEL'].includes(rentalType)) {
    return 'rentalType chỉ chấp nhận RACK hoặc LEVEL';
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

  if (payload.goodsWeightKg !== undefined && (Number(payload.goodsWeightKg) < 0 || Number.isNaN(Number(payload.goodsWeightKg)))) {
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
    warehouseId,
    rentalType,
    requestedStartDate,
    rentalTermUnit,
    rentalTermValue,
    goodsType,
    goodsDescription,
    goodsQuantity,
    goodsWeightKg,
    notes,
  } = req.body;

  const validationError = validateRentalRequestPayload({
    customerType,
    tenantId: trimTenantId(tenantId),
    warehouseId,
    rentalType,
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
  const normalizedRentalType = String(rentalType).toUpperCase();
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
        'Thiếu tenantId. Hãy gửi tenantId trong body hoặc đăng nhập bằng user đã gắn tenant.',
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
        warehouse_id,
        rental_type,
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'PENDING')
      RETURNING *;
    `;

    const requestValues = [
      requestId,
      normalizedCustomerType,
      effectiveTenantId,
      warehouseId,
      normalizedRentalType,
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

    await client.query('COMMIT');
    return res.status(201).json(mapRentalRequestRow(requestRows[0]));
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
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const offset = (pageNum - 1) * limitNum;

    const filterValues = [];
    const filterParts = [];
    if (status) {
      filterParts.push(`rr.status = $${filterValues.length + 1}`);
      filterValues.push(status);
    }
    if (tenantId) {
      filterParts.push(`rr.tenant_id = $${filterValues.length + 1}`);
      filterValues.push(tenantId);
    }
    const whereClause = filterParts.length ? ` AND ${filterParts.join(' AND ')}` : '';

    const limPlaceholder = filterValues.length + 1;
    const offPlaceholder = filterValues.length + 2;
    const listValues = [...filterValues, limitNum, offset];

    const query = `
      SELECT rr.*, t.company_name as tenant_name
      FROM ${RENTAL_REQUEST_TABLE} rr
      LEFT JOIN tenants t ON rr.tenant_id = t.tenant_id
      WHERE 1=1 ${whereClause}
      ORDER BY rr.created_at DESC
      LIMIT $${limPlaceholder} OFFSET $${offPlaceholder};
    `;

    const { rows } = await pool.query(query, listValues);
    const requests = rows.map(mapRentalRequestRow);

    // Đếm tổng số (cùng điều kiện lọc; placeholder $1..$n khớp filterValues)
    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${RENTAL_REQUEST_TABLE} rr
      WHERE 1=1 ${whereClause};
    `;
    const { rows: countRows } = await pool.query(countQuery, filterValues);

    const total = parseInt(countRows[0].total, 10);
    return res.json({
      requests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 0,
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
      'warehouseId',
      'rentalType',
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
      if (key === 'rentalType') nextValue = String(updates[key]).toUpperCase();
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

    const userIds = await findNotifiedUserIds(client, approvedRequest);
    if (userIds.length > 0) {
      await createNotifications(client, userIds, {
        type: 'REQUEST_STATUS',
        title: 'Don thue kho da duoc chap nhan',
        content: `Yeu cau ${approvedRequest.request_id} da duoc duyet. Admin se tao hop dong thu cong sau khi chon khong gian thue.`,
      });
    }

    await client.query('COMMIT');
    return res.json(mapRentalRequestRow(approvedRequest));
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
