require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/authRoutes');
const reportRoutes = require('./routes/reportRoutes');
const chainRoutes = require('./routes/chainRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const contactRoutes = require('./routes/contactRoutes');
const qrRoutes = require('./routes/qrRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { ensureGenesisBlock } = require('./utils/blockchain');
const { seedDemoUsers } = require('./seed');
const { isEmailConfigured } = require('./utils/email');
const { isSmsConfigured } = require('./utils/sms');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/medichain';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

const allowedOrigins = new Set([
  FRONTEND_ORIGIN,
  'http://127.0.0.1:3000',
  'http://localhost:3000',
]);

function isLocalDevOrigin(origin) {
  try {
    const { hostname, port, protocol } = new URL(origin);
    const localHost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);
    return (
      (protocol === 'http:' || protocol === 'https:') &&
      localHost &&
      (port === '3000' || port === '5000' || port === '')
    );
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin / tools with no Origin header (curl, Postman)
      // Also allow LAN IPs in local demo (phone on same Wi‑Fi)
      if (!origin || allowedOrigins.has(origin) || isLocalDevOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Medical files are NOT publicly static — use authenticated GET /api/reports/:id/download

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'MediChain API',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/chain', chainRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/qr', qrRoutes);

// Profile photos only (medical report files stay private behind download API)
const { avatarsDir } = require('./middleware/upload');
app.use('/avatars', express.static(avatarsDir, { fallthrough: false, maxAge: '7d' }));

// Serve the UI from the same port so phones only need one URL (easier through firewall / tunnels)
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));
app.get('/', (_req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
    const jwtSecret = process.env.JWT_SECRET || '';
    if (!jwtSecret || jwtSecret.length < 16) {
      throw new Error(
        'JWT_SECRET is missing or too short. Set a strong secret (16+ chars) in backend/.env'
      );
    }

    const usingAtlas = /mongodb\.net|mongodb\+srv/i.test(MONGO_URI);
    console.log(
      `[MediChain] Connecting to MongoDB (${usingAtlas ? 'Atlas' : 'local'})...`
    );

    mongoose.connection.on('connected', () => {
      console.log('[MediChain] MongoDB status: connected');
    });
    mongoose.connection.on('disconnected', () => {
      console.warn('[MediChain] MongoDB status: disconnected (will retry automatically)');
    });
    mongoose.connection.on('reconnected', () => {
      console.log('[MediChain] MongoDB status: reconnected');
    });
    mongoose.connection.on('error', (err) => {
      console.error('[MediChain] MongoDB error:', err.message);
    });

    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 20000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    });

    await ensureGenesisBlock();
    console.log('[MediChain] Genesis block ready');

    await seedDemoUsers();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[MediChain] App + API: http://localhost:${PORT}`);
      console.log(`[MediChain] Phone (same Wi‑Fi): http://<your-pc-ip>:${PORT}`);
      console.log(`[MediChain] Health: http://localhost:${PORT}/api/health`);
      console.log(`[MediChain] Email SMTP: ${isEmailConfigured() ? 'configured' : 'off (in-app still works)'}`);
      console.log(`[MediChain] SMS Twilio: ${isSmsConfigured() ? 'configured' : 'off (in-app still works)'}`);
      console.log('[MediChain] Demo accounts (seeded): admin@ / doctor@ / patient@ hospital.org');
    });
  } catch (err) {
    console.error('[MediChain] Failed to start:', err.message);
    console.error(
      'Check MONGO_URI in backend/.env, Atlas Network Access (IP allow list), and your internet/DNS.'
    );
    process.exit(1);
  }
}

start();
