import pool from '../config/db.js';
import { tableName as LEVEL_TABLE } from '../models/Level.js';
import { generatePrefixedId } from '../utils/idGenerator.js';

function mapLevelRow(row) {
  if (!row) return null;
  return {
    levelId: row.level_id,
    rackId: row.rack_id,
    levelNumber: row.level_number,
    heightClearance: row.height_clearance,
    maxWeight: row.max_weight,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CREATE_REQUIRED_FIELDS = ['rackId', 'levelNumber'];

// POST /levels
export async function createLevel(req, res) {
  try {
    const {
      levelId: incomingLevelId = null,
      rackId,
      levelNumber,
      heightClearance = null,
      maxWeight = null,
    } = req.body;

    const levelId = incomingLevelId || await generatePrefixedId(pool, {
      tableName: LEVEL_TABLE,
      idColumn: 'level_id',
      prefix: 'LVL',
    });

    const requiredPayload = { rackId, levelNumber };
    const missing = CREATE_REQUIRED_FIELDS.filter((field) =>
      requiredPayload[field] === undefined || requiredPayload[field] === null || requiredPayload[field] === ''
    );
    if (missing.length > 0) {
      return res.status(400).json({ message: `Thiếu các field bắt buộc: ${missing.join(', ')}` });
    }

    const conflictQuery = `
      SELECT 1
      FROM ${LEVEL_TABLE}
      WHERE level_id = $1 OR (rack_id = $2 AND level_number = $3)
      LIMIT 1;
    `;
    const { rows: conflictRows } = await pool.query(conflictQuery, [levelId, rackId, levelNumber]);
    if (conflictRows.length > 0) {
      return res.status(409).json({ message: 'levelId hoặc levelNumber đã tồn tại trong rack' });
    }

    const query = `
      INSERT INTO ${LEVEL_TABLE} (
        level_id, rack_id, level_number, height_clearance, max_weight
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [levelId, rackId, levelNumber, heightClearance, maxWeight];
    const { rows } = await pool.query(query, values);
    return res.status(201).json(mapLevelRow(rows[0]));
  } catch (error) {
    console.error('Error creating level:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /levels
export async function listLevels(req, res) {
  try {
    const { page = 1, limit = 10, rackId } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const filterValues = [];
    let i = 1;

    if (rackId) {
      whereClause += ` AND l.rack_id = $${i}`;
      filterValues.push(rackId);
      i++;
    }

    const query = `
      SELECT l.*
      FROM ${LEVEL_TABLE} l
      ${whereClause}
      ORDER BY l.level_number ASC
      LIMIT $${i} OFFSET $${i + 1};
    `;
    const { rows } = await pool.query(query, [...filterValues, limit, offset]);

    const countQuery = `SELECT COUNT(*) as total FROM ${LEVEL_TABLE} l ${whereClause};`;
    const { rows: countRows } = await pool.query(countQuery, filterValues);

    return res.json({
      levels: rows.map(mapLevelRow),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: parseInt(countRows[0].total, 10),
        totalPages: Math.ceil(countRows[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing levels:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// GET /levels/:id
export async function getLevelById(req, res) {
  try {
    const { id } = req.params;
    const query = `SELECT * FROM ${LEVEL_TABLE} WHERE level_id = $1 LIMIT 1;`;
    const { rows } = await pool.query(query, [id]);
    const level = mapLevelRow(rows[0]);
    if (!level) {
      return res.status(404).json({ message: 'Level không tồn tại' });
    }
    return res.json(level);
  } catch (error) {
    console.error('Error getting level:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// PATCH /levels/:id
export async function updateLevel(req, res) {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    delete updates.levelId;
    delete updates.createdAt;
    delete updates.updatedAt;

    const currentQuery = `SELECT * FROM ${LEVEL_TABLE} WHERE level_id = $1 LIMIT 1;`;
    const { rows: currentRows } = await pool.query(currentQuery, [id]);
    const currentLevel = currentRows[0];
    if (!currentLevel) {
      return res.status(404).json({ message: 'Level không tồn tại' });
    }

    const nextRackId = updates.rackId || currentLevel.rack_id;
    const nextLevelNumber = updates.levelNumber || currentLevel.level_number;
    if (updates.rackId !== undefined || updates.levelNumber !== undefined) {
      const conflictQuery = `
        SELECT 1
        FROM ${LEVEL_TABLE}
        WHERE rack_id = $1 AND level_number = $2 AND level_id <> $3
        LIMIT 1;
      `;
      const { rows: conflictRows } = await pool.query(conflictQuery, [nextRackId, nextLevelNumber, id]);
      if (conflictRows.length > 0) {
        return res.status(409).json({ message: 'levelNumber đã tồn tại trong rack' });
      }
    }

    const allowed = ['rackId', 'levelNumber', 'heightClearance', 'maxWeight'];
    const fields = [];
    const values = [];
    let i = 1;
    for (const key of Object.keys(updates)) {
      if (!allowed.includes(key)) continue;
      const dbField = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      fields.push(`${dbField} = $${i}`);
      values.push(updates[key]);
      i++;
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'Không có field nào để cập nhật' });
    }

    values.push(id);
    const query = `
      UPDATE ${LEVEL_TABLE}
      SET ${fields.join(', ')}
      WHERE level_id = $${i}
      RETURNING *;
    `;
    const { rows } = await pool.query(query, values);
    return res.json(mapLevelRow(rows[0]));
  } catch (error) {
    console.error('Error updating level:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// DELETE /levels/:id
export async function deleteLevel(req, res) {
  try {
    const { id } = req.params;
    const query = `DELETE FROM ${LEVEL_TABLE} WHERE level_id = $1 RETURNING level_id;`;
    const { rows } = await pool.query(query, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Level không tồn tại' });
    }
    return res.json({ message: 'Đã xóa level' });
  } catch (error) {
    console.error('Error deleting level:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

