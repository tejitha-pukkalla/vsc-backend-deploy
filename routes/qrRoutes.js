const express = require('express');
const router = express.Router();
const qrController = require('../controllers/qrController');
const { protect, authorize } = require('../middleware/auth');

// ========================================
// PUBLIC ROUTES
// ========================================

// Validate QR code (anyone can check if QR is valid)
router.post('/validate', qrController.validateQR);

// Resend QR code (customer lost QR)
router.post('/resend', qrController.resendQR);

// ========================================
// PROTECTED ROUTES
// ========================================

// Scan QR code at entry gate (Staff/Security only)
router.post(
  '/scan',
  protect,
  authorize('superadmin', 'manager', 'security'),
  qrController.scanQR
);

module.exports = router;