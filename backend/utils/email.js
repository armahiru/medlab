/**
 * Optional email delivery via SMTP.
 * If SMTP is not configured, emails are skipped (in-app notifications still work).
 */
const nodemailer = require('nodemailer');

function isEmailConfigured() {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

function getTransporter() {
  if (!isEmailConfigured()) return null;

  const port = Number(process.env.SMTP_PORT || 465);
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? String(process.env.SMTP_SECURE) === 'true'
      : port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    requireTLS: !secure && port === 587,
    // Prefer IPv4 — many campus/home networks cannot reach Gmail over IPv6
    family: 4,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
}

/**
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
async function sendEmail({ to, subject, text, html }) {
  if (!to) {
    return { sent: false, reason: 'No recipient email' };
  }

  if (!isEmailConfigured()) {
    console.log(`[MediChain Email] Skipped (SMTP not configured): → ${to} | ${subject}`);
    return { sent: false, reason: 'SMTP not configured' };
  }

  try {
    const transporter = getTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    await transporter.sendMail({
      from: `"MediChain Hospital" <${from}>`,
      to,
      subject,
      text,
      html: html || `<p>${text}</p>`,
    });

    console.log(`[MediChain Email] Sent → ${to} | ${subject}`);
    return { sent: true };
  } catch (err) {
    console.error('[MediChain Email] Failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = {
  isEmailConfigured,
  sendEmail,
};
