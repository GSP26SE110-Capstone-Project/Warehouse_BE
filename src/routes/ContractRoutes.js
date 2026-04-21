import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import {
  createContract,
  listContracts,
  getContractById,
  updateContract,
  deleteContract,
  sendContractToTenant,
  signContractByTenant,
} from '../controllers/ContractController.js';

const router = express.Router();

// Danh sách contracts
/**
 * @swagger
 * /api/contracts:
 *   get:
 *     tags: [Contracts]
 *     summary: Danh sách hợp đồng
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Contracts list
 */
router.get('/', requireAuth, requireRoles('admin', 'tenant_admin', 'warehouse_staff', 'transport_staff'), listContracts);

// Tạo contract mới
/**
 * @swagger
 * /api/contracts:
 *   post:
 *     tags: [Contracts]
 *     summary: Tạo hợp đồng mới
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - requestId
 *               - totalRentalFee
 *             properties:
 *               requestId:
 *                 type: string
 *                 description: ID rental request (phải APPROVED, chưa có contract). Hệ thống tự suy ra contractCode/startDate/endDate/billingCycle/rentalDurationDays/tenantId.
 *               totalRentalFee:
 *                 type: number
 *                 description: Tổng phí thuê
 *               approvedBy:
 *                 type: string
 *                 nullable: true
 *                 description: user_id người duyệt (nếu có)
 *               selectedRackIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Bắt buộc khi rentalType của request = RACK
 *               selectedLevelIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Bắt buộc khi rentalType của request = LEVEL
 *               status:
 *                 type: string
 *                 enum: [DRAFT, SENT_TO_TENANT, CANCELLED]
 *                 default: DRAFT
 *                 description: Mặc định DRAFT; chỉ chuyển hợp lệ từ DRAFT khi tạo
 *           example:
 *             requestId: RRQ0001
 *             totalRentalFee: 120000000
 *             selectedRackIds: [RCK0001, RCK0002]
 *             approvedBy: USR0001
 *             status: DRAFT
 *     responses:
 *       201:
 *         description: Contract created
 *       400:
 *         description: Thiếu field / rental request chưa APPROVED / status không hợp lệ
 *       404:
 *         description: Rental request không tồn tại
 *       409:
 *         description: contractCode trùng hoặc request đã có contract
 */
router.post('/', requireAuth, requireRoles('admin', 'warehouse_staff'), createContract);

// Chi tiết contract
/**
 * @swagger
 * /api/contracts/{id}:
 *   get:
 *     tags: [Contracts]
 *     summary: Chi tiết hợp đồng
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
 *         description: Contract detail
 */
router.get('/:id', requireAuth, requireRoles('admin', 'tenant_admin', 'warehouse_staff', 'transport_staff'), getContractById);

// Cập nhật contract
/**
 * @swagger
 * /api/contracts/{id}:
 *   patch:
 *     tags: [Contracts]
 *     summary: Cập nhật hợp đồng
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
 *         description: Contract updated
 */
router.patch('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), updateContract);

// Gui hop dong cho tenant
/**
 * @swagger
 * /api/contracts/{id}/send:
 *   post:
 *     tags: [Contracts]
 *     summary: Gửi hợp đồng cho tenant
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
 *       description: Body tùy chọn. Có thể gửi `contractFileUrl` (URL file hợp đồng PDF…); nếu không gửi hoặc null thì giữ nguyên `contract_file_url` hiện có trên bản ghi.
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contractFileUrl:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *                 description: URL file hợp đồng đính kèm (lưu vào DB trước khi chuyển SENT_TO_TENANT)
 *           example:
 *             contractFileUrl: "https://storage.example.com/contracts/CTR-2026-0001.pdf"
 *     responses:
 *       200:
 *         description: Contract sent (status = SENT_TO_TENANT, sent_at set)
 *       400:
 *         description: Contract không tồn tại hoặc không ở trạng thái DRAFT
 */
router.post('/:id/send', requireAuth, requireRoles('admin', 'warehouse_staff'), sendContractToTenant);

// Tenant ky hop dong
/**
 * @swagger
 * /api/contracts/{id}/sign:
 *   post:
 *     tags: [Contracts]
 *     summary: Tenant ký hợp đồng
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
 *         description: Contract signed
 */
router.post('/:id/sign', requireAuth, requireRoles('tenant_admin'), signContractByTenant);

// Hủy contract (soft delete)
/**
 * @swagger
 * /api/contracts/{id}:
 *   delete:
 *     tags: [Contracts]
 *     summary: Hủy hợp đồng (soft delete)
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
 *         description: Contract cancelled
 */
router.delete('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), deleteContract);

export default router;

