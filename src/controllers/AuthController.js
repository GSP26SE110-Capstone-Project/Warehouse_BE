import pool from '../config/db.js';
import { tableName as USER_TABLE } from '../models/User.js';
import { tableName as OTP_TABLE } from '../models/UserOtp.js';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { sendVerificationEmail, sendForgotPasswordEmail } from '../services/EmailService.js';
import { signAccessToken } from '../services/JwtService.js';

// Map DB row -> domain object
function mapUserRow(row) {
  if (!row) return null;
  const derivedStatus = row.status ?? (row.is_active === true ? 'active' : 'inactive');
  return {
    userId: row.user_id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role,
    status: derivedStatus,
    isActive: row.is_active ?? derivedStatus === 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function generateOtp(length = 6) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

/** Map FE / legacy role sang giá trị hợp lệ với CHECK constraint trong init-scripts (vd: tenant_admin). */
function normalizeUserRole(role) {
  if (!role || role === 'tenant') return 'tenant_admin';
  return role;
}

/** Bỏ qua rỗng hoặc placeholder mặc định của Swagger ("string") để lookup userId/email/phone đúng. */
function usableAuthString(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^string$/i.test(s)) return null;
  return s;
}

async function resolveUserIdFromAuthIdentifiers(client, uid, em, ph) {
  let resolvedUserId = uid;
  if (!resolvedUserId && em) {
    const { rows } = await client.query(
      `SELECT user_id FROM ${USER_TABLE} WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) LIMIT 1`,
      [em],
    );
    resolvedUserId = rows[0]?.user_id;
  }
  if (!resolvedUserId && ph) {
    const { rows } = await client.query(
      `SELECT user_id FROM ${USER_TABLE} WHERE phone = $1 LIMIT 1`,
      [ph],
    );
    resolvedUserId = rows[0]?.user_id;
  }
  return resolvedUserId || null;
}

const RESEND_REGISTER_OTP_COOLDOWN_SEC = 60;

// POST /auth/register
export async function register(req, res) {
  try {
    const { email, phone, password, fullName, role = 'tenant_admin' } = req.body;
    const userId = randomUUID();
    const dbRole = normalizeUserRole(role);

    if (!email) {
      return res.status(400).json({ message: 'Email là bắt buộc để nhận mã OTP' });
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

      const { rows: statusColumnRows } = await client.query(
        `
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = $1
            AND column_name = 'status'
          LIMIT 1;
        `,
        [USER_TABLE],
      );
      const { rows: isActiveColumnRows } = await client.query(
        `
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = $1
            AND column_name = 'is_active'
          LIMIT 1;
        `,
        [USER_TABLE],
      );

      const hasStatusColumn = statusColumnRows.length > 0;
      const hasIsActiveColumn = isActiveColumnRows.length > 0;

      const { rows: usernameColumnRows } = await client.query(
        `
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = $1
            AND column_name = 'username'
          LIMIT 1;
        `,
        [USER_TABLE],
      );
      const hasUsernameColumn = usernameColumnRows.length > 0;

      const insertColumns = ['user_id'];
      const insertValues = [userId];
      if (hasUsernameColumn) {
        insertColumns.push('username');
        insertValues.push(email);
      }
      insertColumns.push('email', 'password_hash', 'full_name', 'phone', 'role');
      insertValues.push(email, passwordHash, fullName, phone || null, dbRole);
      if (hasStatusColumn) {
        insertColumns.push('status');
        insertValues.push('inactive');
      }
      if (hasIsActiveColumn) {
        insertColumns.push('is_active');
        insertValues.push(false);
      }

      const placeholders = insertValues.map((_, idx) => `$${idx + 1}`).join(', ');
      const insertUserQuery = `
        INSERT INTO ${USER_TABLE} (${insertColumns.join(', ')})
        VALUES (${placeholders})
        RETURNING *;
      `;

      const { rows: userRows } = await client.query(insertUserQuery, insertValues);
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

      // Gửi email OTP xác thực
      try {
        await sendVerificationEmail({
          to: user.email,
          fullName: user.fullName,
          otp,
        });
      } catch (mailErr) {
        console.error('Error sending verification email:', mailErr);
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

    const isUserActive = row.status ? row.status === 'active' : row.is_active === true;
    if (!isUserActive) {
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
    const { userId, email, phone, otp } = req.body;

    if (otp == null || String(otp).trim() === '') {
      return res.status(400).json({ message: 'otp là bắt buộc' });
    }
    const otpNorm = String(otp).replace(/\s+/g, '').trim();

    const uid = usableAuthString(userId);
    const em = usableAuthString(email);
    const ph = usableAuthString(phone);
    if (!uid && !em && !ph) {
      return res.status(400).json({ message: 'Cần một trong: userId, email hoặc phone (kèm otp)' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const resolvedUserId = await resolveUserIdFromAuthIdentifiers(client, uid, em, ph);
      if (!resolvedUserId) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Không tìm thấy tài khoản với thông tin đã gửi' });
      }

      const otpQuery = `
        SELECT *
        FROM ${OTP_TABLE}
        WHERE user_id = $1
          AND TRIM(otp_code::text) = $2
          AND type = 'register'
          AND used = false
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1;
      `;

      const { rows: otpRows } = await client.query(otpQuery, [resolvedUserId, otpNorm]);
      const otpRow = otpRows[0];

      if (!otpRow) {
        const { rows: hintRows } = await client.query(
          `
            SELECT used, expires_at > NOW() AS not_expired
            FROM ${OTP_TABLE}
            WHERE user_id = $1
              AND TRIM(otp_code::text) = $2
              AND type = 'register'
            ORDER BY created_at DESC
            LIMIT 1;
          `,
          [resolvedUserId, otpNorm],
        );
        const hint = hintRows[0];
        await client.query('ROLLBACK');
        if (!hint) {
          return res.status(400).json({
            message:
              'Mã OTP không khớp. Hãy dùng mã trong email mới nhất (mỗi lần đăng ký lại sẽ tạo mã mới và vô hiệu mã cũ).',
          });
        }
        if (hint.used) {
          return res.status(400).json({
            message: 'OTP đã được sử dụng. Nếu tài khoản đã kích hoạt, hãy đăng nhập.',
          });
        }
        if (!hint.not_expired) {
          return res.status(400).json({
            message:
              'OTP đã hết hạn. Gọi POST /api/auth/resend-register-otp (email) để nhận mã mới, hoặc đăng ký lại.',
          });
        }
        return res.status(400).json({ message: 'OTP không hợp lệ hoặc đã hết hạn' });
      }

      const { rows: statusColumnRows } = await client.query(
        `
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = $1
            AND column_name = 'status'
          LIMIT 1;
        `,
        [USER_TABLE],
      );
      const { rows: isActiveColumnRows } = await client.query(
        `
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = $1
            AND column_name = 'is_active'
          LIMIT 1;
        `,
        [USER_TABLE],
      );
      const hasStatusColumn = statusColumnRows.length > 0;
      const hasIsActiveColumn = isActiveColumnRows.length > 0;

      const updateFields = ['updated_at = NOW()'];
      if (hasStatusColumn) {
        updateFields.push(`status = 'active'`);
      }
      if (hasIsActiveColumn) {
        updateFields.push('is_active = true');
      }

      const updateUserQuery = `
        UPDATE ${USER_TABLE}
        SET ${updateFields.join(', ')}
        WHERE user_id = $1
        RETURNING *;
      `;

      const { rows: userRows } = await client.query(updateUserQuery, [resolvedUserId]);
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

// POST /auth/resend-register-otp
export async function resendRegisterOtp(req, res) {
  try {
    const { userId, email, phone } = req.body;
    const uid = usableAuthString(userId);
    const em = usableAuthString(email);
    const ph = usableAuthString(phone);
    if (!uid && !em && !ph) {
      return res.status(400).json({ message: 'Cần một trong: userId, email hoặc phone' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const resolvedUserId = await resolveUserIdFromAuthIdentifiers(client, uid, em, ph);
      if (!resolvedUserId) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Không tìm thấy tài khoản với thông tin đã gửi' });
      }

      const { rows: userRows } = await client.query(
        `SELECT * FROM ${USER_TABLE} WHERE user_id = $1 LIMIT 1`,
        [resolvedUserId],
      );
      const userRow = userRows[0];
      if (!userRow) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Không tìm thấy tài khoản với thông tin đã gửi' });
      }

      const isUserActive = userRow.status ? userRow.status === 'active' : userRow.is_active === true;
      if (isUserActive) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: 'Tài khoản đã được kích hoạt, không cần gửi lại OTP đăng ký.',
        });
      }
      if (userRow.status === 'suspended') {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Không thể gửi OTP cho tài khoản đang bị tạm khóa.' });
      }

      if (!userRow.email || !String(userRow.email).trim()) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Tài khoản chưa có email, không thể gửi OTP đăng ký.' });
      }

      const { rows: coolRows } = await client.query(
        `
          SELECT 1
          FROM ${OTP_TABLE}
          WHERE user_id = $1
            AND type = 'register'
            AND created_at > NOW() - INTERVAL '${RESEND_REGISTER_OTP_COOLDOWN_SEC} seconds'
          LIMIT 1;
        `,
        [resolvedUserId],
      );
      if (coolRows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(429).json({
          message: `Vui lòng đợi ${RESEND_REGISTER_OTP_COOLDOWN_SEC} giây trước khi yêu cầu gửi lại OTP.`,
        });
      }

      await client.query(
        `
          UPDATE ${OTP_TABLE}
          SET used = true
          WHERE user_id = $1 AND type = 'register' AND used = false;
        `,
        [resolvedUserId],
      );

      const otp = generateOtp(6);
      const expiresMinutes = 10;

      await client.query(
        `
          INSERT INTO ${OTP_TABLE} (
            user_id,
            otp_code,
            type,
            expires_at,
            used
          )
          VALUES ($1, $2, 'register', NOW() + INTERVAL '${expiresMinutes} minutes', false);
        `,
        [resolvedUserId, otp],
      );

      await client.query('COMMIT');

      try {
        await sendVerificationEmail({
          to: userRow.email,
          fullName: userRow.full_name,
          otp,
        });
      } catch (mailErr) {
        console.error('Error sending verification email (resend):', mailErr);
      }

      return res.json({
        message: 'Đã tạo và gửi mã OTP đăng ký mới (kiểm tra email; môi trường dev có thể dùng trường otp trong response).',
        otp,
      });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error in resendRegisterOtp:', err);
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

    const uid = usableAuthString(userId);
    if (!uid || !otp || !newPassword) {
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

      const { rows: otpRows } = await client.query(otpQuery, [uid, otp]);
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

      const { rows: userRows } = await client.query(updateUserQuery, [passwordHash, uid]);
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
  resendRegisterOtp,
  forgotPassword,
  resetPassword,
};

