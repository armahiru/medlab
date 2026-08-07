const jwt = require('jsonwebtoken');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function formatUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    patientId: user.patientId || null,
    phone: user.phone || '',
    profileImage: user.profileImage || '',
  };
}

/**
 * Require a valid JWT Bearer token.
 */
async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Authentication required. Please sign in.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token. Please sign in again.' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Restrict route to one or more roles.
 * Usage: requireRole('Admin') or requireRole('Uploader', 'Admin')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Requires role: ${roles.join(' or ')}.`,
      });
    }

    return next();
  };
}

/**
 * Optional auth — attaches user if token present, never blocks.
 */
async function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme === 'Bearer' && token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (user) req.user = user;
      } catch {
        // ignore invalid token for public routes
      }
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  signToken,
  formatUser,
  protect,
  requireRole,
  optionalAuth,
};
