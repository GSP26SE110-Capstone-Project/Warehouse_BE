import crypto from 'crypto';
import pool from '../config/db.js';
import { tableName as RECORD_TABLE } from '../models/ImportExportRecord.js';
import { tableName as CONTRACT_TABLE } from '../models/Contract.js';

function mapDetailRow(row) {
  if (!row) return null;
  return {
    recordId: row.record_id,
    contractId: row.contract_id,
    tenantId: row.tenant_id,
    warehouseId: row.warehouse_id,
    scopeType: row.scope_type,
    zoneId: row.zone_id,
    slotId: row.slot_id,
    recordType: row.record_type,
    recordCode: row.record_code,
    scheduledDatetime: row.scheduled_datetime,
    actualDatetime: row.actual_datetime,
    quantity: row.quantity,
    weight: row.weight,
    isFullZone: row.is_full_zone,
    status: row.status,
    responsibleStaffId: row.responsible_staff_id,
    createdAt: row.created_at,
  };
}

/**
 * POST /import-export-reports
 * Tạo báo cáo xuất nhập (tổng hợp theo kỳ), trả JSON — không lưu bản ghi báo cáo vào DB.
 */
export async function createImportExportReport(req, res) {
  try {
    const {
      from,
      to,
      basis = 'scheduled',
      warehouseId,
      contractId,
      tenantId,
      recordType,
      status,
      includeDetails = true,
      detailsLimit = 200,
    } = req.body;

    if (!from || !to) {
      return res.status(400).json({ message: 'from và to là bắt buộc (ISO datetime hoặc date)' });
    }

    const basisNorm = String(basis).toLowerCase();
    if (!['scheduled', 'actual'].includes(basisNorm)) {
      return res.status(400).json({ message: 'basis phải là scheduled hoặc actual' });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ message: 'from hoặc to không phải ngày hợp lệ' });
    }
    if (fromDate > toDate) {
      return res.status(400).json({ message: 'from phải nhỏ hơn hoặc bằng to' });
    }

    const values = [fromDate.toISOString(), toDate.toISOString()];
    let idx = 3;

    let dateClause;
    if (basisNorm === 'actual') {
      dateClause = `r.actual_datetime IS NOT NULL AND r.actual_datetime >= $1 AND r.actual_datetime <= $2`;
    } else {
      dateClause = `r.scheduled_datetime >= $1 AND r.scheduled_datetime <= $2`;
    }

    let whereClause = `WHERE ${dateClause}`;

    if (warehouseId) {
      whereClause += ` AND r.warehouse_id = $${idx}`;
      values.push(warehouseId);
      idx++;
    }
    if (contractId) {
      whereClause += ` AND r.contract_id = $${idx}`;
      values.push(contractId);
      idx++;
    }
    if (tenantId) {
      whereClause += ` AND c.tenant_id = $${idx}`;
      values.push(tenantId);
      idx++;
    }
    if (recordType) {
      whereClause += ` AND r.record_type = $${idx}`;
      values.push(recordType);
      idx++;
    }
    if (status) {
      whereClause += ` AND r.status = $${idx}`;
      values.push(status);
      idx++;
    }

    const baseFrom = `
      FROM ${RECORD_TABLE} r
      INNER JOIN ${CONTRACT_TABLE} c ON c.contract_id = r.contract_id
      ${whereClause}
    `;

    const summaryTypeQuery = `
      SELECT r.record_type,
             COUNT(*)::int AS count,
             COALESCE(SUM(r.quantity), 0)::numeric AS total_quantity,
             COALESCE(SUM(r.weight), 0)::numeric AS total_weight
      ${baseFrom}
      GROUP BY r.record_type
      ORDER BY r.record_type;
    `;
    const { rows: byTypeRows } = await pool.query(summaryTypeQuery, values);

    const summaryStatusQuery = `
      SELECT r.status, COUNT(*)::int AS count
      ${baseFrom}
      GROUP BY r.status
      ORDER BY r.status;
    `;
    const { rows: byStatusRows } = await pool.query(summaryStatusQuery, values);

    const summaryWarehouseQuery = `
      SELECT r.warehouse_id,
             COUNT(*)::int AS count,
             SUM(CASE WHEN r.record_type = 'IMPORT' THEN 1 ELSE 0 END)::int AS import_count,
             SUM(CASE WHEN r.record_type = 'EXPORT' THEN 1 ELSE 0 END)::int AS export_count
      ${baseFrom}
      GROUP BY r.warehouse_id
      ORDER BY r.warehouse_id;
    `;
    const { rows: byWarehouseRows } = await pool.query(summaryWarehouseQuery, values);

    const countQuery = `SELECT COUNT(*)::int AS total ${baseFrom};`;
    const { rows: countRows } = await pool.query(countQuery, values);
    const totalRecords = countRows[0]?.total ?? 0;

    const reportId = crypto.randomUUID();
    const generatedAt = new Date().toISOString();

    let details = [];
    if (includeDetails) {
      const cap = Math.min(Math.max(parseInt(detailsLimit, 10) || 200, 1), 2000);
      const detailValues = [...values, cap];
      const limitParam = idx;
      const detailQuery = `
        SELECT r.*, c.tenant_id
        ${baseFrom}
        ORDER BY r.scheduled_datetime DESC, r.record_id
        LIMIT $${limitParam};
      `;
      const { rows: detailRows } = await pool.query(detailQuery, detailValues);
      details = detailRows.map(mapDetailRow);
    }

    const byRecordType = { IMPORT: { count: 0, totalQuantity: 0, totalWeight: 0 }, EXPORT: { count: 0, totalQuantity: 0, totalWeight: 0 } };
    for (const row of byTypeRows) {
      const key = row.record_type;
      if (byRecordType[key]) {
        byRecordType[key] = {
          count: row.count,
          totalQuantity: row.total_quantity != null ? Number(row.total_quantity) : 0,
          totalWeight: row.total_weight != null ? Number(row.total_weight) : 0,
        };
      }
    }

    const byStatus = {};
    for (const row of byStatusRows) {
      byStatus[row.status] = row.count;
    }

    const byWarehouse = byWarehouseRows.map((w) => ({
      warehouseId: w.warehouse_id,
      count: w.count,
      importCount: w.import_count,
      exportCount: w.export_count,
    }));

    return res.status(201).json({
      reportId,
      generatedAt,
      period: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        basis: basisNorm,
      },
      filters: {
        warehouseId: warehouseId || null,
        contractId: contractId || null,
        tenantId: tenantId || null,
        recordType: recordType || null,
        status: status || null,
      },
      summary: {
        totalRecords,
        byRecordType,
        byStatus,
        byWarehouse,
      },
      details,
      detailsTruncated: includeDetails && totalRecords > details.length,
    });
  } catch (error) {
    console.error('Error creating import-export report:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}
