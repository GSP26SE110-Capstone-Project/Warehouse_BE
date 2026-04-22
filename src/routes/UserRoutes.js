import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import {
  createUser,
  getUserById,
  listUsers,
  updateUser,
  restoreUser,
  deleteUser,
} from '../controllers/UserController.js';

const router = express.Router();

// Admin tạo tài khoản tenant_admin cho một tenant
/**
 * @swagger
 * /api/users:
 *   post:
 *     tags: [Users]
 *     summary: Admin tạo tài khoản nội bộ (admin / warehouse_staff / transport_staff)
 *     description: |
 *       Chỉ `admin` đăng nhập được phép gọi. Dùng để tạo tài khoản nội bộ cho admin khác
 *       hoặc nhân viên kho/giao vận. Không tạo được `tenant_admin` — end-user phải tự
 *       register qua `POST /api/auth/register` (có xác thực OTP/email).
 *       `userId` không gửi trong body — server sinh. Mật khẩu gửi plaintext ở `password`,
 *       server tự hash bằng bcrypt.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullName
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: staff_kho@congty.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 description: Plaintext password. Server tự hash bằng bcrypt.
 *                 example: Password@123
 *               fullName:
 *                 type: string
 *                 example: Nguyễn Văn A
 *               role:
 *                 type: string
 *                 enum: [admin, warehouse_staff, transport_staff]
 *                 description: |
 *                   Role của tài khoản tạo mới. Whitelist: `admin`, `warehouse_staff`,
 *                   `transport_staff`. Không chấp nhận `tenant_admin`.
 *                 example: warehouse_staff
 *               username:
 *                 type: string
 *                 description: Đăng nhập; nếu bỏ qua thì mặc định bằng `email`
 *                 example: staff_kho
 *               phone:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Đã tạo user nội bộ (response không chứa password/passwordHash)
 *       400:
 *         description: Thiếu field bắt buộc hoặc role không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không phải admin
 *       409:
 *         description: Trùng email hoặc username
 */
router.post('/', requireAuth, requireRoles('admin'), createUser);

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
 *     summary: Cập nhật thông tin hồ sơ user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       description: |
 *         Ít nhất một field. PATCH chỉ cập nhật hồ sơ (email, fullName, phone, role).
 *         Các thao tác khác đi qua endpoint chuyên trách:
 *         - Đổi mật khẩu: `POST /api/auth/forgot-password` -> `POST /api/auth/reset-password`.
 *         - Vô hiệu hoá: `DELETE /api/users/{id}`.
 *         - Kích hoạt lại: `POST /api/users/{id}/restore`.
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               fullName:
 *                 type: string
 *               phone:
 *                 type: string
 *               role:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated
 */
router.patch('/:id', updateUser);

// Kích hoạt lại account đã bị soft-delete (admin)
/**
 * @swagger
 * /api/users/{id}/restore:
 *   post:
 *     tags: [Users]
 *     summary: Kích hoạt lại account user đã bị vô hiệu hoá (admin-only)
 *     description: |
 *       Flip `is_active` từ `false` về `true` cho user đã bị `DELETE /api/users/{id}`
 *       (soft deactivate). Idempotent: gọi khi user đang active sẽ trả 409.
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
 *         description: Account restored successfully
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không phải admin
 *       404:
 *         description: User not found
 *       409:
 *         description: User đang active, không cần restore
 */
router.post('/:id/restore', requireAuth, requireRoles('admin'), restoreUser);

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

