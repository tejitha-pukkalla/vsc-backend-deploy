const Booking = require('../models/Booking');
const Activity = require('../models/Activity');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const qrController = require('./qrController');

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// @desc    Create Razorpay payment order
// @route   POST /api/payments/create-order
// @access  Public
exports.createPaymentOrder = async (req, res) => {
  try {
    const { bookingId } = req.body;

    console.log('💳 Creating payment order for booking:', bookingId);

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
    }

    // Find booking
    const booking = await Booking.findById(bookingId)
      .populate('activity', 'title venue');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Validate booking status
    if (booking.bookingStatus !== 'Initiated') {
      return res.status(400).json({
        success: false,
        message: 'This booking cannot be paid',
        currentStatus: booking.bookingStatus
      });
    }

    if (booking.paymentStatus !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Payment already processed',
        paymentStatus: booking.paymentStatus
      });
    }

    // Create Razorpay order
    const options = {
      amount: Math.round(booking.finalAmount * 100), // Convert to paise
      currency: 'INR',
      receipt: `receipt_${booking.bookingNumber}`,
      notes: {
        bookingId: booking._id.toString(),
        bookingNumber: booking.bookingNumber,
        customerName: booking.customerDetails.name,
        customerEmail: booking.customerDetails.email,
        customerPhone: booking.customerDetails.phone,
        activityTitle: booking.activity?.title || 'Activity',
        numberOfParticipants: booking.numberOfParticipants
      }
    };

    const order = await razorpay.orders.create(options);

    console.log('✅ Razorpay order created:', order.id);

    // Update booking with order ID
    booking.razorpayOrderId = order.id;
    await booking.save();

    // Return order details to frontend
    res.status(200).json({
      success: true,
      message: 'Payment order created successfully',
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        bookingNumber: booking.bookingNumber,
        customerDetails: {
          name: booking.customerDetails.name,
          email: booking.customerDetails.email,
          phone: booking.customerDetails.phone
        },
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        booking: {
          id: booking._id,
          activityTitle: booking.activity?.title,
          venue: booking.activity?.venue,
          date: booking.bookingDate,
          timeSlot: booking.selectedTimeSlot,
          participants: booking.numberOfParticipants
        }
      }
    });

  } catch (error) {
    console.error('❌ Error creating payment order:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating payment order',
      error: error.message
    });
  }
};

// @desc    Verify payment and confirm booking
// @route   POST /api/payments/verify
// @access  Public
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingId
    } = req.body;

    console.log('🔍 Verifying payment:', {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id
    });

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification data'
      });
    }

    // Find booking
    const booking = await Booking.findById(bookingId)
      .populate('activity', 'title venue address city organizerEmail organizerContact');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Verify Razorpay signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      console.error('❌ Payment signature verification failed');
      
      // Mark payment as failed
      booking.paymentStatus = 'Failed';
      await booking.save();

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed. Invalid signature.'
      });
    }

    console.log('✅ Payment signature verified successfully');

    // Fetch payment details from Razorpay
    let paymentDetails;
    try {
      paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
      console.log('💰 Payment details:', {
        method: paymentDetails.method,
        status: paymentDetails.status,
        amount: paymentDetails.amount / 100
      });
    } catch (error) {
      console.error('⚠️ Could not fetch payment details:', error.message);
      paymentDetails = { method: 'Unknown', status: 'captured' };
    }

    // Update booking with payment info
    booking.paymentStatus = 'Completed';
    booking.bookingStatus = 'Confirmed';
    booking.razorpayPaymentId = razorpay_payment_id;
    booking.razorpaySignature = razorpay_signature;
    booking.transactionId = razorpay_payment_id;
    booking.paymentMethod = paymentDetails.method || 'Unknown';
    booking.paidAt = new Date();
    booking.confirmationDate = new Date();

    await booking.save();

    console.log('✅ Booking confirmed:', booking.bookingNumber);

    // 🎯 IMPORTANT: Generate QR and send notifications
    await qrController.generateAndSendQR(booking);

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully! Booking confirmed.',
      data: {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        bookingStatus: booking.bookingStatus,
        paymentStatus: booking.paymentStatus,
        transactionId: booking.transactionId,
        paidAmount: booking.finalAmount,
        paidAt: booking.paidAt,
        qrGenerated: !!booking.qrImage
      }
    });

  } catch (error) {
    console.error('❌ Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying payment',
      error: error.message
    });
  }
};

// @desc    Payment webhook (Razorpay server-to-server callback)
// @route   POST /api/payments/webhook
// @access  Public (but verified with webhook secret)
exports.paymentWebhook = async (req, res) => {
  try {
    console.log('🔨 Webhook received:', req.body.event);

    // Verify webhook signature
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('⚠️ Webhook secret not configured');
      return res.status(500).json({
        success: false,
        message: 'Webhook secret not configured'
      });
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    const isAuthentic = webhookSignature === expectedSignature;

    if (!isAuthentic) {
      console.error('❌ Webhook signature verification failed');
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }

    console.log('✅ Webhook signature verified');

    const event = req.body.event;
    const payload = req.body.payload.payment.entity;

    // Handle payment.captured event
    if (event === 'payment.captured') {
      const razorpayOrderId = payload.order_id;
      const razorpayPaymentId = payload.id;

      console.log('💰 Payment captured:', razorpayPaymentId);

      // Find booking by order ID
      const booking = await Booking.findOne({ razorpayOrderId })
        .populate('activity', 'title venue address city');

      if (!booking) {
        console.error('❌ Booking not found for order:', razorpayOrderId);
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Check if already processed
      if (booking.paymentStatus === 'Completed') {
        console.log('ℹ️ Payment already processed for:', booking.bookingNumber);
        return res.status(200).json({
          success: true,
          message: 'Payment already processed'
        });
      }

      // Update booking
      booking.paymentStatus = 'Completed';
      booking.bookingStatus = 'Confirmed';
      booking.razorpayPaymentId = razorpayPaymentId;
      booking.transactionId = razorpayPaymentId;
      booking.paymentMethod = payload.method || 'Unknown';
      booking.paidAt = new Date();
      booking.confirmationDate = new Date();

      await booking.save();

      console.log('✅ Booking confirmed via webhook:', booking.bookingNumber);

      // Generate QR and send notifications
      await qrController.generateAndSendQR(booking);

      return res.status(200).json({
        success: true,
        message: 'Webhook processed successfully'
      });
    }

    // Handle payment.failed event
    if (event === 'payment.failed') {
      const razorpayOrderId = payload.order_id;
      
      console.log('❌ Payment failed for order:', razorpayOrderId);

      const booking = await Booking.findOne({ razorpayOrderId });
      
      if (booking && booking.paymentStatus === 'Pending') {
        booking.paymentStatus = 'Failed';
        await booking.save();

        // Restore available spots
        const activity = await Activity.findById(booking.activity);
        if (activity) {
          const slotIndex = activity.timeSlots.findIndex(
            slot => slot.startTime === booking.selectedTimeSlot.startTime &&
                    slot.endTime === booking.selectedTimeSlot.endTime
          );
          
          if (slotIndex !== -1) {
            activity.timeSlots[slotIndex].availableSpots += booking.numberOfParticipants;
            await activity.save();
            console.log('♻️ Restored available spots');
          }
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'Webhook received'
    });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing error',
      error: error.message
    });
  }
};

// @desc    Get payment status
// @route   GET /api/payments/status/:bookingId
// @access  Public
exports.getPaymentStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId)
      .select('bookingNumber bookingStatus paymentStatus transactionId paidAt finalAmount');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        bookingNumber: booking.bookingNumber,
        bookingStatus: booking.bookingStatus,
        paymentStatus: booking.paymentStatus,
        transactionId: booking.transactionId,
        amount: booking.finalAmount,
        paidAt: booking.paidAt
      }
    });

  } catch (error) {
    console.error('Error fetching payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment status',
      error: error.message
    });
  }
};