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
router.post('/', createUser);

// Danh sách user
router.get('/', listUsers);

// Lấy chi tiết user theo id
router.get('/:id', getUserById);

// Cập nhật user
router.patch('/:id', updateUser);

// Vô hiệu hóa account (admin)
router.delete('/:id', requireAuth, requireRoles('admin'), deleteUser);

export default router;

