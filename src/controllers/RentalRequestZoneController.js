import pool from '../config/db.js';
import { tableName as RENTAL_REQUEST_ZONE_TABLE } from '../models/RentalRequestZone.js';
import { tableName as RENTAL_REQUEST_TABLE } from '../models/RentalRequest.js';
import { tableName as ZONE_TABLE } from '../models/Zone.js';

function mapRentalRequestZoneRow(row) {
  if (!row) return null;
  return {
    rentalRequestId: row.rental_request_id,
    zoneId: row.zone_id,
    zoneCode: row.zone_code ?? undefined,
    zoneName: row.zone_name ?? undefined,
    warehouseId: row.warehouse_id ?? undefined,
    ...(row.created_at != null ? { createdAt: row.created_at } : {}),
  };
}

async function assertRequestPending(rentalRequestId) {
  const { rows } = await pool.query(
    `SELECT request_id, status, warehouse_id FROM ${RENTAL_REQUEST_TABLE} WHERE request_id = $1 LIMIT 1`,
    [rentalRequestId],
  );
  const rr = rows[0];
  if (!rr) {
    return { error: { status: 404, message: 'Rental request không tồn tại' } };
  }
  if (rr.status !== 'PENDING') {
    return { error: { status: 400, message: 'Chỉ chỉnh zone khi request đang PENDING' } };
  }
  return { rentalRequest: rr };
}

async function assertZoneInWarehouse(zoneId, warehouseId) {
  const { rows } = await pool.query(
    `SELECT zone_id, warehouse_id FROM ${ZONE_TABLE} WHERE zone_id = $1 LIMIT 1`,
    [zoneId],
  );
  const z = rows[0];
  if (!z) {
    return { error: { status: 404, message: 'Zone không tồn tại' } };
  }
  if (z.warehouse_id !== warehouseId) {
    return { error: { status: 400, message: 'Zone không thuộc warehouse của rental request' } };
  }
  return { zone: z };
}

// GET /rental-request-zones?rentalRequestId=
export async function listRentalRequestZones(req, res) {
  try {
    const { rentalRequestId, page = 1, limit = 50 } = req.query;
    if (!rentalRequestId) {
      return res.status(400).json({ message: 'rentalRequestId là bắt buộc (query)' });
    }
    const offset = (page - 1) * limit;

    const query = `
      SELECT rrz.rental_request_id, rrz.zone_id, z.zone_code, z.zone_name, z.warehouse_id
      FROM ${RENTAL_REQUEST_ZONE_TABLE} rrz
      JOIN ${ZONE_TABLE} z ON z.zone_id = rrz.zone_id
      WHERE rrz.rental_request_id = $1
      ORDER BY z.zone_code
      LIMIT $2 OFFSET $3;
    `;
    const { rows } = await pool.query(query, [rentalRequestId, limit, offset]);

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM ${RENTAL_REQUEST_ZONE_TABLE}
      WHERE rental_request_id = $1;
    `;
    const { rows: countRows } = await pool.query(countQuery, [rentalRequestId]);

    return res.json({
      zones: rows.map(mapRentalRequestZoneRow),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: countRows[0]?.total ?? 0,
        totalPages: Math.ceil((countRows[0]?.total ?? 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error listing rental request zones:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /rental-request-zones/:rentalRequestId/:zoneId
export async function getRentalRequestZone(req, res) {
  try {
    const { rentalRequestId, zoneId } = req.params;
    const query = `
      SELECT rrz.rental_request_id, rrz.zone_id, z.zone_code, z.zone_name, z.warehouse_id
      FROM ${RENTAL_REQUEST_ZONE_TABLE} rrz
      JOIN ${ZONE_TABLE} z ON z.zone_id = rrz.zone_id
      WHERE rrz.rental_request_id = $1 AND rrz.zone_id = $2
      LIMIT 1;
    `;
    const { rows } = await pool.query(query, [rentalRequestId, zoneId]);
    const row = mapRentalRequestZoneRow(rows[0]);
    if (!row) {
      return res.status(404).json({ message: 'Không tìm thấy liên kết request–zone' });
    }
    return res.json(row);
  } catch (error) {
    console.error('Error getting rental request zone:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// POST /rental-request-zones
export async function createRentalRequestZone(req, res) {
  try {
    const { rentalRequestId, zoneId } = req.body;
    if (!rentalRequestId || !zoneId) {
      return res.status(400).json({ message: 'rentalRequestId và zoneId là bắt buộc' });
    }

    const pending = await assertRequestPending(rentalRequestId);
    if (pending.error) {
      return res.status(pending.error.status).json({ message: pending.error.message });
    }

    const zoneCheck = await assertZoneInWarehouse(zoneId, pending.rentalRequest.warehouse_id);
    if (zoneCheck.error) {
      return res.status(zoneCheck.error.status).json({ message: zoneCheck.error.message });
    }

    const conflict = await pool.query(
      `SELECT 1 FROM ${RENTAL_REQUEST_ZONE_TABLE} WHERE rental_request_id = $1 AND zone_id = $2 LIMIT 1`,
      [rentalRequestId, zoneId],
    );
    if (conflict.rows.length > 0) {
      return res.status(409).json({ message: 'Zone đã được gắn vào request này' });
    }

    const insert = `
      INSERT INTO ${RENTAL_REQUEST_ZONE_TABLE} (rental_request_id, zone_id)
      VALUES ($1, $2)
      RETURNING rental_request_id, zone_id;
    `;
    await pool.query(insert, [rentalRequestId, zoneId]);

    const detail = await pool.query(
      `
      SELECT rrz.rental_request_id, rrz.zone_id, z.zone_code, z.zone_name, z.warehouse_id
      FROM ${RENTAL_REQUEST_ZONE_TABLE} rrz
      JOIN ${ZONE_TABLE} z ON z.zone_id = rrz.zone_id
      WHERE rrz.rental_request_id = $1 AND rrz.zone_id = $2
      LIMIT 1
      `,
      [rentalRequestId, zoneId],
    );
    return res.status(201).json(mapRentalRequestZoneRow(detail.rows[0]));
  } catch (error) {
    console.error('Error creating rental request zone:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// PATCH /rental-request-zones/:rentalRequestId/:zoneId — đổi sang zone khác (cùng request)
export async function updateRentalRequestZone(req, res) {
  try {
    const { rentalRequestId, zoneId } = req.params;
    const { zoneId: newZoneId } = req.body;

    if (!newZoneId || typeof newZoneId !== 'string') {
      return res.status(400).json({ message: 'zoneId (mới) là bắt buộc trong body' });
    }
    if (newZoneId === zoneId) {
      return res.status(400).json({ message: 'zoneId mới phải khác zoneId hiện tại' });
    }

    const pending = await assertRequestPending(rentalRequestId);
    if (pending.error) {
      return res.status(pending.error.status).json({ message: pending.error.message });
    }

    const exists = await pool.query(
      `SELECT 1 FROM ${RENTAL_REQUEST_ZONE_TABLE} WHERE rental_request_id = $1 AND zone_id = $2 LIMIT 1`,
      [rentalRequestId, zoneId],
    );
    if (exists.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy liên kết request–zone' });
    }

    const zoneCheck = await assertZoneInWarehouse(newZoneId, pending.rentalRequest.warehouse_id);
    if (zoneCheck.error) {
      return res.status(zoneCheck.error.status).json({ message: zoneCheck.error.message });
    }

    const dup = await pool.query(
      `SELECT 1 FROM ${RENTAL_REQUEST_ZONE_TABLE} WHERE rental_request_id = $1 AND zone_id = $2 LIMIT 1`,
      [rentalRequestId, newZoneId],
    );
    if (dup.rows.length > 0) {
      return res.status(409).json({ message: 'Request đã có zone mới này rồi' });
    }

    await pool.query(
      `
      UPDATE ${RENTAL_REQUEST_ZONE_TABLE}
      SET zone_id = $3
      WHERE rental_request_id = $1 AND zone_id = $2
      `,
      [rentalRequestId, zoneId, newZoneId],
    );

    const detail = await pool.query(
      `
      SELECT rrz.rental_request_id, rrz.zone_id, z.zone_code, z.zone_name, z.warehouse_id
      FROM ${RENTAL_REQUEST_ZONE_TABLE} rrz
      JOIN ${ZONE_TABLE} z ON z.zone_id = rrz.zone_id
      WHERE rrz.rental_request_id = $1 AND rrz.zone_id = $2
      LIMIT 1
      `,
      [rentalRequestId, newZoneId],
    );
    return res.json(mapRentalRequestZoneRow(detail.rows[0]));
  } catch (error) {
    console.error('Error updating rental request zone:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// DELETE /rental-request-zones/:rentalRequestId/:zoneId
export async function deleteRentalRequestZone(req, res) {
  try {
    const { rentalRequestId, zoneId } = req.params;

    const pending = await assertRequestPending(rentalRequestId);
    if (pending.error) {
      return res.status(pending.error.status).json({ message: pending.error.message });
    }

    const { rows } = await pool.query(
      `
      DELETE FROM ${RENTAL_REQUEST_ZONE_TABLE}
      WHERE rental_request_id = $1 AND zone_id = $2
      RETURNING rental_request_id, zone_id;
      `,
      [rentalRequestId, zoneId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy liên kết request–zone' });
    }
    return res.json({ message: 'Đã xóa liên kết zone khỏi request', rentalRequestId, zoneId });
  } catch (error) {
    console.error('Error deleting rental request zone:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}
