import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import {
  getTransportContractById,
  sendTransportContract,
  signTransportContract,
} from '../controllers/TransportContractController.js';

const router = express.Router();

router.use(requireAuth);

/**
 * @swagger
 * /api/transport-contracts/{id}:
 *   get:
 *     tags: [TransportContracts]
 *     summary: Xem chi tiết hợp đồng vận chuyển
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
 *         description: Transport contract detail
 *       404:
 *         description: Not found
 */
router.get('/:id', requireRoles('tenant_admin', 'admin', 'warehouse_staff', 'transport_staff'), getTransportContractById);

/**
 * @swagger
 * /api/transport-contracts/{id}/send:
 *   post:
 *     tags: [TransportContracts]
 *     summary: Quản lý kho gửi hợp đồng vận chuyển cho tenant
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transport contract sent
 */
router.post('/:id/send', requireRoles('admin', 'warehouse_staff'), sendTransportContract);

/**
 * @swagger
 * /api/transport-contracts/{id}/sign:
 *   post:
 *     tags: [TransportContracts]
 *     summary: Tenant ký xác nhận hợp đồng vận chuyển (sẽ tạo shipment)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               providerId:
 *                 type: string
 *               driverId:
 *                 type: string
 *               supervisorId:
 *                 type: string
 *               scheduledTime:
 *                 type: string
 *                 format: date-time
 *               totalWeight:
 *                 type: number
 *               totalDistance:
 *                 type: number
 *               shippingFee:
 *                 type: number
 *     responses:
 *       200:
 *         description: Contract signed and shipment created
 */
router.post('/:id/sign', requireRoles('tenant_admin'), signTransportContract);

export default router;

