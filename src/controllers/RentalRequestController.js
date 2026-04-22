/**
 * @fileoverview
 * RentalRequestController — quản lý yêu cầu thuê kho từ tenant.
 *
 * Endpoints:
 *   - POST   /api/rental-requests             Tenant admin tạo yêu cầu thuê.
 *   - GET    /api/rental-requests             List (filter theo tenant, status).
 *   - GET    /api/rental-requests/:id         Chi tiết.
 *   - PATCH  /api/rental-requests/:id         Cập nhật (chỉ khi PENDING).
 *   - POST   /api/rental-requests/:id/approve Admin/staff duyệt → tự tạo contract DRAFT.
 *   - POST   /api/rental-requests/:id/reject  Admin/staff từ chối (bắt buộc reason).
 *
 * API contract quan trọng (xem ADR-005):
 *   - FE gửi `userId` trong body thay vì `tenantId`.
 *   - Backend resolve tenantId qua helper `resolveTenantFromUser()`.
 *   - Nếu user chưa có tenant → 400 (tenant_admin phải verify OTP xong
 *     để hệ thống tạo implicit tenant trước khi gửi rental request).
 *
 * State machine:
 *
 *   PENDING ───approve──► APPROVED ──► (contract DRAFT được tạo song song)
 *      │
 *      └────reject───► REJECTED
 *
 * PATCH chỉ được phép khi status = PENDING.
 */

import pool from '../config/db.js';
import { randomUUID } from 'crypto';
import { tableName as RENTAL_REQUEST_TABLE } from '../models/RentalRequest.js';
import { tableName as NOTIFICATION_TABLE } from '../models/Notification.js';
import { tableName as USER_TABLE } from '../models/User.js';
import { tableName as TENANT_TABLE } from '../models/Tenant.js';
import { generatePrefixedId } from '../utils/idGenerator.js';

/**
 * Chuẩn hoá giá trị ID nhận từ request: trim whitespace, convert non-string,
 * trả null nếu rỗng để downstream code dễ xử lý ` || null`.
 *
 * @param {*} value
 * @returns {string|null}
 */
function trimId(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return String(value).trim() || null;
  const t = value.trim();
  return t === '' ? null : t;
}

/**
 * Resolve tenantId từ userId (ưu tiên body, fallback JWT).
 *
 * FE gửi `userId` trong request body (theo API contract v0.5). Nếu body
 * không có thì dùng user đang đăng nhập (`req.user.userId`) — hữu ích
 * khi tenant admin tự tạo rental request cho chính mình.
 *
 * Trường hợp lỗi trả về `{ error: <message> }`:
 *   - Không có userId cả ở body lẫn JWT.
 *   - userId không tồn tại trong bảng users.
 *   - User tồn tại nhưng tenant_id NULL (chưa verify OTP, hoặc staff nội bộ
 *     không có tenant).
 *
 * Trường hợp OK: `{ userId, tenantId }`.
 *
 * @param {string|undefined} bodyUserId
 * @param {{ userId?: string }} reqUser payload JWT đã parse.
 * @returns {Promise<{ userId?: string, tenantId?: string, error?: string }>}
 */
async function resolveTenantFromUser(bodyUserId, reqUser) {
  const candidateUserId = trimId(bodyUserId) || reqUser?.userId || null;
  if (!candidateUserId) {
    return { error: 'Thiếu userId. Gửi userId trong body hoặc đăng nhập.' };
  }

  const { rows } = await pool.query(
    `SELECT user_id, tenant_id FROM ${USER_TABLE} WHERE user_id = $1 LIMIT 1`,
    [candidateUserId],
  );
  if (rows.length === 0) {
    return { error: `userId "${candidateUserId}" không tồn tại` };
  }
  const tenantId = rows[0].tenant_id ? String(rows[0].tenant_id).trim() : null;
  if (!tenantId) {
    return { error: `User "${candidateUserId}" chưa được gắn với tenant nào` };
  }
  return { userId: candidateUserId, tenantId };
}

/**
 * Map 1 row `rental_requests` từ Postgres (snake_case) sang domain object
 * camelCase cho API response.
 *
 * Các field nghiệp vụ trọng tâm:
 *   - rentalTermUnit / rentalTermValue: FE nhập "thuê 3 tháng" → giữ cả
 *     unit và value, không ép về days, để UI hiển thị đúng ngôn ngữ.
 *   - durationDays: giá trị đã normalize sang ngày, dùng cho report/filter.
 *   - goodsWeightKg: expected weight của lô hàng sẽ nhập vào kho.
 *   - approvedBy / rejectedReason: audit trail ai duyệt / lý do từ chối.
 *
 * @param {object} row
 * @returns {object|null}
 */
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

/**
 * Quy đổi thời hạn thuê (unit + value) sang số ngày để lưu vào DB cho
 * mục đích so sánh / filter.
 *
 * Quy ước (đơn giản cho MVP, không phụ thuộc calendar thật):
 *   - MONTH   → 30 ngày
 *   - QUARTER → 90 ngày
 *   - YEAR    → 365 ngày
 *
 * Lý do không dùng date-fns/dayjs: giá trị này chỉ dùng cho report
 * gần đúng, không phải tính tiền. Tiền tính theo start_date/end_date
 * thực tế ở contract.
 *
 * @param {string} rentalTermUnit
 * @param {number|string} rentalTermValue
 * @returns {number} Số ngày tương ứng.
 */
function calculateDurationDays(rentalTermUnit, rentalTermValue) {
  const normalizedUnit = String(rentalTermUnit || '').toUpperCase();
  const unitToDays = {
    MONTH: 30,
    QUARTER: 90,
    YEAR: 365,
  };
  return unitToDays[normalizedUnit] * Number(rentalTermValue);
}

/**
 * Validate payload cho CREATE / UPDATE rental request.
 *
 * CREATE: các field trong `required` đều bắt buộc.
 * UPDATE: chỉ validate các field có mặt (partial update), nhưng nếu
 * gửi field thì giá trị phải hợp lệ.
 *
 * Trả về mảng lỗi `[{ field, reason }]`. Nếu rỗng thì payload OK.
 *
 * @param {object} payload
 * @param {{ isUpdate?: boolean }} options
 * @returns {Array<{ field: string, reason: string }>}
 */
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
  if (payload.userId !== undefined && !String(payload.userId).trim()) {
    return 'userId không hợp lệ';
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

/**
 * Tìm danh sách user cần nhận thông báo khi rental request thay đổi state.
 *
 * Bao gồm:
 *   - Tenant admin của tenant sở hữu request (được thông báo khi approve/reject).
 *   - Admin nội bộ / warehouse_staff của kho đang được thuê (được thông báo
 *     khi có request mới PENDING).
 *
 * @param {import('pg').PoolClient} client Transaction client.
 * @param {object} rentalRequestRow Row rental_requests.
 * @returns {Promise<string[]>} Mảng user_id.
 */
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

/**
 * Bulk insert notifications cho nhiều user cùng lúc.
 *
 * Dùng 1 INSERT với nhiều value tuple thay vì loop (giảm round-trip DB).
 * Mỗi notification được tạo trong cùng transaction với action nghiệp vụ
 * gốc — nếu action fail thì notification cũng rollback, tránh gửi
 * thông báo về event chưa xảy ra.
 *
 * @param {import('pg').PoolClient} client
 * @param {string[]} userIds
 * @param {{ type: string, title: string, content: string }} payload
 */
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
/**
 * POST /api/rental-requests — Tenant tạo yêu cầu thuê kho mới.
 *
 * Flow (transaction):
 *   1. Resolve tenantId từ userId (body) hoặc JWT.
 *   2. Validate payload (customerType, warehouseId, rentalType, term, goods).
 *   3. Sinh request_id theo pattern RR####.
 *   4. Tính durationDays.
 *   5. INSERT rental_requests với status = PENDING.
 *   6. Tìm user cần notify (tenant admin + warehouse staff) và insert notifications.
 *   7. COMMIT, trả 201.
 *
 * Các check business:
 *   - warehouseId phải tồn tại (FK constraint).
 *   - rentalType phải là RACK hoặc LEVEL.
 *   - rentalTermValue > 0.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function createRentalRequest(req, res) {
  const {
    customerType,
    userId,
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
    userId: trimId(userId),
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

  const resolved = await resolveTenantFromUser(userId, req.user);
  if (resolved.error) {
    return res.status(400).json({ message: resolved.error });
  }
  const effectiveTenantId = resolved.tenantId;

  const { rows: tenantRows } = await pool.query(
    `SELECT 1 FROM ${TENANT_TABLE} WHERE tenant_id = $1 LIMIT 1`,
    [effectiveTenantId],
  );
  if (tenantRows.length === 0) {
    return res.status(400).json({ message: 'Tenant liên kết với user không tồn tại trong hệ thống' });
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
      return res.status(400).json({ message: 'Dữ liệu không hợp lệ: thiếu giá trị bắt buộc' });
    }
    if (error.code === '23503') {
      return res.status(400).json({ message: 'Không thể tạo rental request: warehouseId hoặc tenant (suy ra từ user) không tồn tại' });
    }
    return res.status(500).json({ message: 'Lỗi server' });
  } finally {
    client.release();
  }
}

// GET /rental-requests - Danh sách rental requests
/**
 * GET /api/rental-requests — List rental request có phân trang + filter.
 *
 * Query params:
 *   - userId: filter theo user (resolve ra tenantId rồi filter).
 *   - status: PENDING | APPROVED | REJECTED.
 *   - warehouseId: filter theo kho.
 *   - limit, offset.
 *
 * Tenant isolation: nếu req.user.role = tenant_admin thì tự động thêm
 * `WHERE tenant_id = <JWT tenantId>`. Admin / staff không bị filter.
 *
 * Sort theo created_at DESC để request mới nhất lên đầu.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function listRentalRequests(req, res) {
  try {
    const { page = 1, limit = 10, status, userId } = req.query;
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const offset = (pageNum - 1) * limitNum;

    const filterValues = [];
    const filterParts = [];
    if (status) {
      filterParts.push(`rr.status = $${filterValues.length + 1}`);
      filterValues.push(status);
    }
    const trimmedUserId = trimId(userId);
    if (trimmedUserId) {
      const { rows: userRows } = await pool.query(
        `SELECT tenant_id FROM ${USER_TABLE} WHERE user_id = $1 LIMIT 1`,
        [trimmedUserId],
      );
      const filterTenantId = userRows[0]?.tenant_id ? String(userRows[0].tenant_id).trim() : null;
      if (!filterTenantId) {
        return res.json({
          requests: [],
          pagination: { page: pageNum, limit: limitNum, total: 0, totalPages: 0 },
        });
      }
      filterParts.push(`rr.tenant_id = $${filterValues.length + 1}`);
      filterValues.push(filterTenantId);
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
/**
 * GET /api/rental-requests/:id — Chi tiết 1 rental request.
 *
 * Response 200: domain object đã map.
 * Response 404: không tồn tại.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
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
/**
 * PATCH /api/rental-requests/:id — Cập nhật rental request.
 *
 * Ràng buộc quan trọng: **chỉ update được khi status = PENDING**. Sau khi
 * đã approved/rejected, yêu cầu coi như khép, phải tạo request mới nếu
 * muốn thay đổi (tránh lẫn lộn audit trail).
 *
 * Payload: tất cả field đều optional; partial update.
 *
 * Nếu đổi rentalTermUnit/rentalTermValue → recalc durationDays.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
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

    // Nếu client gửi userId để đổi tenant, resolve và cập nhật tenant_id
    if (updates.userId !== undefined) {
      const resolved = await resolveTenantFromUser(updates.userId, null);
      if (resolved.error) {
        return res.status(400).json({ message: resolved.error });
      }
      fields.push(`tenant_id = $${paramIndex}`);
      values.push(resolved.tenantId);
      paramIndex++;
    }

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
/**
 * POST /api/rental-requests/:id/approve — Admin/warehouse_staff duyệt request.
 *
 * Flow (transaction):
 *   1. SELECT rental_request FOR UPDATE (khoá row).
 *   2. Kiểm tra status = PENDING (nếu không → 409 "state không hợp lệ").
 *   3. UPDATE status = APPROVED, approved_by = req.user.userId, approved_at = NOW().
 *   4. (Roadmap) Tạo contract DRAFT tương ứng và link qua request_id.
 *   5. Gửi notification cho tenant owner.
 *   6. COMMIT.
 *
 * Response 200: request đã approve (kèm contract nếu đã tạo).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
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
/**
 * POST /api/rental-requests/:id/reject — Admin/warehouse_staff từ chối request.
 *
 * Flow (transaction):
 *   1. Validate body: `reason` bắt buộc (tenant có quyền biết lý do).
 *   2. SELECT FOR UPDATE + kiểm tra PENDING.
 *   3. UPDATE status = REJECTED, rejected_reason = reason, rejected_at = NOW().
 *   4. Gửi notification cho tenant owner kèm reason.
 *   5. COMMIT.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
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
