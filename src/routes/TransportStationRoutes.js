import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import {
  createTransportStation,
  listTransportStations,
  getTransportStationById,
  updateTransportStation,
  deleteTransportStation,
} from '../controllers/TransportStationController.js';

const router = express.Router();

router.get('/', requireAuth, requireRoles('admin', 'warehouse_manager', 'transport_staff'), listTransportStations);
router.post('/', requireAuth, requireRoles('admin', 'warehouse_manager'), createTransportStation);
router.get('/:id', requireAuth, requireRoles('admin', 'warehouse_manager', 'transport_staff'), getTransportStationById);
router.patch('/:id', requireAuth, requireRoles('admin', 'warehouse_manager'), updateTransportStation);
router.delete('/:id', requireAuth, requireRoles('admin', 'warehouse_manager'), deleteTransportStation);

export default router;

