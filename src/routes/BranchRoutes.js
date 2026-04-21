import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import {
  createBranch,
  listBranches,
  getBranchById,
  updateBranch,
  deleteBranch,
} from '../controllers/BranchController.js';

const router = express.Router();

/**
 * @swagger
 * /api/branches:
 *   get:
 *     tags: [Branches]
 *     summary: Danh sách chi nhánh
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
 *         name: city
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Branch list
 */
router.get('/', listBranches);

/**
 * @swagger
 * /api/branches:
 *   post:
 *     tags: [Branches]
 *     summary: Tạo chi nhánh mới
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [branchCode, branchName]
 *             properties:
 *               managerId:
 *                 type: string
 *               branchCode:
 *                 type: string
 *               branchName:
 *                 type: string
 *               city:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Branch created
 */
router.post('/', requireAuth, requireRoles('admin', 'warehouse_staff'), createBranch);

/**
 * @swagger
 * /api/branches/{id}:
 *   get:
 *     tags: [Branches]
 *     summary: Chi tiết chi nhánh
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Branch detail
 *       404:
 *         description: Branch not found
 */
router.get('/:id', getBranchById);

/**
 * @swagger
 * /api/branches/{id}:
 *   patch:
 *     tags: [Branches]
 *     summary: Cập nhật chi nhánh
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
 *         description: Branch updated
 *       404:
 *         description: Branch not found
 */
router.patch('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), updateBranch);

/**
 * @swagger
 * /api/branches/{id}:
 *   delete:
 *     tags: [Branches]
 *     summary: Xóa mềm chi nhánh
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
 *         description: Branch deleted
 *       404:
 *         description: Branch not found
 */
router.delete('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), deleteBranch);

export default router;

