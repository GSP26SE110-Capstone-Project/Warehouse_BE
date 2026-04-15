import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import {
  createShipment,
  listShipments,
  getShipmentById,
  updateShipment,
  deleteShipment,
} from '../controllers/ShipmentController.js';

const router = express.Router();

/**
 * @swagger
 * /api/shipments:
 *   get:
 *     tags: [Shipments]
 *     summary: Danh sách vận chuyển (tenant có thể theo dõi shipment của tenant mình)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: contractId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SCHEDULING, IN_TRANSIT, DELIVERED, CANCELLED]
 *       - in: query
 *         name: shipmentType
 *         schema:
 *           type: string
 *           enum: [IMPORT, EXPORT]
 *     responses:
 *       200:
 *         description: Shipments list
 */
router.get('/', requireAuth, requireRoles('admin', 'warehouse_staff', 'transport_staff', 'tenant_admin'), listShipments);

/**
 * @swagger
 * /api/shipments:
 *   post:
 *     tags: [Shipments]
 *     summary: Tạo shipment thủ công (admin/staff)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Shipment created
 */
router.post('/', requireAuth, requireRoles('admin', 'warehouse_staff', 'transport_staff'), createShipment);

/**
 * @swagger
 * /api/shipments/{id}:
 *   get:
 *     tags: [Shipments]
 *     summary: Chi tiết shipment
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
 *         description: Shipment detail
 *       404:
 *         description: Not found
 */
router.get('/:id', requireAuth, requireRoles('admin', 'warehouse_staff', 'transport_staff', 'tenant_admin'), getShipmentById);

/**
 * @swagger
 * /api/shipments/{id}:
 *   patch:
 *     tags: [Shipments]
 *     summary: Cập nhật shipment (trạng thái/điều phối)
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
 *         description: Shipment updated
 */
router.patch('/:id', requireAuth, requireRoles('admin', 'warehouse_staff', 'transport_staff'), updateShipment);

/**
 * @swagger
 * /api/shipments/{id}:
 *   delete:
 *     tags: [Shipments]
 *     summary: Hủy shipment (soft delete)
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
 *         description: Shipment cancelled
 */
router.delete('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), deleteShipment);

export default router;

