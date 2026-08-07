const express = require('express');
const contactController = require('../controllers/contactController');
const { protect, requireRole, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Anyone can contact (logged in preferred); optionalAuth attaches user if present
router.post('/', optionalAuth, contactController.submitContact);

router.get('/', protect, requireRole('Admin'), contactController.listContacts);
router.patch(
  '/:id/status',
  protect,
  requireRole('Admin'),
  contactController.updateContactStatus
);

module.exports = router;
