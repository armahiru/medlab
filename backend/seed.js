/**
 * Seed demo hospital accounts if they do not already exist.
 * Safe to run on every server start.
 */
const User = require('./models/User');

const DEMO_USERS = [
  {
    name: 'Hospital Admin',
    email: 'admin@hospital.org',
    password: 'admin123',
    role: 'Admin',
  },
  {
    name: 'Dr. Ama Boateng',
    email: 'doctor@hospital.org',
    password: 'doctor123',
    role: 'Uploader',
    phone: '+233200000001',
  },
  {
    name: 'Patient Kofi Mensah',
    email: 'patient@hospital.org',
    password: 'patient123',
    role: 'Recipient',
    patientId: 'PAT-2026-0142',
    phone: '+233200000142',
  },
];

async function seedDemoUsers() {
  for (const account of DEMO_USERS) {
    const exists = await User.findOne({ email: account.email });
    if (!exists) {
      await User.create(account);
      console.log(`[MediChain] Seeded ${account.role}: ${account.email}`);
      continue;
    }

    let changed = false;

    if (account.role === 'Recipient' && account.patientId && !exists.patientId) {
      exists.patientId = account.patientId;
      changed = true;
      console.log(`[MediChain] Linked patientId ${account.patientId} → ${account.email}`);
    }

    if (account.phone && !exists.phone) {
      exists.phone = account.phone;
      changed = true;
      console.log(`[MediChain] Linked phone ${account.phone} → ${account.email}`);
    }

    if (changed) await exists.save();
  }
}

// Allow `npm run seed` as a standalone script
if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '.env') });
  const mongoose = require('mongoose');

  (async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/medichain');
      await seedDemoUsers();
      console.log('[MediChain] Seed complete');
      await mongoose.disconnect();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { seedDemoUsers, DEMO_USERS };
