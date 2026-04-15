import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import {
  createSlot,
  listSlots,
  getSlotById,
  updateSlot,
  deleteSlot,
} from '../controllers/SlotController.js';

const router = express.Router();

/**
 * @swagger
 * /api/slots:
 *   get:
 *     tags: [Slots]
 *     summary: Danh sách slots
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
 *         name: levelId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [EMPTY, RENTED, MAINTENANCE]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Slot list
 */
router.get('/', listSlots);

/**
 * @swagger
 * /api/slots:
 *   post:
 *     tags: [Slots]
 *     summary: Tạo slot mới
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [levelId, slotCode, length, width, height]
 *             properties:
 *               slotId:
 *                 type: string
 *                 description: Tùy chọn. Nếu không gửi, hệ thống tự sinh theo dạng SLT0001
 *               levelId:
 *                 type: string
 *               slotCode:
 *                 type: string
 *               length:
 *                 type: number
 *               width:
 *                 type: number
 *               height:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [EMPTY, RENTED, MAINTENANCE]
 *                 default: EMPTY
 *     responses:
 *       201:
 *         description: Slot created
 */
router.post('/', requireAuth, requireRoles('admin', 'warehouse_staff'), createSlot);

/**
 * @swagger
 * /api/slots/{id}:
 *   get:
 *     tags: [Slots]
 *     summary: Chi tiết slot
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Slot detail
 *       404:
 *         description: Slot not found
 */
router.get('/:id', getSlotById);

/**
 * @swagger
 * /api/slots/{id}:
 *   patch:
 *     tags: [Slots]
 *     summary: Cập nhật slot
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Slot updated
 *       404:
 *         description: Slot not found
 */
router.patch('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), updateSlot);

/**
 * @swagger
 * /api/slots/{id}:
 *   delete:
 *     tags: [Slots]
 *     summary: Xóa slot
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
 *         description: Slot deleted
 *       404:
 *         description: Slot not found
 */
router.delete('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), deleteSlot);

export default router;

