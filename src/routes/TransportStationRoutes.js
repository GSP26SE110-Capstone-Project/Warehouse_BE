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

/**
 * @swagger
 * /api/transport-stations:
 *   get:
 *     tags: [TransportStations]
 *     summary: Danh sách trạm vận chuyển
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stations list
 */
router.get('/', requireAuth, requireRoles('admin', 'warehouse_staff', 'transport_staff'), listTransportStations);

/**
 * @swagger
 * /api/transport-stations:
 *   post:
 *     tags: [TransportStations]
 *     summary: Tạo trạm vận chuyển
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Station created
 */
router.post('/', requireAuth, requireRoles('admin', 'warehouse_staff'), createTransportStation);

/**
 * @swagger
 * /api/transport-stations/{id}:
 *   get:
 *     tags: [TransportStations]
 *     summary: Chi tiết trạm vận chuyển
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Station detail
 */
router.get('/:id', requireAuth, requireRoles('admin', 'warehouse_staff', 'transport_staff'), getTransportStationById);

/**
 * @swagger
 * /api/transport-stations/{id}:
 *   patch:
 *     tags: [TransportStations]
 *     summary: Cập nhật trạm vận chuyển
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Station updated
 */
router.patch('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), updateTransportStation);

/**
 * @swagger
 * /api/transport-stations/{id}:
 *   delete:
 *     tags: [TransportStations]
 *     summary: Xóa trạm vận chuyển
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Station deleted
 */
router.delete('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), deleteTransportStation);

export default router;

