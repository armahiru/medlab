const express = require('express');
const appointmentController = require('../controllers/appointmentController');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', appointmentController.listAppointments);
router.post('/', requireRole('Uploader'), appointmentController.createAppointment);
router.patch(
  '/:id/status',
  requireRole('Uploader', 'Admin'),
  appointmentController.updateStatus
);

module.exports = router;
