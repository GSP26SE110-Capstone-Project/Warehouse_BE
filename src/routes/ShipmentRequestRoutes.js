import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import {
  createShipmentRequest,
  listShipmentRequests,
  getShipmentRequestById,
  approveShipmentRequest,
  rejectShipmentRequest,
} from '../controllers/ShipmentRequestController.js';

const router = express.Router();

router.use(requireAuth);

router.post('/', requireRoles('tenant_admin'), createShipmentRequest);
router.get('/', requireRoles('tenant_admin', 'admin', 'warehouse_staff', 'transport_staff'), listShipmentRequests);
router.get('/:id', requireRoles('tenant_admin', 'admin', 'warehouse_staff', 'transport_staff'), getShipmentRequestById);
router.post('/:id/approve', requireRoles('admin', 'warehouse_staff'), approveShipmentRequest);
router.post('/:id/reject', requireRoles('admin', 'warehouse_staff'), rejectShipmentRequest);

export default router;

