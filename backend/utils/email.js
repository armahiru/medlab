/**
 * Email delivery:
 * 1) Prefer Resend HTTPS API (works on Render — Gmail SMTP often times out there)
 * 2) Fall back to SMTP (Gmail App Password) for local/dev
 */
const nodemailer = require('nodemailer');

function isResendConfigured() {
  return !!process.env.RESEND_API_KEY;
}

function isSmtpConfigured() {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

function isEmailConfigured() {
  return isResendConfigured() || isSmtpConfigured();
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

  if (!onRender) {
    opts.family = 4;
  }

  return opts;
}

function getTransportAttempts() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const configuredPort = Number(process.env.SMTP_PORT || 465);

  if (!isGmailHost(host)) {
    const secure =
      process.env.SMTP_SECURE !== undefined
        ? String(process.env.SMTP_SECURE) === 'true'
        : configuredPort === 465;
    return [{ port: configuredPort, secure }];
  }

  if (configuredPort === 587) {
    return [
      { port: 587, secure: false },
      { port: 465, secure: true },
    ];
  }

  return [
    { port: 465, secure: true },
    { port: 587, secure: false },
  ];
}

async function sendViaResend({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM ||
    process.env.SMTP_FROM ||
    'MediChain <beth.t@example.com>';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html: html || `<p>${text}</p>`,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = body.message || body.error || `Resend HTTP ${response.status}`;
    throw new Error(reason);
  }

  console.log(`[MediChain Email] Sent via Resend → ${to} | ${subject}`);
  return { sent: true };
}

async function sendViaSmtp({ to, subject, text, html }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const attempts = getTransportAttempts();
  let lastError = '';

  for (const attempt of attempts) {
    try {
      const opts = buildTransportOptions(attempt);
      console.log(
        `[MediChain Email] Trying SMTP ${opts.host}:${opts.port} (secure=${opts.secure})`
      );

      const transporter = nodemailer.createTransport(opts);
      await transporter.sendMail({
        from: `"MediChain Hospital" <${from}>`,
        to,
        subject,
        text,
        html: html || `<p>${text}</p>`,
      });

      console.log(`[MediChain Email] Sent via SMTP :${opts.port} → ${to} | ${subject}`);
      return { sent: true };
    } catch (err) {
      lastError = err.message || String(err);
      console.error(`[MediChain Email] SMTP :${attempt.port} failed:`, lastError);
    }
  }

  return { sent: false, reason: lastError || 'All SMTP attempts failed' };
}

/**
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
async function sendEmail({ to, subject, text, html }) {
  if (!to) {
    return { sent: false, reason: 'No recipient email' };
  }

  if (!isEmailConfigured()) {
    console.log(`[MediChain Email] Skipped (not configured): → ${to} | ${subject}`);
    return { sent: false, reason: 'Email not configured' };
  }

  // Prefer Resend on hosted deploys (HTTPS — not blocked like Gmail SMTP)
  if (isResendConfigured()) {
    try {
      return await sendViaResend({ to, subject, text, html });
    } catch (err) {
      console.error('[MediChain Email] Resend failed:', err.message);
      if (!isSmtpConfigured()) {
        return { sent: false, reason: err.message };
      }
      console.log('[MediChain Email] Falling back to SMTP…');
    }
  }

  if (isSmtpConfigured()) {
    return sendViaSmtp({ to, subject, text, html });
  }

  return { sent: false, reason: 'Email not configured' };
}

module.exports = {
  isEmailConfigured,
  isResendConfigured,
  isSmtpConfigured,
  sendEmail,
};
