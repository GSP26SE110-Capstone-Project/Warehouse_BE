import express from 'express';
import {
  createTenant,
  getTenantById,
  listTenants,
  updateTenant,
  getTenantBranches,
} from '../controllers/TenantController.js';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';

const router = express.Router();

router.use(requireAuth);

// Tạo tenant mới (đăng ký doanh nghiệp)
router.post('/', requireRoles('tenant', 'tenant_admin', 'admin'), createTenant);

// Danh sách tenants
router.get('/', requireRoles('admin'), listTenants);

// Lấy chi tiết tenant theo id
router.get('/:id', requireRoles('tenant', 'tenant_admin', 'admin'), getTenantById);

// Cập nhật tenant
router.patch('/:id', requireRoles('tenant', 'tenant_admin', 'admin'), updateTenant);

// Lấy danh sách branches của tenant
router.get('/:id/branches', requireRoles('tenant', 'tenant_admin', 'admin'), getTenantBranches);

export default router;