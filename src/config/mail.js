import nodemailer from 'nodemailer';

/** Gmail App Password thường dán kèm khoảng trắng — SMTP cần chuỗi liền 16 ký tự. */
function normalizeSmtpPassword(raw) {
  if (raw == null || raw === '') return undefined;
  return String(raw).replace(/\s+/g, '').trim();
}

const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
const smtpPass = normalizeSmtpPassword(
  process.env.SMTP_PASS || process.env.EMAIL_APP_PASSWORD || process.env.EMAIL_PASSWORD,
);

const smtpHost =
  process.env.SMTP_HOST ||
  (String(process.env.EMAIL_SERVICE || '').toLowerCase() === 'gmail' ? 'smtp.gmail.com' : undefined);

const transporter = nodemailer.createTransport({
  host: smtpHost || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  ...(smtpUser && smtpPass ? { auth: { user: smtpUser, pass: smtpPass } } : {}),
});

export default transporter;
