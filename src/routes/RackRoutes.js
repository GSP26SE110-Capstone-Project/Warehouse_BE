import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import {
  createRack,
  listRacks,
  getRackById,
  updateRack,
  deleteRack,
} from '../controllers/RackController.js';

const router = express.Router();

/**
 * @swagger
 * /api/racks:
 *   get:
 *     tags: [Racks]
 *     summary: Danh sách racks
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
 *         name: zoneId
 *         schema:
 *           type: string
 *       - in: query
 *         name: rackSizeType
 *         schema:
 *           type: string
 *           enum: [small, medium, large]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rack list
 */
router.get('/', listRacks);

/**
 * @swagger
 * /api/racks:
 *   post:
 *     tags: [Racks]
 *     summary: Tạo rack mới
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [zoneId, rackCode, length, width, height]
 *             properties:
 *               rackId:
 *                 type: string
 *                 description: Tùy chọn. Nếu không gửi, hệ thống tự sinh theo dạng RCK0001
 *               zoneId:
 *                 type: string
 *               rackCode:
 *                 type: string
 *               rackSizeType:
 *                 type: string
 *                 enum: [small, medium, large]
 *               length:
 *                 type: number
 *               width:
 *                 type: number
 *               height:
 *                 type: number
 *               maxWeightCapacity:
 *                 type: number
 *     responses:
 *       201:
 *         description: Rack created
 */
router.post('/', requireAuth, requireRoles('admin', 'warehouse_staff'), createRack);

/**
 * @swagger
 * /api/racks/{id}:
 *   get:
 *     tags: [Racks]
 *     summary: Chi tiết rack
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rack detail
 *       404:
 *         description: Rack not found
 */
router.get('/:id', getRackById);

/**
 * @swagger
 * /api/racks/{id}:
 *   patch:
 *     tags: [Racks]
 *     summary: Cập nhật rack
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
 *         description: Rack updated
 *       404:
 *         description: Rack not found
 */
router.patch('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), updateRack);

/**
 * @swagger
 * /api/racks/{id}:
 *   delete:
 *     tags: [Racks]
 *     summary: Xóa rack
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
 *         description: Rack deleted
 *       404:
 *         description: Rack not found
 */
router.delete('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), deleteRack);

export default router;

