import pool from '../config/db.js';
import { tableName as CONTRACT_TABLE } from '../models/Contract.js';

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
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// POST /contracts - Tạo contract mới
export async function createContract(req, res) {
  try {
    const {
      contractId,
      requestId = null,
      tenantId,
      approvedBy = null,
      contractCode,
      startDate,
      endDate,
      billingCycle = null,
      rentalDurationDays = null,
      totalRentalFee,
      status = 'ACTIVE',
    } = req.body;

    if (!contractId || !tenantId || !contractCode || !startDate || !endDate || totalRentalFee === undefined) {
      return res.status(400).json({
        message: 'contractId, tenantId, contractCode, startDate, endDate, totalRentalFee là bắt buộc',
      });
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
      tenantId,
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

    let whereClause = 'WHERE 1=1';
    const filterValues = [];
    let filterParamIndex = 1;

    if (tenantId) {
      whereClause += ` AND c.tenant_id = $${filterParamIndex}`;
      filterValues.push(tenantId);
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

