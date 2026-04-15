import pool from '../config/db.js';
import { tableName as NOTIFICATION_TABLE } from '../models/Notification.js';

function mapNotificationRow(row) {
  if (!row) return null;
  return {
    notificationId: row.notification_id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    content: row.content,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

// GET /notifications/me
export async function listMyNotifications(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const { page = 1, limit = 20, isRead } = req.query;
    const offset = (page - 1) * limit;

    const values = [userId, limit, offset];
    let whereClause = 'WHERE user_id = $1';
    if (isRead !== undefined) {
      whereClause += ' AND is_read = $4';
      values.push(isRead === 'true');
    }

    const query = `
      SELECT *
      FROM ${NOTIFICATION_TABLE}
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const { rows } = await pool.query(query, values);

    const countQuery = `SELECT COUNT(*) AS total FROM ${NOTIFICATION_TABLE} ${whereClause}`;
    const { rows: countRows } = await pool.query(
      countQuery,
      isRead !== undefined ? [userId, isRead === 'true'] : [userId],
    );

    return res.json({
      notifications: rows.map(mapNotificationRow),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: parseInt(countRows[0].total, 10),
        totalPages: Math.ceil(countRows[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing notifications:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

// PATCH /notifications/:id/read
export async function markNotificationRead(req, res) {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { rows } = await pool.query(
      `
      UPDATE ${NOTIFICATION_TABLE}
      SET is_read = true
      WHERE notification_id = $1 AND user_id = $2
      RETURNING *
      `,
      [id, userId],
    );
    const notification = mapNotificationRow(rows[0]);
    if (!notification) return res.status(404).json({ message: 'Notification không tồn tại' });
    return res.json(notification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
}

