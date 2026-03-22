import express from 'express';
import {
  register,
  login,
  verifyRegisterOtp,
  forgotPassword,
  resetPassword,
} from '../controllers/AuthController.js';

const router = express.Router();

// Đăng ký tài khoản mới
router.post('/register', register);

// Đăng nhập bằng email hoặc phone + password
router.post('/login', login);

// Xác thực OTP cho user vừa register
router.post('/verify-register-otp', verifyRegisterOtp);

// Gửi OTP quên mật khẩu
router.post('/forgot-password', forgotPassword);

// Đổi mật khẩu bằng OTP
router.post('/reset-password', resetPassword);

export default router;

