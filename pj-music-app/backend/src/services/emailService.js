/**
 * Email Service
 * Sends password reset emails via Nodemailer.
 * Uses SMTP credentials from environment variables.
 */

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Create transporter (lazy — only connects when used)
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_PORT === '465', // true for 465 (SSL), false for 587 (TLS)
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });
};

/**
 * Send a password reset email.
 * The reset link uses a raw (unhashed) token — the backend hashes before DB lookup.
 * @param {string} toEmail
 * @param {string} rawToken
 */
const sendPasswordResetEmail = async (toEmail, rawToken) => {
  const transporter = createTransporter();

  // In a real app, this would be your app's deep link / frontend URL
  const resetUrl = `pjmusicapp://reset-password/${rawToken}`;

  const mailOptions = {
    from: `"PJ Music App" <${process.env.EMAIL_FROM}>`,
    to: toEmail,
    subject: 'Password Reset — PJ Music App',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #1a1a2e; color: #e0e0e0; border-radius: 12px;">
        <h1 style="color: #a855f7; margin-bottom: 8px;">PJ Music App</h1>
        <h2 style="color: #fff; font-size: 18px;">Reset Your Password</h2>
        <p>You requested a password reset. Use the button below to set a new password.</p>
        <p>This link is valid for <strong>10 minutes</strong>.</p>
        <a href="${resetUrl}"
          style="display: inline-block; margin: 24px 0; padding: 12px 28px; background: #a855f7; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Reset Password
        </a>
        <p style="font-size: 12px; color: #888;">If you didn't request this, ignore this email. Your password will not change.</p>
        <p style="font-size: 12px; color: #888;">Token expires at: ${new Date(Date.now() + 10 * 60 * 1000).toUTCString()}</p>
      </div>
    `,
    text: `Reset your PJ Music App password:\n\n${resetUrl}\n\nThis link expires in 10 minutes.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Password reset email sent to: ${toEmail}`);
  } catch (error) {
    logger.error(`Email send failed for ${toEmail}: ${error.message}`);
    throw error;
  }
};

module.exports = { sendPasswordResetEmail };
