import express from 'express';
import { listZones, createZone, getZoneById, updateZone, deleteZone } from '../controllers/ZoneController.js';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/zones:
 *   get:
 *     tags: [Zones]
 *     summary: List zones with optional filters
 *     parameters:
 *       - in: query
 *         name: available
 *         schema:
 *           type: boolean
 *         description: true for available zones, false for rented zones
 *       - in: query
 *         name: warehouseId
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Zones list
 */
// Danh sách zones, hỗ trợ filter query: available, warehouseId
router.get('/', listZones);

/**
 * @swagger
 * /api/zones:
 *   post:
 *     tags: [Zones]
 *     summary: Create a new zone
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Zone created
 */
router.post('/', requireAuth, requireRoles('admin', 'warehouse_manager'), createZone);

/**
 * @swagger
 * /api/zones/{id}:
 *   get:
 *     tags: [Zones]
 *     summary: Get zone detail
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Zone detail
 */
router.get('/:id', getZoneById);

/**
 * @swagger
 * /api/zones/{id}:
 *   patch:
 *     tags: [Zones]
 *     summary: Update zone
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Zone updated
 */
router.patch('/:id', requireAuth, requireRoles('admin', 'warehouse_manager'), updateZone);

/**
 * @swagger
 * /api/zones/{id}:
 *   delete:
 *     tags: [Zones]
 *     summary: Delete zone
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Zone deleted
 */
router.delete('/:id', requireAuth, requireRoles('admin', 'warehouse_manager'), deleteZone);

export default router;

