import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import {
  createShipment,
  listShipments,
  getShipmentById,
  updateShipment,
  deleteShipment,
} from '../controllers/ShipmentController.js';

const router = express.Router();

router.get('/', requireAuth, requireRoles('admin', 'warehouse_staff', 'transport_staff', 'tenant_admin'), listShipments);
router.post('/', requireAuth, requireRoles('admin', 'warehouse_staff', 'transport_staff'), createShipment);
router.get('/:id', requireAuth, requireRoles('admin', 'warehouse_staff', 'transport_staff', 'tenant_admin'), getShipmentById);
router.patch('/:id', requireAuth, requireRoles('admin', 'warehouse_staff', 'transport_staff'), updateShipment);
router.delete('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), deleteShipment);

export default router;

