const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// ========================================
// PUBLIC ROUTES (No authentication)
// ========================================

// Create Razorpay payment order
// Called after customer submits booking form
router.post('/create-order', paymentController.createPaymentOrder);

// Verify payment after Razorpay success
// Called from frontend after payment completion
router.post('/verify', paymentController.verifyPayment);

// Razorpay webhook (server-to-server)
// Called by Razorpay servers when payment events occur
router.post('/webhook', paymentController.paymentWebhook);

// Get payment status by booking ID
// Customer can check payment status
router.get('/status/:bookingId', paymentController.getPaymentStatus);

module.exports = router;