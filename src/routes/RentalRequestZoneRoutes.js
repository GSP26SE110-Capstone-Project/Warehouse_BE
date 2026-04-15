import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import {
  listRentalRequestZones,
  getRentalRequestZone,
  createRentalRequestZone,
  updateRentalRequestZone,
  deleteRentalRequestZone,
} from '../controllers/RentalRequestZoneController.js';

const router = express.Router();

router.use(requireAuth);

/**
 * @swagger
 * /api/rental-request-zones:
 *   get:
 *     tags: [RentalRequestZones]
 *     summary: Danh sách zone gắn với một rental request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: rentalRequestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Danh sách zone của request
 */
router.get(
  '/',
  requireRoles('tenant', 'tenant_admin', 'admin', 'warehouse_staff', 'transport_staff'),
  listRentalRequestZones,
);

/**
 * @swagger
 * /api/rental-request-zones:
 *   post:
 *     tags: [RentalRequestZones]
 *     summary: Gắn thêm zone vào rental request (chỉ khi PENDING)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rentalRequestId, zoneId]
 *             properties:
 *               rentalRequestId:
 *                 type: string
 *               zoneId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Đã gắn zone
 */
router.post('/', requireRoles('admin', 'warehouse_staff'), createRentalRequestZone);

/**
 * @swagger
 * /api/rental-request-zones/{rentalRequestId}/{zoneId}:
 *   get:
 *     tags: [RentalRequestZones]
 *     summary: Chi tiết một liên kết request–zone
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rentalRequestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: zoneId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chi tiết liên kết
 *       404:
 *         description: Not found
 */
router.get(
  '/:rentalRequestId/:zoneId',
  requireRoles('tenant', 'tenant_admin', 'admin', 'warehouse_staff', 'transport_staff'),
  getRentalRequestZone,
);

/**
 * @swagger
 * /api/rental-request-zones/{rentalRequestId}/{zoneId}:
 *   patch:
 *     tags: [RentalRequestZones]
 *     summary: Đổi zone (body.zoneId = zone mới, cùng request, chỉ khi PENDING)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rentalRequestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: zoneId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [zoneId]
 *             properties:
 *               zoneId:
 *                 type: string
 *                 description: zoneId mới thay thế zoneId trên path
 *     responses:
 *       200:
 *         description: Đã cập nhật
 */
router.patch('/:rentalRequestId/:zoneId', requireRoles('admin', 'warehouse_staff'), updateRentalRequestZone);

/**
 * @swagger
 * /api/rental-request-zones/{rentalRequestId}/{zoneId}:
 *   delete:
 *     tags: [RentalRequestZones]
 *     summary: Gỡ zone khỏi rental request (chỉ khi PENDING)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rentalRequestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: zoneId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Đã xóa liên kết
 */
router.delete('/:rentalRequestId/:zoneId', requireRoles('admin', 'warehouse_staff'), deleteRentalRequestZone);

export default router;
