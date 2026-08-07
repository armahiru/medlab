/**
 * Public QR image for report verification links.
 * Avoids browser CDN hangs when generating QR codes.
 */
const express = require('express');
const QRCode = require('qrcode');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const reportId = String(req.query.id || '').trim();
    if (!reportId || reportId.length > 128) {
      return res.status(400).json({ message: 'Valid Report ID required' });
    }

    const size = Math.min(Math.max(parseInt(req.query.size, 10) || 220, 120), 400);

    // Absolute verify URL for the current host (works on deploy / LAN)
    const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
    const host = req.get('x-forwarded-host') || req.get('host');
    const verifyUrl = `${proto}://${host}/index.html?id=${encodeURIComponent(reportId)}#verify`;

    const png = await QRCode.toBuffer(verifyUrl, {
      type: 'png',
      width: size,
      margin: 2,
      color: { dark: '#0f2438', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });

    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300',
    });
    return res.send(png);
  } catch (err) {
    console.error('[QR]', err.message);
    return res.status(500).json({ message: 'Could not generate QR code' });
  }
});

module.exports = router;
