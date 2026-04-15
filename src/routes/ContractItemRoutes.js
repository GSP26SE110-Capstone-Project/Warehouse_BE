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

router.get('/', requireAuth, requireRoles('admin', 'tenant_admin', 'warehouse_staff', 'transport_staff'), listContractItems);
router.post('/', requireAuth, requireRoles('admin', 'warehouse_staff'), createContractItem);
router.get('/:id', requireAuth, requireRoles('admin', 'tenant_admin', 'warehouse_staff', 'transport_staff'), getContractItemById);
router.patch('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), updateContractItem);
router.delete('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), deleteContractItem);

export default router;

