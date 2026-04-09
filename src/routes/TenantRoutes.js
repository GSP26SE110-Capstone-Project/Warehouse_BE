import express from 'express';
import {
  createTenant,
  getTenantById,
  listTenants,
  updateTenant,
  getTenantBranches,
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
 *     responses:
 *       201:
 *         description: Tenant created
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
 *     responses:
 *       200:
 *         description: Tenant updated
 *       404:
 *         description: Tenant not found
 */
router.patch('/:id', requireRoles('tenant', 'tenant_admin', 'admin'), updateTenant);

// Lấy danh sách branches của tenant
/**
 * @swagger
 * /api/tenants/{id}/branches:
 *   get:
 *     tags: [Tenants]
 *     summary: Get tenant branches
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
 *         description: Branches list
 *       404:
 *         description: Tenant not found
 */
router.get('/:id/branches', requireRoles('tenant', 'tenant_admin', 'admin'), getTenantBranches);

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