import express from 'express';
import {
  register,
  login,
  verifyRegisterOtp,
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
 *             required: [userId, password, fullName]
 *             properties:
 *               userId:
 *                 type: string
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
 *                 example: tenant
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

// Xác thực OTP cho user vừa register
router.post('/verify-register-otp', verifyRegisterOtp);

// Gửi OTP quên mật khẩu
router.post('/forgot-password', forgotPassword);

// Đổi mật khẩu bằng OTP
router.post('/reset-password', resetPassword);

export default router;

