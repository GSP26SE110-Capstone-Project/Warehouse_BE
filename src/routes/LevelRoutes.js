import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import {
  createLevel,
  listLevels,
  getLevelById,
  updateLevel,
  deleteLevel,
} from '../controllers/LevelController.js';

const router = express.Router();

/**
 * @swagger
 * /api/levels:
 *   get:
 *     tags: [Levels]
 *     summary: Danh sách levels
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: rackId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Level list
 */
router.get('/', listLevels);

/**
 * @swagger
 * /api/levels:
 *   post:
 *     tags: [Levels]
 *     summary: Tạo level mới
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rackId, levelNumber]
 *             properties:
 *               rackId:
 *                 type: string
 *               levelNumber:
 *                 type: integer
 *               heightClearance:
 *                 type: number
 *               maxWeight:
 *                 type: number
 *     responses:
 *       201:
 *         description: Level created
 */
router.post('/', requireAuth, requireRoles('admin', 'warehouse_staff'), createLevel);

/**
 * @swagger
 * /api/levels/{id}:
 *   get:
 *     tags: [Levels]
 *     summary: Chi tiết level
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Level detail
 *       404:
 *         description: Level not found
 */
router.get('/:id', getLevelById);

/**
 * @swagger
 * /api/levels/{id}:
 *   patch:
 *     tags: [Levels]
 *     summary: Cập nhật level
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Level updated
 *       404:
 *         description: Level not found
 */
router.patch('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), updateLevel);

/**
 * @swagger
 * /api/levels/{id}:
 *   delete:
 *     tags: [Levels]
 *     summary: Xóa level
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
 *         description: Level deleted
 *       404:
 *         description: Level not found
 */
router.delete('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), deleteLevel);

export default router;

