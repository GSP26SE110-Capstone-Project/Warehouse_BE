import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import {
  createContractItem,
  listContractItems,
  getContractItemById,
  updateContractItem,
  deleteContractItem,
} from '../controllers/ContractItemController.js';

const router = express.Router();

router.get('/', requireAuth, requireRoles('admin', 'warehouse_manager', 'tenant_admin'), listContractItems);
router.post('/', requireAuth, requireRoles('admin', 'warehouse_manager'), createContractItem);
router.get('/:id', requireAuth, requireRoles('admin', 'warehouse_manager', 'tenant_admin'), getContractItemById);
router.patch('/:id', requireAuth, requireRoles('admin', 'warehouse_manager'), updateContractItem);
router.delete('/:id', requireAuth, requireRoles('admin', 'warehouse_manager'), deleteContractItem);

export default router;

