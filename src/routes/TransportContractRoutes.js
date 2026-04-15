import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import {
  getTransportContractById,
  sendTransportContract,
  signTransportContract,
} from '../controllers/TransportContractController.js';

const router = express.Router();

router.use(requireAuth);

router.get('/:id', requireRoles('tenant_admin', 'admin', 'warehouse_staff', 'transport_staff'), getTransportContractById);
router.post('/:id/send', requireRoles('admin', 'warehouse_staff'), sendTransportContract);
router.post('/:id/sign', requireRoles('tenant_admin'), signTransportContract);

export default router;

