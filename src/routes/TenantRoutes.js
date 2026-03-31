import express from 'express';
import {
  createTenant,
  getTenantById,
  listTenants,
  updateTenant,
  getTenantBranches,
} from '../controllers/TenantController.js';

const router = express.Router();

// Tạo tenant mới (đăng ký doanh nghiệp)
router.post('/', createTenant);

// Danh sách tenants
router.get('/', listTenants);

// Lấy chi tiết tenant theo id
router.get('/:id', getTenantById);

// Cập nhật tenant
router.patch('/:id', updateTenant);

// Lấy danh sách branches của tenant
router.get('/:id/branches', getTenantBranches);

export default router;