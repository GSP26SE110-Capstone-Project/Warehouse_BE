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

// Admin tạo tài khoản tenant_admin cho một tenant
/**
 * @swagger
 * /api/users:
 *   post:
 *     tags: [Users]
 *     summary: Admin tạo tài khoản tenant_admin
 *     description: |
 *       Chỉ dùng cho admin hệ thống tạo user quản trị tenant (`role` luôn là `tenant_admin` trên server).
 *       `userId` không gửi trong body — server sinh. Cần JWT admin (`bearerAuth`).
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
 *               - passwordHash
 *               - fullName
 *               - tenantId
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin_kh@congty.com
 *               passwordHash:
 *                 type: string
 *                 description: Chuỗi mật khẩu đã hash (bcrypt), do client hoặc BFF hash trước khi gọi API
 *                 example: $2b$10$abcdefghijklmnopqrstuv
 *               fullName:
 *                 type: string
 *                 example: Nguyễn Văn A
 *               tenantId:
 *                 type: string
 *                 description: Mã tenant (FK `tenants.tenant_id`) mà tenant_admin này thuộc về
 *                 example: TEN001
 *               username:
 *                 type: string
 *                 description: Đăng nhập; nếu bỏ qua thì mặc định bằng `email`
 *                 example: admin_kh
 *               branchId:
 *                 type: string
 *                 nullable: true
 *                 description: Chi nhánh gắn tùy chọn (FK `branches.branch_id`)
 *               phone:
 *                 type: string
 *                 nullable: true
 *               isActive:
 *                 type: boolean
 *                 default: true
 *                 description: Tài khoản kích hoạt ngay (mặc định true)
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 description: Nếu gửi thì ưu tiên hơn `isActive` (active = true, inactive = false)
 *     responses:
 *       201:
 *         description: Đã tạo tenant_admin (response không chứa passwordHash)
 *       400:
 *         description: Thiếu field bắt buộc, tenant/branch không tồn tại
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
 *     summary: Cập nhật user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       description: |
 *         Ít nhất một field. Để kích hoạt lại user sau DELETE (soft deactivate), gửi `isActive: true` hoặc `status: "active"`.
 *         `status` chỉ nhận `active` | `inactive` (ánh xạ sang cột `is_active` trong DB).
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
 *               isActive:
 *                 type: boolean
 *                 description: true = kích hoạt, false = vô hiệu (ưu tiên hơn `status` nếu gửi cả hai)
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *               passwordHash:
 *                 type: string
 *                 description: Chuỗi hash mật khẩu (bcrypt) nếu đổi mật khẩu
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

