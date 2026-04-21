import express from 'express';
import {
  createTenant,
  getTenantById,
  listTenants,
  updateTenant,
  deleteTenant,
} from '../controllers/TenantController.js';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';

const router = express.Router();

router.use(requireAuth);

/**
 * @swagger
 * /api/tenants:
 *   post:
 *     tags: [Tenants]
 *     summary: Create tenant company profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - companyName
 *               - taxCode
 *               - contactEmail
 *             properties:
 *               companyName:
 *                 type: string
 *                 maxLength: 255
 *               taxCode:
 *                 type: string
 *                 maxLength: 50
 *                 description: Mã số thuế (duy nhất)
 *               contactEmail:
 *                 type: string
 *                 format: email
 *                 maxLength: 255
 *                 description: Email liên hệ (duy nhất)
 *               contactPhone:
 *                 type: string
 *                 maxLength: 20
 *               address:
 *                 type: string
 *                 description: Địa chỉ công ty
 *           example:
 *             companyName: Công ty TNHH ABC
 *             taxCode: "0123456789"
 *             contactEmail: contact@abc.com
 *             contactPhone: "0901234567"
 *             address: 123 Đường X, Quận Y, TP.HCM
 *     responses:
 *       201:
 *         description: Tenant created
 *       400:
 *         description: Thiếu trường bắt buộc
 *       409:
 *         description: Trùng mã số thuế hoặc email
 */
// Tạo tenant mới (đăng ký doanh nghiệp)
router.post('/', requireRoles('tenant', 'tenant_admin', 'admin'), createTenant);

// Danh sách tenants
/**
 * @swagger
 * /api/tenants:
 *   get:
 *     tags: [Tenants]
 *     summary: List tenants
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         required: false
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         required: false
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         required: false
 *     responses:
 *       200:
 *         description: Tenants list
 */
router.get('/', requireRoles('admin'), listTenants);

// Lấy chi tiết tenant theo id
/**
 * @swagger
 * /api/tenants/{id}:
 *   get:
 *     tags: [Tenants]
 *     summary: Get tenant by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Tenant detail
 *       404:
 *         description: Tenant not found
 */
router.get('/:id', requireRoles('tenant', 'tenant_admin', 'admin'), getTenantById);

// Cập nhật tenant
/**
 * @swagger
 * /api/tenants/{id}:
 *   patch:
 *     tags: [Tenants]
 *     summary: Update tenant
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             description: Gửi ít nhất một trường cần cập nhật (camelCase)
 *             properties:
 *               companyName:
 *                 type: string
 *                 maxLength: 255
 *               taxCode:
 *                 type: string
 *                 maxLength: 50
 *               contactEmail:
 *                 type: string
 *                 format: email
 *                 maxLength: 255
 *               contactPhone:
 *                 type: string
 *                 maxLength: 20
 *               address:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *           examples:
 *             updateContact:
 *               summary: Đổi thông tin liên hệ
 *               value:
 *                 contactPhone: "0912345678"
 *                 address: Địa chỉ mới
 *             deactivate:
 *               summary: Vô hiệu hóa tenant
 *               value:
 *                 isActive: false
 *     responses:
 *       200:
 *         description: Tenant updated
 *       400:
 *         description: Body rỗng hoặc không có field hợp lệ
 *       404:
 *         description: Tenant not found
 */
router.patch('/:id', requireRoles('tenant', 'tenant_admin', 'admin'), updateTenant);

/**
 * @swagger
 * /api/tenants/{id}:
 *   delete:
 *     tags: [Tenants]
 *     summary: Delete tenant
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Tenant deleted
 */
router.delete('/:id', requireRoles('admin'), deleteTenant);

export default router;