import express from 'express';
import {
  createUser,
  getUserById,
  listUsers,
  updateUser,
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

export default router;

