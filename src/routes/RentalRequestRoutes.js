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

/**
 * @swagger
 * /api/rental-requests:
 *   get:
 *     tags: [RentalRequests]
 *     summary: Danh sách rental requests
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
 *         name: tenantId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Danh sách requests
 */
// Danh sách rental requests
router.get('/', requireRoles('tenant', 'tenant_admin', 'admin', 'warehouse_staff', 'transport_staff'), listRentalRequests);

/**
 * @swagger
 * /api/rental-requests/{id}:
 *   get:
 *     tags: [RentalRequests]
 *     summary: Chi tiết rental request (kèm selectedZones từ bảng liên kết)
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
 *         description: Chi tiết request
 *       404:
 *         description: Not found
 */
// Lấy chi tiết rental request
router.get('/:id', requireRoles('tenant', 'tenant_admin', 'admin', 'warehouse_staff', 'transport_staff'), getRentalRequestById);

/**
 * @swagger
 * /api/rental-requests/{id}:
 *   patch:
 *     tags: [RentalRequests]
 *     summary: Cập nhật rental request (chỉ khi PENDING)
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
 *         description: Đã cập nhật
 */
// Cập nhật rental request
router.patch('/:id', requireRoles('tenant', 'tenant_admin', 'admin'), updateRentalRequest);

/**
 * @swagger
 * /api/rental-requests/{id}/approve:
 *   post:
 *     tags: [RentalRequests]
 *     summary: Duyệt rental request
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
 *       description: Không cần field nào. Người duyệt luôn lấy từ JWT (user đang đăng nhập).
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Đã duyệt
 */
// Approve rental request
router.post('/:id/approve', requireRoles('admin', 'warehouse_staff'), approveRentalRequest);

/**
 * @swagger
 * /api/rental-requests/{id}/reject:
 *   post:
 *     tags: [RentalRequests]
 *     summary: Từ chối rental request
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
 *         description: Đã từ chối
 */
// Reject rental request
router.post('/:id/reject', requireRoles('admin', 'warehouse_staff'), rejectRentalRequest);

export default router;