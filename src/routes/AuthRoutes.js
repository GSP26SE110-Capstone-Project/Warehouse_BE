import express from 'express';
import {
  register,
  login,
  verifyRegisterOtp,
  resendRegisterOtp,
  forgotPassword,
  resetPassword,
} from '../controllers/AuthController.js';

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

export default router;

