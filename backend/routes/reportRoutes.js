const express = require('express');
const reportController = require('../controllers/reportController');
const { protect, requireRole, optionalAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

// Public verification
router.get('/verify/:reportId', optionalAuth, reportController.verifyReport);

router.use(protect);

router.get('/', reportController.listReports);
router.get('/:id/download', reportController.downloadReport);
router.get('/:id/access-logs', requireRole('Admin'), reportController.getAccessLogs);
router.post(
  '/',
  requireRole('Uploader'),
  upload.single('file'),
  reportController.uploadReport
);

module.exports = router;
