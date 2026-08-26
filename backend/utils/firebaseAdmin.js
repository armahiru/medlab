/**
 * Firebase Admin — used to verify ID tokens and ensure Auth users exist
 * so password-reset emails can be sent by Firebase (not Gmail/Resend).
 */
let admin;
try {
  admin = require('firebase-admin');
} catch {
  admin = null;
}

function isFirebaseAdminConfigured() {
  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
}

function getFirebaseAdmin() {
  if (!admin || !isFirebaseAdminConfigured()) return null;

  if (!admin.apps.length) {
    const privateKey = String(process.env.FIREBASE_PRIVATE_KEY)
      .replace(/\\n/g, '\n')
      .replace(/^"|"$/g, '');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }

  return admin;
}

async function verifyIdToken(idToken) {
  const app = getFirebaseAdmin();
  if (!app) {
    throw new Error('Firebase Admin is not configured');
  }
  return app.auth().verifyIdToken(idToken);
}

async function ensureAuthUser(email, displayName) {
  const app = getFirebaseAdmin();
  if (!app) {
    throw new Error('Firebase Admin is not configured');
  }

  try {
    return await app.auth().getUserByEmail(email);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    const crypto = require('crypto');
    return app.auth().createUser({
      email,
      displayName: displayName || email,
      password: crypto.randomBytes(24).toString('hex'),
    });
  }
}

module.exports = {
  isFirebaseAdminConfigured,
  getFirebaseAdmin,
  verifyIdToken,
  ensureAuthUser,
};
