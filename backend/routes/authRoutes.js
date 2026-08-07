const express = require('express');
const authController = require('../controllers/authController');
const { protect, requireRole } = require('../middleware/auth');
const { avatarUpload } = require('../middleware/upload');

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', protect, authController.me);
router.get(
  '/patients',
  protect,
  requireRole('Uploader', 'Admin'),
  authController.listPatients
);
router.post(
  '/profile-image',
  protect,
  (req, res, next) => {
    avatarUpload.single('photo')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message || 'Upload failed.' });
      }
      return next();
    });
  },
  authController.uploadProfileImage
);
router.delete('/profile-image', protect, authController.removeProfileImage);

module.exports = router;
