import pool from '../config/db.js';
import { tableName as USER_TABLE } from '../models/User.js';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { sendVerificationEmail, sendForgotPasswordEmail } from '../services/EmailService.js';
import { signAccessToken } from '../services/JwtService.js';

const OTP_TABLE = 'user_otps'; // Cần tạo bảng này trong DB

// Map DB row -> domain object
function mapUserRow(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    email: row.email,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function generateOtp(length = 6) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

// POST /auth/register
export async function register(req, res) {
  try {
    const { email, phone, password, fullName, role = 'tenant' } = req.body;
    const userId = randomUUID();

    if (!email && !phone) {
      return res.status(400).json({ message: 'Email hoặc phone là bắt buộc' });
    }
    if (!password || !fullName) {
      return res.status(400).json({ message: 'fullName và password là bắt buộc' });
    }

    // Kiểm tra trùng email/phone
    const conflictQuery = `
      SELECT 1
      FROM ${USER_TABLE}
      WHERE email = $1 OR phone = $2
      LIMIT 1;
    `;
    const { rows: conflictRows } = await pool.query(conflictQuery, [email || null, phone || null]);
    if (conflictRows.length > 0) {
      return res.status(409).json({ message: 'Email hoặc phone đã tồn tại' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Tạo user với status = 'inactive' để chờ verify OTP
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertUserQuery = `
        INSERT INTO ${USER_TABLE} (
          user_id,
          email,
          password_hash,
          full_name,
          phone,
          role,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'inactive')
        RETURNING *;
      `;

      const userValues = [userId, email || null, passwordHash, fullName, phone || null, role];
      const { rows: userRows } = await client.query(insertUserQuery, userValues);
      const userRow = userRows[0];

      const otp = generateOtp(6);
      const expiresMinutes = 10;

      const insertOtpQuery = `
        INSERT INTO ${OTP_TABLE} (
          user_id,
          otp_code,
          type,
          expires_at,
          used
        )
        VALUES ($1, $2, 'register', NOW() + INTERVAL '${expiresMinutes} minutes', false);
      `;

      await client.query(insertOtpQuery, [userRow.user_id, otp]);
      await client.query('COMMIT');

      const user = mapUserRow(userRow);
      delete user.passwordHash;

      // Gửi email OTP xác thực (nếu có email)
      if (user.email) {
        try {
          await sendVerificationEmail({
            to: user.email,
            fullName: user.fullName,
            otp,
          });
        } catch (mailErr) {
          console.error('Error sending verification email:', mailErr);
          // Không rollback đăng ký nếu gửi mail lỗi
        }
      }

      // Trong dev có thể trả kèm OTP để test, production nên bỏ đi
      return res.status(201).json({
        user,
        otp,
      });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error in register:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// POST /auth/login
export async function login(req, res) {
  try {
    const { email, phone, password } = req.body;

    if ((!email && !phone) || !password) {
      return res.status(400).json({ message: 'Email hoặc phone và password là bắt buộc' });
    }

    const query = `
      SELECT *
      FROM ${USER_TABLE}
      WHERE ($1::varchar IS NOT NULL AND email = $1)
         OR ($2::varchar IS NOT NULL AND phone = $2)
      LIMIT 1;
    `;
    const { rows } = await pool.query(query, [email || null, phone || null]);
    const row = rows[0];

    if (!row) {
      return res.status(401).json({ message: 'Thông tin đăng nhập không đúng' });
    }

    if (row.status !== 'active') {
      return res.status(403).json({ message: 'Tài khoản chưa được kích hoạt hoặc đã bị khóa' });
    }

    const isMatch = await bcrypt.compare(password, row.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Thông tin đăng nhập không đúng' });
    }

    const user = mapUserRow(row);
    delete user.passwordHash;

    const accessToken = signAccessToken(user);

    return res.json({
      user,
      accessToken,
    });
  } catch (err) {
    console.error('Error in login:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// POST /auth/verify-register-otp
export async function verifyRegisterOtp(req, res) {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ message: 'userId và otp là bắt buộc' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const otpQuery = `
        SELECT *
        FROM ${OTP_TABLE}
        WHERE user_id = $1
          AND otp_code = $2
          AND type = 'register'
          AND used = false
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1;
      `;

      const { rows: otpRows } = await client.query(otpQuery, [userId, otp]);
      const otpRow = otpRows[0];

      if (!otpRow) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'OTP không hợp lệ hoặc đã hết hạn' });
      }

      const updateUserQuery = `
        UPDATE ${USER_TABLE}
        SET status = 'active', updated_at = NOW()
        WHERE user_id = $1
        RETURNING *;
      `;

      const { rows: userRows } = await client.query(updateUserQuery, [userId]);
      const userRow = userRows[0];

      if (!userRow) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'User không tồn tại' });
      }

      const markUsedQuery = `
        UPDATE ${OTP_TABLE}
        SET used = true
        WHERE id = $1;
      `;
      await client.query(markUsedQuery, [otpRow.id]);

      await client.query('COMMIT');

      const user = mapUserRow(userRow);
      delete user.passwordHash;
      const accessToken = signAccessToken(user);

      return res.json({
        message: 'Kích hoạt tài khoản thành công',
        user,
        accessToken,
      });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error in verifyRegisterOtp:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// POST /auth/forgot-password
export async function forgotPassword(req, res) {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ message: 'Email hoặc phone là bắt buộc' });
    }

    const userQuery = `
      SELECT *
      FROM ${USER_TABLE}
      WHERE ($1::varchar IS NOT NULL AND email = $1)
         OR ($2::varchar IS NOT NULL AND phone = $2)
      LIMIT 1;
    `;

    const { rows } = await pool.query(userQuery, [email || null, phone || null]);
    const userRow = rows[0];

    if (!userRow) {
      // Không tiết lộ user tồn tại hay không
      return res.json({ message: 'Nếu tài khoản tồn tại, OTP sẽ được gửi' });
    }

    const otp = generateOtp(6);
    const expiresMinutes = 10;

    const insertOtpQuery = `
      INSERT INTO ${OTP_TABLE} (
        user_id,
        otp_code,
        type,
        expires_at,
        used
      )
      VALUES ($1, $2, 'forgot_password', NOW() + INTERVAL '${expiresMinutes} minutes', false);
    `;

    await pool.query(insertOtpQuery, [userRow.user_id, otp]);

    // Gửi email OTP nếu có email
    if (userRow.email) {
      try {
        await sendForgotPasswordEmail({
          to: userRow.email,
          fullName: userRow.full_name,
          otp,
        });
      } catch (mailErr) {
        console.error('Error sending forgot-password email:', mailErr);
      }
    }

    // Trong dev có thể trả kèm OTP để test, production nên bỏ đi
    return res.json({
      message: 'Nếu tài khoản tồn tại, OTP sẽ được gửi',
      otp,
    });
  } catch (err) {
    console.error('Error in forgotPassword:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// POST /auth/reset-password
export async function resetPassword(req, res) {
  try {
    const { userId, otp, newPassword } = req.body;

    if (!userId || !otp || !newPassword) {
      return res.status(400).json({ message: 'userId, otp và newPassword là bắt buộc' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const otpQuery = `
        SELECT *
        FROM ${OTP_TABLE}
        WHERE user_id = $1
          AND otp_code = $2
          AND type = 'forgot_password'
          AND used = false
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1;
      `;

      const { rows: otpRows } = await client.query(otpQuery, [userId, otp]);
      const otpRow = otpRows[0];

      if (!otpRow) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'OTP không hợp lệ hoặc đã hết hạn' });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);

      const updateUserQuery = `
        UPDATE ${USER_TABLE}
        SET password_hash = $1, updated_at = NOW()
        WHERE user_id = $2
        RETURNING *;
      `;

      const { rows: userRows } = await client.query(updateUserQuery, [passwordHash, userId]);
      const userRow = userRows[0];

      if (!userRow) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'User không tồn tại' });
      }

      const markUsedQuery = `
        UPDATE ${OTP_TABLE}
        SET used = true
        WHERE id = $1;
      `;
      await client.query(markUsedQuery, [otpRow.id]);

      await client.query('COMMIT');

      const user = mapUserRow(userRow);
      delete user.passwordHash;

      return res.json({ message: 'Đổi mật khẩu thành công', user });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error in resetPassword:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export default {
  register,
  login,
  verifyRegisterOtp,
  forgotPassword,
  resetPassword,
};

