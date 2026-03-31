import pool from '../config/db.js';
import { tableName as RENTAL_REQUEST_TABLE } from '../models/RentalRequest.js';
import { tableName as RENTAL_REQUEST_ZONE_TABLE } from '../models/RentalRequestZone.js';
import { tableName as ZONE_TABLE } from '../models/Zone.js';

// Map DB row -> domain object
function mapRentalRequestRow(row) {
  if (!row) return null;
  return {
    requestId: row.request_id,
    tenantId: row.tenant_id,
    status: row.status,
    requestedStartDate: row.requested_start_date,
    durationDays: row.duration_days,
    notes: row.notes,
    approvedBy: row.approved_by,
    rejectedReason: row.rejected_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// POST /rental-requests - Tạo rental request mới
export async function createRentalRequest(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      requestId,
      tenantId,
      warehouseId,
      requestedStartDate,
      durationDays,
      notes,
      selectedZones, // array of zoneIds
    } = req.body;

    if (!requestId || !tenantId || !warehouseId || !requestedStartDate || !durationDays) {
      return res.status(400).json({
        message: 'requestId, tenantId, warehouseId, requestedStartDate, durationDays là bắt buộc'
      });
    }

    if (durationDays < 15) {
      return res.status(400).json({ message: 'Thời gian thuê tối thiểu là 15 ngày' });
    }

    // Tạo rental request
    const requestQuery = `
      INSERT INTO ${RENTAL_REQUEST_TABLE} (
        request_id,
        tenant_id,
        warehouse_id,
        requested_start_date,
        duration_days,
        notes,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
      RETURNING *;
    `;

    const requestValues = [requestId, tenantId, warehouseId, requestedStartDate, durationDays, notes];
    const { rows: requestRows } = await client.query(requestQuery, requestValues);

    // Thêm zones đã chọn (nếu có)
    if (selectedZones && selectedZones.length > 0) {
      const zoneValues = selectedZones.map(zoneId => `('${requestId}', '${zoneId}')`).join(', ');
      const zoneQuery = `
        INSERT INTO ${RENTAL_REQUEST_ZONE_TABLE} (rental_request_id, zone_id)
        VALUES ${zoneValues};
      `;
      await client.query(zoneQuery);
    }

    await client.query('COMMIT');

    const result = mapRentalRequestRow(requestRows[0]);
    result.selectedZones = selectedZones || [];

    return res.status(201).json(result);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating rental request:', error);
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
    const checkQuery = `SELECT status FROM ${RENTAL_REQUEST_TABLE} WHERE request_id = $1;`;
    const { rows: checkRows } = await pool.query(checkQuery, [id]);
    if (checkRows.length === 0) {
      return res.status(404).json({ message: 'Rental request không tồn tại' });
    }
    if (checkRows[0].status !== 'PENDING') {
      return res.status(400).json({ message: 'Không thể cập nhật request đã được xử lý' });
    }

    // Build dynamic update query
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && key !== 'selectedZones') {
        const dbField = key.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
        fields.push(`${dbField} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    });

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
  try {
    const { id } = req.params;
    const { approvedBy } = req.body;

    if (!approvedBy) {
      return res.status(400).json({ message: 'approvedBy là bắt buộc' });
    }

    const query = `
      UPDATE ${RENTAL_REQUEST_TABLE}
      SET status = 'APPROVED', approved_by = $2, updated_at = CURRENT_TIMESTAMP
      WHERE request_id = $1 AND status = 'PENDING'
      RETURNING *;
    `;

    const { rows } = await pool.query(query, [id, approvedBy]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Request không tồn tại hoặc đã được xử lý' });
    }

    return res.json(mapRentalRequestRow(rows[0]));
  } catch (error) {
    console.error('Error approving rental request:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// POST /rental-requests/:id/reject - Reject rental request
export async function rejectRentalRequest(req, res) {
  try {
    const { id } = req.params;
    const { approvedBy, rejectedReason } = req.body;

    const query = `
      UPDATE ${RENTAL_REQUEST_TABLE}
      SET status = 'REJECTED', approved_by = $2, rejected_reason = $3, updated_at = CURRENT_TIMESTAMP
      WHERE request_id = $1 AND status = 'PENDING'
      RETURNING *;
    `;

    const { rows } = await pool.query(query, [id, approvedBy, rejectedReason]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Request không tồn tại hoặc đã được xử lý' });
    }

    return res.json(mapRentalRequestRow(rows[0]));
  } catch (error) {
    console.error('Error rejecting rental request:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /rental-requests/available-zones/:warehouseId - Lấy zones available
export async function getAvailableZones(req, res) {
  try {
    const { warehouseId } = req.params;

    const query = `
      SELECT z.*, w.warehouse_name
      FROM ${ZONE_TABLE} z
      JOIN warehouses w ON z.warehouse_id = w.warehouse_id
      WHERE z.warehouse_id = $1 AND z.is_rented = false
      ORDER BY z.zone_code;
    `;

    const { rows } = await pool.query(query, [warehouseId]);
    return res.json({ zones: rows });
  } catch (error) {
    console.error('Error getting available zones:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}