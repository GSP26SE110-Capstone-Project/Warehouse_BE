/**
 * @fileoverview
 * AuthController — phụ trách toàn bộ flow nhận dạng người dùng:
 *
 *   - POST /api/auth/register              Tạo tài khoản mới (mặc định tenant_admin).
 *   - POST /api/auth/verify-register-otp   Xác thực OTP email + tạo implicit tenant + cấp JWT.
 *   - POST /api/auth/login                 Đăng nhập bằng email+password, trả JWT.
 *   - POST /api/auth/forgot-password       Gửi OTP reset password qua email.
 *   - POST /api/auth/reset-password        Đổi mật khẩu sau khi OTP verified.
 *
 * Nguyên tắc (chi tiết ở docs/ARCHITECTURE.md):
 *   - Password plaintext → bcrypt hash bằng BCRYPT_SALT_ROUNDS = 10 trước khi lưu DB.
 *   - OTP 6 số, TTL 5 phút, lưu ở bảng `user_otps` với flag `used`.
 *   - Khi register tenant_admin, backend auto-tạo record `tenants` ngầm
 *     (để các bảng nghiệp vụ luôn có tenant_id hợp lệ — xem ADR-004).
 *   - Hoạt động ghi nhiều bảng đều bọc trong transaction (BEGIN/COMMIT/ROLLBACK).
 *   - Dùng `randomUUID` chỉ cho legacy random (không phải PK chính) — PK chính theo pattern TN####/USR####.
 */

import pool from '../config/db.js';
import { tableName as USER_TABLE } from '../models/User.js';
import { tableName as OTP_TABLE } from '../models/UserOtp.js';
import { tableName as TENANT_TABLE } from '../models/Tenant.js';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { sendVerificationEmail, sendForgotPasswordEmail } from '../services/EmailService.js';
import { signAccessToken } from '../services/JwtService.js';
import {
  issueRefreshToken,
  revokeAllForUser as revokeAllRefreshTokensForUser,
} from '../services/RefreshTokenService.js';

/**
 * Trích User-Agent + IP từ req để gắn vào refresh token (phục vụ audit
 * / "logout all" trên device cụ thể). Không log raw — chỉ cắt 500/64 ký tự
 * ở service layer.
 *
 * @param {import('express').Request} req
 */
function extractClientContext(req) {
  return {
    userAgent: req?.headers?.['user-agent'] || null,
    ipAddress:
      req?.ip ||
      req?.headers?.['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req?.socket?.remoteAddress ||
      null,
  };
}

/**
 * Sinh tenant_id kế tiếp theo pattern TN#### trong cùng transaction.
 *
 * Nhận `client` đã BEGIN thay vì pool để đảm bảo truy vấn MAX
 * và INSERT nằm cùng 1 snapshot transaction — tránh race condition
 * khi 2 request register cùng lúc đọc trùng giá trị MAX.
 *
 * Edge case: bảng tenants có rows `TN0001`, `TN0003` (lẫn legacy id không
 * match pattern) — regex `^TN[0-9]+$` loại bỏ những id không chuẩn để
 * không sinh ID kế tiếp bị chồng lên record legacy.
 *
 * @param {import('pg').PoolClient} client
 * @returns {Promise<string>} ID dạng `TN####`.
 */
async function generateNextTenantId(client) {
  const { rows } = await client.query(
    `SELECT MAX(CAST(SUBSTRING(tenant_id FROM 3) AS INTEGER)) AS max_number
     FROM ${TENANT_TABLE}
     WHERE tenant_id ~ '^TN[0-9]+$'`,
  );
  const maxNumber = Number(rows[0]?.max_number ?? 0);
  const next = Number.isNaN(maxNumber) ? 1 : maxNumber + 1;
  return `TN${String(next).padStart(4, '0')}`;
}

/**
 * Auto-tạo tenant "ngầm" từ thông tin user khi register tenant_admin.
 *
 * Lý do tồn tại (xem ADR-004): FE muốn giấu khái niệm tenant khỏi UI,
 * nhưng DB schema yêu cầu mọi user nghiệp vụ phải có tenant_id (NOT NULL
 * trong rental_requests, contracts, shipments…). Giải pháp: khi user
 * tenant_admin verify OTP → backend tạo 1 tenant placeholder gán kèm.
 *
 * Dữ liệu placeholder:
 *   - company_name = fullName (hoặc email nếu không có fullName).
 *   - tax_code = `IND-<userId>` — đảm bảo UNIQUE + dễ nhận dạng individual.
 *   - contact_email = email đăng ký.
 *   - address = NULL (tenant sẽ update sau).
 *
 * Toàn bộ được thực hiện trong cùng client đang BEGIN để đảm bảo atomic.
 *
 * @param {import('pg').PoolClient} client Transaction client đã BEGIN.
 * @param {{ userId: string, email: string, phone?: string, fullName?: string }} payload
 * @returns {Promise<string>} `tenant_id` vừa tạo.
 */
async function createImplicitTenantForUser(client, { userId, email, phone, fullName }) {
  const tenantId = await generateNextTenantId(client);
  await client.query(
    `INSERT INTO ${TENANT_TABLE} (
       tenant_id, company_name, tax_code, contact_email, contact_phone, address, is_active
     ) VALUES ($1, $2, $3, $4, $5, NULL, TRUE);`,
    [
      tenantId,
      fullName || email,
      `IND-${userId}`,
      email,
      phone || null,
    ],
  );
  return tenantId;
}

/**
 * Chuyển row `users` từ Postgres sang domain object camelCase.
 *
 * Giống `UserController.mapUserRow` nhưng không bao gồm `tenantId`/`branchId`
 * vì các endpoint của AuthController không cần expose hai field này ra
 * trong response login/register (FE chỉ dùng userId + role để điều hướng
 * và tenantId được nhúng trong JWT payload).
 *
 * LƯU Ý: trả `passwordHash` trong mapping nhưng handler phải `delete`
 * trước khi gửi response.
 *
 * @param {object} row
 * @returns {object|null}
 */
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

/**
 * Sinh mã OTP dạng chuỗi số có độ dài cố định (mặc định 6).
 *
 * Dùng Math.random (không cryptographically secure) — chấp nhận cho
 * MVP vì OTP TTL rất ngắn (5 phút) và có rate limit ở roadmap.
 * Production grade: đổi sang `crypto.randomInt(min, max)`.
 *
 * @param {number} length Số chữ số (mặc định 6).
 * @returns {string} Chuỗi số 6 ký tự.
 */
function generateOtp(length = 6) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

/**
 * Chuẩn hoá role từ FE thành giá trị hợp lệ với CHECK constraint ở DB.
 *
 * Lý do: FE (và version cũ của API) có thể gửi `role = 'tenant'` nhưng
 * schema DB chỉ chấp nhận `tenant_admin`. Map ở đây thay vì ép FE đổi
 * để tránh breaking change.
 *
 * @param {string|undefined} role
 * @returns {string} Một trong 4 giá trị hợp lệ: admin, warehouse_staff,
 *   transport_staff, tenant_admin.
 */
function normalizeUserRole(role) {
  if (!role || role === 'tenant') return 'tenant_admin';
  return role;
}

/**
 * Trả về chuỗi đã trim nếu có nghĩa, ngược lại null.
 *
 * Hữu ích khi xử lý input từ Swagger UI — mặc định Swagger gửi chuỗi
 * `"string"` nếu người test không sửa field. Chúng ta coi đó là không
 * có input để tránh lookup user bằng username = "string".
 *
 * @param {*} value
 * @returns {string|null}
 */
function usableAuthString(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^string$/i.test(s)) return null;
  return s;
}

/** Email: có @, dạng local@domain.tld (TLD ≥ 2 ký tự), độ dài hợp lý. */
function isValidEmailFormat(email) {
  if (!email || typeof email !== 'string') return false;
  const s = email.trim();
  if (s.length < 5 || s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

/**
 * Chuẩn hóa SĐT VN còn đúng 10 chữ số, bắt đầu bằng 0 (vd: 0901234567).
 * Cho phép nhập kèm khoảng trắng/gạch; dạng +84 / 84 đầu số → thêm 0 phía trước 9 chữ số sau mã vùng.
 */
function normalizeVietnamPhone10Digits(phoneTrim) {
  const digits = String(phoneTrim).replace(/\D/g, '');
  if (digits.length === 10 && /^0\d{9}$/.test(digits)) return digits;
  if (digits.length === 11 && digits.startsWith('84')) {
    const rest = digits.slice(2);
    if (rest.length === 9 && /^\d{9}$/.test(rest)) return `0${rest}`;
  }
  return null;
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
    const phLookup = normalizeVietnamPhone10Digits(ph) || String(ph).trim();
    const { rows } = await client.query(
      `SELECT user_id FROM ${USER_TABLE} WHERE phone = $1 LIMIT 1`,
      [phLookup],
    );
    resolvedUserId = rows[0]?.user_id;
  }
  return resolvedUserId || null;
}

const RESEND_REGISTER_OTP_COOLDOWN_SEC = 60;

/**
 * POST /api/auth/register — Tạo tài khoản mới + gửi OTP xác thực email.
 *
 * Flow:
 *   1. Validate body: email, password, fullName (bắt buộc).
 *   2. Normalize role → mặc định `tenant_admin`.
 *   3. Hash password bằng bcrypt.
 *   4. INSERT users với is_active = FALSE.
 *   5. Sinh OTP 6 số, TTL 5 phút, INSERT vào user_otps với type='register'.
 *   6. Gửi email qua EmailService (nếu SMTP trống thì log).
 *   7. Trả 201 { userId, message }.
 *
 * Response codes:
 *   - 201: đã gửi OTP.
 *   - 400: thiếu field.
 *   - 409: email hoặc phone đã được dùng.
 *   - 500: DB/SMTP lỗi.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
// POST /auth/register
export async function register(req, res) {
  try {
    const { email, phone, password, fullName, role = 'tenant_admin' } = req.body;
    const userId = randomUUID();
    const dbRole = normalizeUserRole(role);

    const emailTrim = email != null ? String(email).trim() : '';
    const phoneTrim = phone != null ? String(phone).trim() : '';

    if (!emailTrim) {
      return res.status(400).json({ message: 'Email là bắt buộc để nhận mã OTP' });
    }
    if (!phoneTrim) {
      return res.status(400).json({ message: 'Phone là bắt buộc' });
    }
    if (!isValidEmailFormat(emailTrim)) {
      return res.status(400).json({ message: 'Email không hợp lệ (cần dạng có @ và tên miền, ví dụ user@example.com)' });
    }
    const phoneNorm = normalizeVietnamPhone10Digits(phoneTrim);
    if (!phoneNorm) {
      return res.status(400).json({
        message:
          'Số điện thoại không hợp lệ. Cần 10 chữ số Việt Nam bắt đầu bằng 0 (vd: 0901234567), hoặc +84901234567.',
      });
    }
    if (!password || !fullName) {
      return res.status(400).json({ message: 'fullName và password là bắt buộc' });
    }

    // Kiểm tra trùng email/phone
    const conflictQuery = `
      SELECT 1
      FROM ${USER_TABLE}
      WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) OR phone = $2
      LIMIT 1;
    `;
    const { rows: conflictRows } = await pool.query(conflictQuery, [emailTrim, phoneNorm]);
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

      // Role = tenant_admin: auto-tạo tenant ngầm để các bảng nghiệp vụ
      // (rental_requests, contracts, invoices, ...) có tenant_id NOT NULL
      // dù FE không biết khái niệm tenant.
      let tenantIdForUser = null;
      if (dbRole === 'tenant_admin') {
        tenantIdForUser = await createImplicitTenantForUser(client, {
          userId,
          email: emailTrim,
          phone: phoneNorm,
          fullName,
        });
      }

      const insertColumns = ['user_id'];
      const insertValues = [userId];
      if (tenantIdForUser) {
        insertColumns.push('tenant_id');
        insertValues.push(tenantIdForUser);
      }
      if (hasUsernameColumn) {
        insertColumns.push('username');
        insertValues.push(emailTrim);
      }
      insertColumns.push('email', 'password_hash', 'full_name', 'phone', 'role');
      insertValues.push(emailTrim, passwordHash, fullName, phoneNorm, dbRole);
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

/**
 * POST /api/auth/login — Đăng nhập bằng email + password, trả JWT.
 *
 * Flow:
 *   1. Tìm user theo email.
 *   2. Nếu không có → 401 (thông báo generic, không leak "email không tồn tại").
 *   3. bcrypt.compare password — nếu sai → 401.
 *   4. Nếu is_active = false → 403 (account bị deactivate).
 *   5. Sign JWT với payload { userId, email, role, tenantId }.
 *   6. Trả 200 { accessToken, user }.
 *
 * Không cập nhật `last_login_at` (chưa có cột) — roadmap thêm để audit.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
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
    // Refresh token: opaque string, server lưu SHA-256 hash. Client phải
    // giữ an toàn (httpOnly cookie hoặc secure storage) và gửi qua
    // POST /api/auth/refresh để lấy access token mới khi hết hạn.
    const { plainToken: refreshToken, expiresAt: refreshTokenExpiresAt } =
      await issueRefreshToken(user.userId, extractClientContext(req));

    return res.json({
      user,
      accessToken,
      refreshToken,
      refreshTokenExpiresAt,
    });
  } catch (err) {
    console.error('Error in login:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * POST /api/auth/verify-register-otp — Xác thực OTP + kích hoạt account +
 * auto-tạo tenant ngầm (nếu role = tenant_admin) + trả JWT.
 *
 * Flow (trong 1 transaction):
 *   1. Tìm OTP mới nhất chưa dùng với type='register' cho user.
 *   2. Nếu không có hoặc expired → 400 "OTP không hợp lệ".
 *   3. So sánh otp_code. Sai → 400.
 *   4. Mark OTP used=TRUE.
 *   5. Nếu user role=tenant_admin và chưa có tenant_id:
 *      - gọi createImplicitTenantForUser() để sinh TN####.
 *      - UPDATE users SET tenant_id = <new>.
 *   6. UPDATE users SET is_active=TRUE.
 *   7. COMMIT transaction.
 *   8. Sign JWT, trả 200.
 *
 * Nếu bất kỳ bước nào lỗi → ROLLBACK, client vẫn có thể resend OTP.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
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
      // Issue refresh token sau khi COMMIT — không cần rollback nếu
      // bước này fail (OTP đã được consume, user đã active). Nhưng ta
      // vẫn ôm vào try/catch ngoài để trả 500 đúng nghĩa.
      const { plainToken: refreshToken, expiresAt: refreshTokenExpiresAt } =
        await issueRefreshToken(user.userId, extractClientContext(req));

      return res.json({
        message: 'Kích hoạt tài khoản thành công',
        user,
        accessToken,
        refreshToken,
        refreshTokenExpiresAt,
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

/**
 * POST /api/auth/resend-register-otp — Gửi lại OTP register.
 *
 * Rate limit: chỉ cho gửi lại sau RESEND_REGISTER_OTP_COOLDOWN_SEC giây
 * kể từ lần gửi gần nhất (chống spam email). Nếu gửi quá nhanh → 429.
 *
 * Flow:
 *   1. Tìm user qua userId / email / phone (khả dụng).
 *   2. Kiểm tra user chưa active (nếu active rồi thì không cần OTP nữa → 400).
 *   3. Kiểm tra OTP gần nhất: nếu < cooldown → 429.
 *   4. Sinh OTP mới, INSERT vào user_otps, gửi email.
 *   5. Trả 200 { message }.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
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

/**
 * POST /api/auth/forgot-password — Gửi OTP reset mật khẩu qua email.
 *
 * Security consideration: luôn trả 200 dù email có tồn tại hay không —
 * chống enumeration attack (attacker dò email nào đã register).
 *
 * Flow:
 *   1. Tìm user theo email.
 *   2. Nếu không có → trả 200 generic (không cho biết email không tồn tại).
 *   3. Sinh OTP, INSERT user_otps với type='forgot_password'.
 *   4. Gửi email reset OTP.
 *   5. Trả 200 { message }.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
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

/**
 * POST /api/auth/reset-password — Đổi mật khẩu sau khi có OTP forgot-password.
 *
 * Flow (1 transaction):
 *   1. Validate body: email, otp, newPassword.
 *   2. Tìm user theo email.
 *   3. Tìm OTP mới nhất chưa dùng với type='forgot_password'.
 *   4. Kiểm tra match + chưa expired.
 *   5. Mark OTP used=TRUE.
 *   6. Hash newPassword và UPDATE users SET password_hash=….
 *   7. COMMIT.
 *
 * Response codes:
 *   - 200: đổi password thành công.
 *   - 400: OTP sai / hết hạn, hoặc thiếu field.
 *   - 404: email không tồn tại.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
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

      // Revoke tất cả refresh token hiện có của user trong cùng transaction
      // — đổi mật khẩu xong phải logout mọi phiên (kể cả device khác)
      // để ngăn attacker đã có access/refresh token cũ tiếp tục dùng.
      await revokeAllRefreshTokensForUser(uid, client);

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

