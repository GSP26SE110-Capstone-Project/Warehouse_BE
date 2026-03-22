import transporter from '../config/mail.js';

export async function sendVerificationEmail({ to, fullName, otp }) {
  if (!to) return;

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Xác thực tài khoản - Smart Warehouse',
    text: `Xin chào ${fullName || ''},\n\nMã OTP xác thực tài khoản của bạn là: ${otp}\nMã sẽ hết hạn sau 10 phút.\n\nTrân trọng,\nSmart Warehouse`,
    html: `
      <p>Xin chào <strong>${fullName || ''}</strong>,</p>
      <p>Mã OTP xác thực tài khoản của bạn là:</p>
      <h2 style="letter-spacing: 4px;">${otp}</h2>
      <p>Mã sẽ hết hạn sau <strong>10 phút</strong>.</p>
      <p>Trân trọng,<br/>Smart Warehouse</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

export async function sendForgotPasswordEmail({ to, fullName, otp }) {
  if (!to) return;

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'OTP đặt lại mật khẩu - Smart Warehouse',
    text: `Xin chào ${fullName || ''},\n\nMã OTP để đặt lại mật khẩu của bạn là: ${otp}\nMã sẽ hết hạn sau 10 phút.\n\nTrân trọng,\nSmart Warehouse`,
    html: `
      <p>Xin chào <strong>${fullName || ''}</strong>,</p>
      <p>Mã OTP để đặt lại mật khẩu của bạn là:</p>
      <h2 style="letter-spacing: 4px;">${otp}</h2>
      <p>Mã sẽ hết hạn sau <strong>10 phút</strong>.</p>
      <p>Trân trọng,<br/>Smart Warehouse</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

export default {
  sendVerificationEmail,
  sendForgotPasswordEmail,
};

