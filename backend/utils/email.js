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

  const host = String(process.env.SMTP_HOST || '').trim();
  const isGmail = /gmail\.com$/i.test(host) || host === 'smtp.gmail.com';

  // Gmail on this network: port 587/IPv6 often fails with ENETUNREACH.
  // Always force 465 + IPv4 for Gmail regardless of stale env in a long-running process.
  let port = Number(process.env.SMTP_PORT || 465);
  let secure =
    process.env.SMTP_SECURE !== undefined
      ? String(process.env.SMTP_SECURE) === 'true'
      : port === 465;

  if (isGmail) {
    port = 465;
    secure = true;
  }

  console.log(`[MediChain Email] SMTP transport → ${host}:${port} (secure=${secure}, ipv4)`);

  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure && port === 587,
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
