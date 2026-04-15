import pool from '../config/db.js';
import { tableName as STATION_TABLE } from '../models/TransportStation.js';
import { generatePrefixedId } from '../utils/idGenerator.js';

function mapTransportStationRow(row) {
  if (!row) return null;
  return {
    stationId: row.station_id,
    providerId: row.provider_id,
    stationName: row.station_name,
    address: row.address,
    managerId: row.manager_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// POST /transport-stations
export async function createTransportStation(req, res) {
  try {
    const {
      stationId: incomingStationId = null,
      providerId,
      stationName,
      address = null,
      managerId = null,
    } = req.body;
    const stationId = incomingStationId || await generatePrefixedId(pool, {
      tableName: STATION_TABLE,
      idColumn: 'station_id',
      prefix: 'STN',
    });

    if (!providerId || !stationName) {
      return res.status(400).json({
        message: 'providerId, stationName là bắt buộc',
      });
    }

    const conflictQuery = `
      SELECT 1
      FROM ${STATION_TABLE}
      WHERE station_id = $1
      LIMIT 1;
    `;
    const { rows: conflictRows } = await pool.query(conflictQuery, [stationId]);
    if (conflictRows.length > 0) {
      return res.status(409).json({ message: 'stationId đã tồn tại' });
    }

    const query = `
      INSERT INTO ${STATION_TABLE} (
        station_id, provider_id, station_name, address, manager_id
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [stationId, providerId, stationName, address, managerId];
    const { rows } = await pool.query(query, values);
    return res.status(201).json(mapTransportStationRow(rows[0]));
  } catch (error) {
    console.error('Error creating transport station:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /transport-stations
export async function listTransportStations(req, res) {
  try {
    const { page = 1, limit = 10, providerId, managerId, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const filterValues = [];
    let filterParamIndex = 1;

    if (providerId) {
      whereClause += ` AND ts.provider_id = $${filterParamIndex}`;
      filterValues.push(providerId);
      filterParamIndex++;
    }

    if (managerId) {
      whereClause += ` AND ts.manager_id = $${filterParamIndex}`;
      filterValues.push(managerId);
      filterParamIndex++;
    }

    if (search) {
      whereClause += ` AND (ts.station_name ILIKE $${filterParamIndex} OR ts.address ILIKE $${filterParamIndex})`;
      filterValues.push(`%${search}%`);
      filterParamIndex++;
    }

    const values = [...filterValues, limit, offset];
    const query = `
      SELECT ts.*
      FROM ${STATION_TABLE} ts
      ${whereClause}
      ORDER BY ts.created_at DESC
      LIMIT $${filterParamIndex} OFFSET $${filterParamIndex + 1};
    `;
    const { rows } = await pool.query(query, values);

    const countQuery = `SELECT COUNT(*) as total FROM ${STATION_TABLE} ts ${whereClause};`;
    const { rows: countRows } = await pool.query(countQuery, filterValues);

    return res.json({
      stations: rows.map(mapTransportStationRow),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: parseInt(countRows[0].total, 10),
        totalPages: Math.ceil(countRows[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing transport stations:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /transport-stations/:id
export async function getTransportStationById(req, res) {
  try {
    const { id } = req.params;
    const query = `
      SELECT *
      FROM ${STATION_TABLE}
      WHERE station_id = $1
      LIMIT 1;
    `;
    const { rows } = await pool.query(query, [id]);
    const station = mapTransportStationRow(rows[0]);
    if (!station) {
      return res.status(404).json({ message: 'Transport station không tồn tại' });
    }
    return res.json(station);
  } catch (error) {
    console.error('Error getting transport station:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// PATCH /transport-stations/:id
export async function updateTransportStation(req, res) {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    delete updates.stationId;
    delete updates.createdAt;
    delete updates.updatedAt;

    const allowed = ['providerId', 'stationName', 'address', 'managerId'];
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
      UPDATE ${STATION_TABLE}
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE station_id = $${paramIndex}
      RETURNING *;
    `;
    const { rows } = await pool.query(query, values);
    const station = mapTransportStationRow(rows[0]);
    if (!station) {
      return res.status(404).json({ message: 'Transport station không tồn tại' });
    }
    return res.json(station);
  } catch (error) {
    console.error('Error updating transport station:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// DELETE /transport-stations/:id
export async function deleteTransportStation(req, res) {
  try {
    const { id } = req.params;
    const query = `DELETE FROM ${STATION_TABLE} WHERE station_id = $1 RETURNING station_id;`;
    const { rows } = await pool.query(query, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Transport station không tồn tại' });
    }
    return res.json({ message: 'Đã xóa transport station' });
  } catch (error) {
    console.error('Error deleting transport station:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

