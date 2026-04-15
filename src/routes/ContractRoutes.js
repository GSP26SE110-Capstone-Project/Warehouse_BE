import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import {
  createContract,
  listContracts,
  getContractById,
  updateContract,
  deleteContract,
} from '../controllers/ContractController.js';

const router = express.Router();

// Danh sách contracts
router.get('/', requireAuth, requireRoles('admin', 'tenant_admin', 'warehouse_staff', 'transport_staff'), listContracts);

// Tạo contract mới
router.post('/', requireAuth, requireRoles('admin', 'warehouse_staff'), createContract);

// Chi tiết contract
router.get('/:id', requireAuth, requireRoles('admin', 'tenant_admin', 'warehouse_staff', 'transport_staff'), getContractById);

// Cập nhật contract
router.patch('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), updateContract);

// Hủy contract (soft delete)
router.delete('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), deleteContract);

export default router;

