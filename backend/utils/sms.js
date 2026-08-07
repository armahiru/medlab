/**
 * Optional SMS (text message) delivery via Twilio.
 * If Twilio is not configured, SMS is skipped — in-app notifications still work.
 */
function isSmsConfigured() {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
}

/**
 * Normalize to E.164-ish string; leaves numbers starting with + as-is.
 */
function normalizePhone(phone) {
  if (!phone) return null;
  const trimmed = String(phone).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('+')) return trimmed.replace(/\s+/g, '');
  // Default Ghana country code if local 0XXXXXXXXX style — keep flexible for demo
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0') && digits.length >= 10) {
    return `+233${digits.slice(1)}`;
  }
  return `+${digits}`;
}

/**
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
async function sendSms({ to, body }) {
  const phone = normalizePhone(to);
  if (!phone) {
    return { sent: false, reason: 'No phone number on patient account' };
  }

  if (!isSmsConfigured()) {
    console.log(`[MediChain SMS] Skipped (Twilio not configured): → ${phone} | ${body}`);
    return { sent: false, reason: 'Twilio not configured' };
  }

  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;

    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const params = new URLSearchParams({
      To: phone,
      From: from,
      Body: body.slice(0, 1600),
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[MediChain SMS] Twilio error:', errText);
      return { sent: false, reason: 'Twilio API error' };
    }

    console.log(`[MediChain SMS] Sent → ${phone}`);
    return { sent: true };
  } catch (err) {
    console.error('[MediChain SMS] Failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = {
  isSmsConfigured,
  sendSms,
  normalizePhone,
};
