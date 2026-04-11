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
 *             required: [email, password, fullName]
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
 *     summary: Login by email or phone and receive JWT
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
 *         description: Account activated successfully
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

