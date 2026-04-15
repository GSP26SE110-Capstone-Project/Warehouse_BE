import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import {
  createUser,
  getUserById,
  listUsers,
  updateUser,
  deleteUser,
} from '../controllers/UserController.js';

const router = express.Router();

// Tạo user mới
/**
 * @swagger
 * /api/users:
 *   post:
 *     tags: [Users]
 *     summary: Tạo user mới
 *     responses:
 *       201:
 *         description: User created
 */
router.post('/', createUser);

// Danh sách user
/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: Danh sách user
 *     responses:
 *       200:
 *         description: Users list
 */
router.get('/', listUsers);

// Lấy chi tiết user theo id
/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Chi tiết user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User detail
 */
router.get('/:id', getUserById);

// Cập nhật user
/**
 * @swagger
 * /api/users/{id}:
 *   patch:
 *     tags: [Users]
 *     summary: Cập nhật user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User updated
 */
router.patch('/:id', updateUser);

// Vô hiệu hóa account (admin)
/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Vô hiệu hóa account user
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
 *         description: User disabled
 */
router.delete('/:id', requireAuth, requireRoles('admin'), deleteUser);

export default router;

