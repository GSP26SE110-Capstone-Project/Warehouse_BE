import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import {
  createShipmentRequest,
  listShipmentRequests,
  getShipmentRequestById,
  approveShipmentRequest,
  rejectShipmentRequest,
} from '../controllers/ShipmentRequestController.js';

const router = express.Router();

router.use(requireAuth);

/**
 * @swagger
 * /api/shipment-requests:
 *   post:
 *     tags: [ShipmentRequests]
 *     summary: Tenant tạo yêu cầu vận chuyển
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [requestId, contractId, shipmentType, fromAddress, toAddress]
 *             properties:
 *               requestId:
 *                 type: string
 *               contractId:
 *                 type: string
 *               shipmentType:
 *                 type: string
 *                 enum: [IMPORT, EXPORT]
 *               fromAddress:
 *                 type: string
 *               toAddress:
 *                 type: string
 *               preferredPickupTime:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Shipment request created
 */
router.post('/', requireRoles('tenant_admin'), createShipmentRequest);

/**
 * @swagger
 * /api/shipment-requests:
 *   get:
 *     tags: [ShipmentRequests]
 *     summary: Danh sách yêu cầu vận chuyển
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *       - in: query
 *         name: contractId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Shipment request list
 */
router.get('/', requireRoles('tenant_admin', 'admin', 'warehouse_staff', 'transport_staff'), listShipmentRequests);

/**
 * @swagger
 * /api/shipment-requests/{id}:
 *   get:
 *     tags: [ShipmentRequests]
 *     summary: Chi tiết yêu cầu vận chuyển
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
 *         description: Shipment request detail
 *       404:
 *         description: Not found
 */
router.get('/:id', requireRoles('tenant_admin', 'admin', 'warehouse_staff', 'transport_staff'), getShipmentRequestById);

/**
 * @swagger
 * /api/shipment-requests/{id}/approve:
 *   post:
 *     tags: [ShipmentRequests]
 *     summary: Quản lý kho duyệt yêu cầu vận chuyển (tạo hợp đồng vận chuyển nháp)
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
 *         description: Request approved
 */
router.post('/:id/approve', requireRoles('admin', 'warehouse_staff'), approveShipmentRequest);

/**
 * @swagger
 * /api/shipment-requests/{id}/reject:
 *   post:
 *     tags: [ShipmentRequests]
 *     summary: Quản lý kho từ chối yêu cầu vận chuyển
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
 *             required: [rejectedReason]
 *             properties:
 *               rejectedReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Request rejected
 */
router.post('/:id/reject', requireRoles('admin', 'warehouse_staff'), rejectShipmentRequest);

export default router;

