/**
 * Firebase Admin — verify ID tokens and ensure Auth users exist
 * so password-reset emails can be sent by Firebase (not Gmail/Resend).
 *
 * firebase-admin v14 uses modular exports (getApps / getAuth / cert).
 * The old `admin.apps.length` / `admin.auth()` API is undefined and throws
 * "Cannot read properties of undefined (reading 'length')".
 */
let initializeApp;
let getApps;
let cert;
let getAuth;
let adminLoadError = null;

try {
  ({ initializeApp, getApps, cert } = require('firebase-admin/app'));
  ({ getAuth } = require('firebase-admin/auth'));
} catch (err) {
  adminLoadError = err;
}

function isFirebaseAdminConfigured() {
  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY &&
    initializeApp &&
    getAuth &&
    cert
  );
}

function normalizePrivateKey(raw) {
  let key = String(raw || '').trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
}

function getAuthInstance() {
  if (adminLoadError) {
    throw new Error(
      `Firebase Admin SDK failed to load: ${adminLoadError.message}`
    );
  }
  if (!isFirebaseAdminConfigured()) {
    throw new Error('Firebase Admin is not configured');
  }

  if (!getApps().length) {
    try {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
        }),
      });
    } catch (err) {
      console.error('[MediChain] Firebase Admin init failed:', err.message);
      throw new Error(
        'Firebase Admin failed to start. Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.'
      );
    }
  }

  return getAuth();
}

async function verifyIdToken(idToken) {
  return getAuthInstance().verifyIdToken(idToken);
}

async function ensureAuthUser(email, displayName) {
  const auth = getAuthInstance();

  try {
    return await auth.getUserByEmail(email);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    const crypto = require('crypto');
    return auth.createUser({
      email,
      displayName: displayName || email,
      password: crypto.randomBytes(24).toString('hex'),
    });
  }
}

module.exports = {
  isFirebaseAdminConfigured,
  verifyIdToken,
  ensureAuthUser,
};
