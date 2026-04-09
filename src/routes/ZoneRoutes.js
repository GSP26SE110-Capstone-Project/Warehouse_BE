import express from 'express';
import { listZones } from '../controllers/ZoneController.js';

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

export default router;

