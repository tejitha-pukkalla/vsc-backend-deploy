const crypto = require('crypto');
const QRCode = require('qrcode');
const Booking = require('../models/Booking');
const emailService = require('../services/emailService');
const whatsappService = require('../services/whatsappService');

// ========================================
// Generate QR and Send Confirmations
// ========================================
// Called by paymentController after successful payment
exports.generateAndSendQR = async (booking) => {
  try {
    console.log('📋 Starting QR generation for:', booking.bookingNumber);

    // 1. Generate encrypted QR data
    const qrData = generateQRData(booking);
    
    // 2. Generate QR code image (base64)
    const qrImage = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.95,
      margin: 1,
      width: 300
    });
    
    // 3. Update booking with QR
    booking.qrData = qrData;
    booking.qrImage = qrImage;
    await booking.save();
    
    console.log('✅ QR code generated for:', booking.bookingNumber);
    
    // 4. Send email confirmation with QR
    await emailService.sendBookingConfirmation(booking);
    
    // 5. Send WhatsApp notification
    await whatsappService.sendBookingConfirmation(booking);
    
    console.log('✅ All confirmations sent for:', booking.bookingNumber);
    
  } catch (error) {
    console.error('❌ Error in generateAndSendQR:', error);
    // Don't throw - booking is already confirmed
  }
};

// ========================================
// Scan QR Code (Staff Entry Gate)
// ========================================
// @route   POST /api/qr/scan
// @access  Private (Staff/Security)
exports.scanQR = async (req, res) => {
  try {
    const { qrData } = req.body;

    if (!qrData) {
      return res.status(400).json({
        success: false,
        message: 'QR data is required'
      });
    }

    console.log('🔍 Scanning QR code...');

    // 1. Decrypt QR data
    let decryptedData;
    try {
      decryptedData = decryptQRData(qrData);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or corrupted QR code'
      });
    }

    // 2. Find booking
    const booking = await Booking.findById(decryptedData.bookingId)
      .populate('activity', 'title venue address city');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // 3. Validate booking status
    if (booking.bookingStatus !== 'Confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Booking is not confirmed',
        status: booking.bookingStatus
      });
    }

    // 4. Check payment status
    if (booking.paymentStatus !== 'Completed') {
      return res.status(400).json({
        success: false,
        message: 'Payment not completed',
        paymentStatus: booking.paymentStatus
      });
    }

    // 5. Check if already checked in
    if (booking.checkedIn) {
      return res.status(400).json({
        success: false,
        message: 'Already checked in',
        checkedInAt: booking.checkInTime,
        checkedInBy: booking.checkInBy
      });
    }

    // 6. Verify booking date (must be today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingDate = new Date(booking.bookingDate);
    bookingDate.setHours(0, 0, 0, 0);

    if (bookingDate.getTime() !== today.getTime()) {
      return res.status(400).json({
        success: false,
        message: 'This booking is not for today',
        bookingDate: booking.bookingDate,
        todayDate: today
      });
    }

    // 7. Update check-in status
    booking.checkedIn = true;
    booking.checkInTime = new Date();
    booking.checkInBy = req.user._id;
    booking.bookingStatus = 'Completed';
    await booking.save();

    console.log('✅ Check-in successful:', booking.bookingNumber);

    // 8. Return success response
    res.status(200).json({
      success: true,
      message: '✅ Check-in successful!',
      data: {
        bookingNumber: booking.bookingNumber,
        customerName: booking.customerDetails.name,
        activityTitle: booking.activity.title,
        venue: booking.activity.venue,
        numberOfParticipants: booking.numberOfParticipants,
        timeSlot: booking.selectedTimeSlot,
        checkInTime: booking.checkInTime
      }
    });

  } catch (error) {
    console.error('❌ Error scanning QR:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing QR code',
      error: error.message
    });
  }
};

// ========================================
// Resend QR Code (Customer Lost QR)
// ========================================
// @route   POST /api/qr/resend
// @access  Public (with booking verification)
exports.resendQR = async (req, res) => {
  try {
    const { bookingNumber, email, phone } = req.body;

    if (!bookingNumber || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Booking number, email, and phone are required'
      });
    }

    // Find booking with matching details
    const booking = await Booking.findOne({
      bookingNumber,
      'customerDetails.email': email.toLowerCase(),
      'customerDetails.phone': phone
    }).populate('activity', 'title venue address city');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or details do not match'
      });
    }

    // Check if booking is confirmed
    if (booking.bookingStatus !== 'Confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Booking is not confirmed yet'
      });
    }

    // Check if payment is completed
    if (booking.paymentStatus !== 'Completed') {
      return res.status(400).json({
        success: false,
        message: 'Payment not completed'
      });
    }

    // Check if QR exists
    if (!booking.qrImage) {
      return res.status(400).json({
        success: false,
        message: 'QR code not generated yet'
      });
    }

    console.log('📧 Resending QR for:', booking.bookingNumber);

    // Resend email
    await emailService.sendBookingConfirmation(booking);

    // Resend WhatsApp
    await whatsappService.sendBookingConfirmation(booking);

    res.status(200).json({
      success: true,
      message: 'QR code resent successfully via email and WhatsApp'
    });

  } catch (error) {
    console.error('❌ Error resending QR:', error);
    res.status(500).json({
      success: false,
      message: 'Error resending QR code',
      error: error.message
    });
  }
};

// ========================================
// Validate QR (Check if valid)
// ========================================
// @route   POST /api/qr/validate
// @access  Public
exports.validateQR = async (req, res) => {
  try {
    const { qrData } = req.body;

    if (!qrData) {
      return res.status(400).json({
        success: false,
        message: 'QR data is required'
      });
    }

    // Decrypt QR
    let decryptedData;
    try {
      decryptedData = decryptQRData(qrData);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code',
        valid: false
      });
    }

    // Find booking
    const booking = await Booking.findById(decryptedData.bookingId)
      .select('bookingNumber bookingStatus paymentStatus checkedIn checkInTime customerDetails')
      .populate('activity', 'title venue');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
        valid: false
      });
    }

    res.status(200).json({
      success: true,
      valid: true,
      data: {
        bookingNumber: booking.bookingNumber,
        bookingStatus: booking.bookingStatus,
        paymentStatus: booking.paymentStatus,
        checkedIn: booking.checkedIn,
        checkInTime: booking.checkInTime,
        customerName: booking.customerDetails.name,
        activityTitle: booking.activity?.title
      }
    });

  } catch (error) {
    console.error('❌ Error validating QR:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating QR code',
      error: error.message
    });
  }
};

// ========================================
// HELPER: Generate Encrypted QR Data
// ========================================
function generateQRData(booking) {
  const data = {
    bookingId: booking._id.toString(),
    bookingNumber: booking.bookingNumber,
    customerName: booking.customerDetails.name,
    customerPhone: booking.customerDetails.phone,
    activityId: booking.activity._id.toString(),
    bookingDate: booking.bookingDate.toISOString(),
    numberOfParticipants: booking.numberOfParticipants,
    timeSlot: booking.selectedTimeSlot,
    timestamp: Date.now()
  };

  // Encrypt the data
  const algorithm = 'aes-256-cbc';
  const secretKey = process.env.QR_SECRET || 'your-secret-key-minimum-32-chars-long-for-aes-256';
  const key = crypto.scryptSync(secretKey, 'salt', 32);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Return IV + encrypted data (both needed for decryption)
  return `${iv.toString('hex')}:${encrypted}`;
}

// ========================================
// HELPER: Decrypt QR Data
// ========================================
function decryptQRData(encryptedData) {
  try {
    const algorithm = 'aes-256-cbc';
    const secretKey = process.env.QR_SECRET || 'your-secret-key-minimum-32-chars-long-for-aes-256';
    const key = crypto.scryptSync(secretKey, 'salt', 32);

    // Split IV and encrypted data
    const [ivHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');

    // Decrypt
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    console.error('❌ Decryption error:', error);
    throw new Error('Failed to decrypt QR data');
  }
}