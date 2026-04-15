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

router.get('/', requireAuth, requireRoles('admin', 'warehouse_staff', 'transport_staff'), listTransportStations);
router.post('/', requireAuth, requireRoles('admin', 'warehouse_staff'), createTransportStation);
router.get('/:id', requireAuth, requireRoles('admin', 'warehouse_staff', 'transport_staff'), getTransportStationById);
router.patch('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), updateTransportStation);
router.delete('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), deleteTransportStation);

export default router;

