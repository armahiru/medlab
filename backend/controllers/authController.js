const User = require('../models/User');
const { signToken, formatUser } = require('../middleware/auth');
const { avatarsDir } = require('../middleware/upload');
const { notifyUser } = require('../utils/notify');
const { verifyIdToken, ensureAuthUser, isFirebaseAdminConfigured } = require('../utils/firebaseAdmin');
const fs = require('fs');
const path = require('path');

const PUBLIC_ROLES = ['Uploader', 'Recipient'];

function notifyPatientSignIn(user) {
  if (user.role !== 'Recipient') return;
  const signedInAt = new Date().toLocaleString();
  notifyUser({
    userId: user._id,
    type: 'system',
    title: 'Signed in to MediChain',
    message: `You signed in successfully at ${signedInAt}. If this wasn’t you, reset your password.`,
    link: 'notifications.html',
  }).catch((err) => {
    console.error('[MediChain] Login notice failed:', err.message);
  });
}

async function register(req, res, next) {
  try {
    const { name, email, password, role, patientId, phone } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: 'Name, email, password, and role are required.',
      });
    }

    if (role === 'Admin') {
      return res.status(403).json({
        message: 'Admin accounts cannot be self-registered. Use the seeded hospital admin account.',
      });
    }

    if (!PUBLIC_ROLES.includes(role)) {
      return res.status(400).json({
        message: 'Role must be Uploader or Recipient.',
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters.',
      });
    }

    let normalizedPatientId = null;
    if (role === 'Recipient') {
      normalizedPatientId = String(patientId || '').trim();
      if (!normalizedPatientId) {
        return res.status(400).json({
          message: 'Patient ID is required for Recipient (patient) accounts.',
        });
      }

      const patientTaken = await User.findOne({ patientId: normalizedPatientId });
      if (patientTaken) {
        return res.status(409).json({
          message: 'This Patient ID is already linked to another account.',
        });
      }
    }

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role,
      patientId: normalizedPatientId,
      phone: String(phone || '').trim(),
      firebaseUid: String(req.body.firebaseUid || '').trim(),
    });

    const token = signToken(user);

    return res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: formatUser(user),
    });
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = signToken(user);
    notifyPatientSignIn(user);

    return res.status(200).json({
      message: 'Signed in successfully.',
      token,
      user: formatUser(user),
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/firebase-login — verify Firebase ID token, issue MediChain JWT
 */
async function firebaseLogin(req, res, next) {
  try {
    const idToken = String(req.body.idToken || '').trim();
    if (!idToken) {
      return res.status(400).json({ message: 'Firebase ID token is required.' });
    }
    if (!isFirebaseAdminConfigured()) {
      return res.status(503).json({
        message: 'Firebase is not configured on the server yet.',
      });
    }

    const decoded = await verifyIdToken(idToken);
    const email = String(decoded.email || '')
      .toLowerCase()
      .trim();
    if (!email) {
      return res.status(401).json({ message: 'Firebase account has no email.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        message: 'No MediChain profile for this email. Create an account first.',
      });
    }

    if (!user.firebaseUid) {
      user.firebaseUid = decoded.uid;
      await user.save({ validateBeforeSave: false });
    }

    notifyPatientSignIn(user);

    return res.status(200).json({
      message: 'Signed in successfully.',
      token: signToken(user),
      user: formatUser(user),
    });
  } catch (err) {
    if (err.code === 'auth/id-token-expired' || err.code === 'auth/argument-error') {
      return res.status(401).json({ message: 'Firebase sign-in expired. Try again.' });
    }
    return next(err);
  }
}

async function me(req, res) {
  return res.status(200).json({ user: formatUser(req.user) });
}

/**
 * List registered patients for clinical workflows (doctors / admins).
 */
async function listPatients(req, res, next) {
  try {
    const patients = await User.find({ role: 'Recipient' })
      .select('name email patientId phone profileImage')
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      count: patients.length,
      patients: patients.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        email: p.email,
        patientId: p.patientId,
        phone: p.phone || '',
        profileImage: p.profileImage || '',
      })),
    });
  } catch (err) {
    return next(err);
  }
}

async function uploadProfileImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Choose a profile photo to upload.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }

    if (user.profileImage) {
      const prev = path.join(avatarsDir, path.basename(user.profileImage));
      if (fs.existsSync(prev)) {
        try {
          fs.unlinkSync(prev);
        } catch {
          /* ignore cleanup errors */
        }
      }
    }

    user.profileImage = req.file.filename;
    await user.save();

    return res.status(200).json({
      message: 'Profile photo updated.',
      user: formatUser(user),
    });
  } catch (err) {
    return next(err);
  }
}

async function removeProfileImage(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }

    if (user.profileImage) {
      const prev = path.join(avatarsDir, path.basename(user.profileImage));
      if (fs.existsSync(prev)) {
        try {
          fs.unlinkSync(prev);
        } catch {
          /* ignore */
        }
      }
    }

    user.profileImage = '';
    await user.save();

    return res.status(200).json({
      message: 'Profile photo removed.',
      user: formatUser(user),
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/forgot-password
 * Makes sure a Firebase Auth user exists so the client can send Firebase's reset email.
 */
async function forgotPassword(req, res, next) {
  try {
    const email = String(req.body.email || '')
      .toLowerCase()
      .trim();

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }

    const okMessage =
      'If that email is registered, a password reset link was sent. Check inbox and spam.';

    if (!isFirebaseAdminConfigured()) {
      return res.status(503).json({
        message: 'Password reset is not ready yet. Firebase Admin is not configured.',
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({ message: okMessage });
    }

    const firebaseUser = await ensureAuthUser(email, user.name);
    if (!user.firebaseUid && firebaseUser?.uid) {
      user.firebaseUid = firebaseUser.uid;
      await user.save({ validateBeforeSave: false });
    }

    return res.status(200).json({ message: okMessage, ready: true });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  register,
  login,
  firebaseLogin,
  me,
  listPatients,
  uploadProfileImage,
  removeProfileImage,
  forgotPassword,
};
