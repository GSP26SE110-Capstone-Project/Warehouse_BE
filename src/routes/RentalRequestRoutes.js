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

// Tạo rental request mới
router.post('/', requireRoles('tenant', 'tenant_admin', 'admin'), createRentalRequest);

// Danh sách rental requests
router.get('/', requireRoles('tenant', 'tenant_admin', 'admin', 'warehouse_manager'), listRentalRequests);

// Lấy chi tiết rental request
router.get('/:id', requireRoles('tenant', 'tenant_admin', 'admin', 'warehouse_manager'), getRentalRequestById);

// Cập nhật rental request
router.patch('/:id', requireRoles('tenant', 'tenant_admin', 'admin'), updateRentalRequest);

// Approve rental request
router.post('/:id/approve', requireRoles('admin', 'warehouse_manager'), approveRentalRequest);

// Reject rental request
router.post('/:id/reject', requireRoles('admin', 'warehouse_manager'), rejectRentalRequest);

export default router;