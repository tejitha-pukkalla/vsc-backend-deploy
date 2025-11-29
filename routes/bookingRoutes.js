const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { protect, authorize } = require('../middleware/auth');

// ========================================
// PUBLIC ROUTES (No authentication)
// ========================================

// Customer creates booking (Payment pending)
router.post('/', bookingController.createBooking);

// ========================================
// PROTECTED ROUTES (Authentication required)
// ========================================

// Get booking statistics (Dashboard)
router.get(
  '/stats/overview',
  protect,
  authorize('superadmin', 'manager', 'accountant'),
  bookingController.getBookingStats
);

// Get all bookings with filters (Admin panel)
router.get(
  '/',
  protect,
  authorize('superadmin', 'manager', 'accountant'),
  bookingController.getAllBookings
);

// ========================================
//  DYNAMIC ROUTES (Must be last!)
// ========================================

// Customer can check booking status with booking ID (Public)
router.get('/:id', bookingController.getBookingById);

// Cancel booking (Admin only)
router.patch(
  '/:id/cancel',
  protect,  // Apply middleware individually
  authorize('superadmin', 'manager'),
  bookingController.cancelBooking
);

// Check-in booking (Staff QR scanner)
router.post(
  '/:id/checkin',
  protect,  // Apply middleware individually
  authorize('superadmin', 'manager', 'security'),
  bookingController.verifyAndCheckIn
);

module.exports = router;