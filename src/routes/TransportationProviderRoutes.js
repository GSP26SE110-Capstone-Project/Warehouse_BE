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

/**
 * @swagger
 * /api/transportation-providers:
 *   get:
 *     tags: [TransportationProviders]
 *     summary: Danh sách đơn vị vận chuyển
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Providers list
 */
router.get('/', requireAuth, requireRoles('admin', 'warehouse_staff', 'transport_staff'), listTransportationProviders);

/**
 * @swagger
 * /api/transportation-providers:
 *   post:
 *     tags: [TransportationProviders]
 *     summary: Tạo đơn vị vận chuyển
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Provider created
 */
router.post('/', requireAuth, requireRoles('admin', 'warehouse_staff'), createTransportationProvider);

/**
 * @swagger
 * /api/transportation-providers/{id}:
 *   get:
 *     tags: [TransportationProviders]
 *     summary: Chi tiết đơn vị vận chuyển
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
 *         description: Provider detail
 */
router.get('/:id', requireAuth, requireRoles('admin', 'warehouse_staff', 'transport_staff'), getTransportationProviderById);

/**
 * @swagger
 * /api/transportation-providers/{id}:
 *   patch:
 *     tags: [TransportationProviders]
 *     summary: Cập nhật đơn vị vận chuyển
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
 *         description: Provider updated
 */
router.patch('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), updateTransportationProvider);

/**
 * @swagger
 * /api/transportation-providers/{id}:
 *   delete:
 *     tags: [TransportationProviders]
 *     summary: Xóa đơn vị vận chuyển
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
 *         description: Provider deleted
 */
router.delete('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), deleteTransportationProvider);

export default router;

