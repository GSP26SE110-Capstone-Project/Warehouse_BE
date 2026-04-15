import express from 'express';
import { requireAuth } from '../middlewares/AuthMiddleware.js';
import { listMyNotifications, markNotificationRead } from '../controllers/NotificationController.js';

const router = express.Router();

router.use(requireAuth);

/**
 * @swagger
 * /api/notifications/me:
 *   get:
 *     tags: [Notifications]
 *     summary: Lấy danh sách thông báo của user hiện tại
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Notifications list
 */
router.get('/me', listMyNotifications);

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Đánh dấu thông báo đã đọc
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found
 */
router.patch('/:id/read', markNotificationRead);

export default router;

