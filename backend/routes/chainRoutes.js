const express = require('express');
const chainController = require('../controllers/chainController');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, requireRole('Admin'), chainController.getChain);
router.get('/validate', protect, requireRole('Admin'), chainController.validateChain);
router.post('/repair', protect, requireRole('Admin'), chainController.repairChain);
router.patch(
  '/tamper/:blockIndex',
  protect,
  requireRole('Admin'),
  chainController.tamperBlock
);

module.exports = router;
