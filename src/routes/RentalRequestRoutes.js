import express from 'express';
import {
  createRentalRequest,
  getRentalRequestById,
  listRentalRequests,
  updateRentalRequest,
  approveRentalRequest,
  rejectRentalRequest,
} from '../controllers/RentalRequestController.js';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';

const router = express.Router();

router.use(requireAuth);

/**
 * @swagger
 * /api/rental-requests:
 *   post:
 *     tags: [RentalRequests]
 *     summary: Create a new rental request (flow C)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerType
 *               - contactName
 *               - contactPhone
 *               - contactEmail
 *               - warehouseId
 *               - requestedStartDate
 *               - rentalTermUnit
 *               - rentalTermValue
 *               - goodsType
 *               - goodsQuantity
 *               - goodsWeightKg
 *             properties:
 *               requestId:
 *                 type: string
 *                 description: Tùy chọn. Nếu không gửi, hệ thống tự sinh theo dạng RRQ0001
 *               customerType:
 *                 type: string
 *                 enum: [individual, business]
 *               tenantId:
 *                 type: string
 *                 description: Bắt buộc khi customerType = business
 *               contactName:
 *                 type: string
 *               contactPhone:
 *                 type: string
 *               contactEmail:
 *                 type: string
 *               warehouseId:
 *                 type: string
 *               storageType:
 *                 type: string
 *                 enum: [normal]
 *                 default: normal
 *               requestedStartDate:
 *                 type: string
 *                 format: date
 *               rentalTermUnit:
 *                 type: string
 *                 enum: [MONTH, QUARTER, YEAR]
 *               rentalTermValue:
 *                 type: integer
 *               goodsType:
 *                 type: string
 *               goodsDescription:
 *                 type: string
 *               goodsQuantity:
 *                 type: number
 *               goodsWeightKg:
 *                 type: number
 *               notes:
 *                 type: string
 *               selectedZones:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Rental request created
 */
// Tạo rental request mới
router.post('/', requireRoles('tenant', 'tenant_admin', 'admin'), createRentalRequest);

// Danh sách rental requests
router.get('/', requireRoles('tenant', 'tenant_admin', 'admin', 'warehouse_staff', 'transport_staff'), listRentalRequests);

// Lấy chi tiết rental request
router.get('/:id', requireRoles('tenant', 'tenant_admin', 'admin', 'warehouse_staff', 'transport_staff'), getRentalRequestById);

// Cập nhật rental request
router.patch('/:id', requireRoles('tenant', 'tenant_admin', 'admin'), updateRentalRequest);

// Approve rental request
router.post('/:id/approve', requireRoles('admin', 'warehouse_staff'), approveRentalRequest);

// Reject rental request
router.post('/:id/reject', requireRoles('admin', 'warehouse_staff'), rejectRentalRequest);

export default router;