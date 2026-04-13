import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import {
  createTransportationProvider,
  listTransportationProviders,
  getTransportationProviderById,
  updateTransportationProvider,
  deleteTransportationProvider,
} from '../controllers/TransportationProviderController.js';

const router = express.Router();

router.get('/', requireAuth, requireRoles('admin', 'warehouse_manager', 'transport_staff'), listTransportationProviders);
router.post('/', requireAuth, requireRoles('admin', 'warehouse_manager'), createTransportationProvider);
router.get('/:id', requireAuth, requireRoles('admin', 'warehouse_manager', 'transport_staff'), getTransportationProviderById);
router.patch('/:id', requireAuth, requireRoles('admin', 'warehouse_manager'), updateTransportationProvider);
router.delete('/:id', requireAuth, requireRoles('admin', 'warehouse_manager'), deleteTransportationProvider);

export default router;

