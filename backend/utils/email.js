/**
 * Optional email delivery via SMTP.
 * If SMTP is not configured, emails are skipped (in-app notifications still work).
 *
 * Gmail notes:
 * - Many local/campus networks break IPv6 → force IPv4 locally
 * - Render sets RENDER=true; there we leave DNS family alone (IPv4-only can hang)
 * - Prefer 465/SSL; fall back to 587/STARTTLS if connect times out
 */
const nodemailer = require('nodemailer');

function isEmailConfigured() {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

function isGmailHost(host) {
  const h = String(host || '').toLowerCase();
  return h === 'smtp.gmail.com' || h.endsWith('.gmail.com');
}

function buildTransportOptions({ port, secure }) {
  const host = String(process.env.SMTP_HOST || '').trim();
  const onRender = String(process.env.RENDER || '').toLowerCase() === 'true';

  const opts = {
    host,
    port,
    secure,
    requireTLS: !secure && port === 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 30000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 30000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 45000),
  };

  // Local/campus fix only — forcing IPv4 on Render can cause Connection timeout
  if (!onRender) {
    opts.family = 4;
  }

  return opts;
}

function getTransportAttempts() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const configuredPort = Number(process.env.SMTP_PORT || 465);
  const configuredSecure =
    process.env.SMTP_SECURE !== undefined
      ? String(process.env.SMTP_SECURE) === 'true'
      : configuredPort === 465;

  if (!isGmailHost(host)) {
    return [{ port: configuredPort, secure: configuredSecure }];
  }

  // Gmail: try SSL 465 first, then STARTTLS 587
  const attempts = [
    { port: 465, secure: true },
    { port: 587, secure: false },
  ];

  // Put env-preferred port first if it differs
  if (configuredPort === 587) {
    return [
      { port: 587, secure: false },
      { port: 465, secure: true },
    ];
  }

  return attempts;
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

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const attempts = getTransportAttempts();
  let lastError = '';

  for (const attempt of attempts) {
    try {
      const opts = buildTransportOptions(attempt);
      console.log(
        `[MediChain Email] Trying ${opts.host}:${opts.port} (secure=${opts.secure}, family=${opts.family || 'auto'})`
      );

      const transporter = nodemailer.createTransport(opts);
      await transporter.sendMail({
        from: `"MediChain Hospital" <${from}>`,
        to,
        subject,
        text,
        html: html || `<p>${text}</p>`,
      });

      console.log(`[MediChain Email] Sent → ${to} | ${subject} via :${opts.port}`);
      return { sent: true };
    } catch (err) {
      lastError = err.message || String(err);
      console.error(`[MediChain Email] Attempt :${attempt.port} failed:`, lastError);
    }
  }

  return { sent: false, reason: lastError || 'All SMTP attempts failed' };
}

module.exports = {
  isEmailConfigured,
  sendEmail,
};
