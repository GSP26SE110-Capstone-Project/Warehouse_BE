import express from 'express';
import {
  register,
  login,
  verifyRegisterOtp,
  resendRegisterOtp,
  forgotPassword,
  resetPassword,
  refreshAccessToken,
  logout,
  logoutAll,
  getMe,
} from '../controllers/AuthController.js';
import { requireAuth } from '../middlewares/AuthMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, phone, password, fullName]
 *             properties:
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *               fullName:
 *                 type: string
 *               role:
 *                 type: string
 *                 example: tenant_admin
 *     responses:
 *       201:
 *         description: Registered successfully
 */
// Đăng ký tài khoản mới
router.post('/register', register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login by email or phone and receive access + refresh token
 *     description: |
 *       Trả về cặp `accessToken` (JWT, TTL ngắn) và `refreshToken`
 *       (opaque string, TTL dài — mặc định 30 ngày). Khi access token hết hạn,
 *       FE gọi `POST /api/auth/refresh` với `refreshToken` để lấy cặp mới.
 *
 *       Lưu refreshToken ở nơi an toàn (httpOnly cookie / secure storage).
 *       KHÔNG đưa vào localStorage nếu có thể tránh.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                 accessToken:
 *                   type: string
 *                   description: JWT access token (gửi trong header Authorization).
 *                 refreshToken:
 *                   type: string
 *                   description: Opaque refresh token (chỉ trả 1 lần duy nhất).
 *                 refreshTokenExpiresAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Sai email/phone hoặc password
 *       403:
 *         description: Tài khoản chưa kích hoạt hoặc đã bị khóa
 */
// Đăng nhập bằng email hoặc phone + password
router.post('/login', login);

/**
 * @swagger
 * /api/auth/verify-register-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify OTP to activate registered account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp]
 *             properties:
 *               otp:
 *                 type: string
 *               userId:
 *                 type: string
 *                 description: Một trong userId, email hoặc phone (kèm otp)
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: |
 *           Kích hoạt tài khoản thành công. Response tương tự `/login`:
 *           trả cả `accessToken` (JWT) và `refreshToken` (opaque).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 refreshTokenExpiresAt:
 *                   type: string
 *                   format: date-time
 */
// Xác thực OTP cho user vừa register
router.post('/verify-register-otp', verifyRegisterOtp);

/**
 * @swagger
 * /api/auth/resend-register-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Gửi lại OTP đăng ký (tài khoản chưa kích hoạt)
 *     description: Vô hiệu OTP register cũ, tạo mã mới và gửi email. Giới hạn 1 lần / 60 giây.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP mới đã gửi (hoặc tạo)
 *       429:
 *         description: Gọi quá sớm (cooldown)
 */
router.post('/resend-register-otp', resendRegisterOtp);

// Gửi OTP quên mật khẩu
router.post('/forgot-password', forgotPassword);

// Đổi mật khẩu bằng OTP
router.post('/reset-password', resetPassword);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Đổi refresh token lấy cặp access+refresh mới
 *     description: |
 *       Client gửi `refreshToken` (đã nhận lúc login). Server verify, rotate:
 *       revoke token cũ và trả về cặp mới. Endpoint không yêu cầu access token
 *       — để dùng được cả khi access token đã hết hạn.
 *
 *       Reuse detection: nếu `refreshToken` đã bị revoke, server sẽ revoke
 *       toàn bộ refresh token của user đó (nghi ngờ leak) và trả 401.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cặp token mới
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 refreshTokenExpiresAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Thiếu refreshToken
 *       401:
 *         description: Refresh token không hợp lệ / hết hạn / đã bị revoke
 *       403:
 *         description: Tài khoản đã bị khóa
 */
router.post('/refresh', refreshAccessToken);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout phiên hiện tại (revoke 1 refresh token)
 *     description: |
 *       Revoke refresh token được gửi trong body. Idempotent — gọi nhiều lần
 *       không báo lỗi. Không cần access token để gọi, nhưng FE nên xoá
 *       access token khỏi storage phía client sau khi gọi.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logout thành công
 */
router.post('/logout', logout);

/**
 * @swagger
 * /api/auth/logout-all:
 *   post:
 *     tags: [Auth]
 *     summary: Logout tất cả thiết bị của user hiện tại
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Đã revoke toàn bộ refresh token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 revokedCount:
 *                   type: integer
 *       401:
 *         description: Chưa đăng nhập (access token không hợp lệ)
 */
router.post('/logout-all', requireAuth, logoutAll);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Lấy thông tin user hiện tại từ access token
 *     description: |
 *       Dùng để FE bootstrap lại session khi reload trang. Trả user đọc từ
 *       DB (không phải từ JWT claims) để luôn có role/status mới nhất.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin user hiện tại
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *       401:
 *         description: Chưa đăng nhập hoặc access token hết hạn
 *       403:
 *         description: Tài khoản đã bị khóa
 *       404:
 *         description: User không tồn tại
 */
router.get('/me', requireAuth, getMe);

export default router;

