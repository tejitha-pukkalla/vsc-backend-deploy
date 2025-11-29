const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  // Activity Reference
  activity: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Activity',
    required: [true, 'Activity reference is required']
  },
  
  // Customer Details (Guest booking - No user auth needed)
  customerDetails: {
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number']
    },
    address: {
      type: String,
      required: [true, 'Address is required']
    }
  },
  
  // Booking Details
  bookingDate: {
    type: Date,
    required: [true, 'Booking date is required']
  },
  selectedTimeSlot: {
    startTime: {
      type: String,
      required: [true, 'Start time is required']
    },
    endTime: {
      type: String,
      required: [true, 'End time is required']
    }
  },
  numberOfParticipants: {
    type: Number,
    required: [true, 'Number of participants is required'],
    min: [1, 'At least 1 participant required']
  },
  
  // Pricing Details
  pricePerPerson: {
    type: Number,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true
  },
  
  // Booking Status
  bookingStatus: {
    type: String,
    enum: {
      values: ['Initiated', 'Confirmed', 'Cancelled', 'Completed', 'No-Show'],
      message: '{VALUE} is not a valid booking status'
    },
    default: 'Initiated'
  },
  
  // Payment Status
  paymentStatus: {
    type: String,
    enum: {
      values: ['Pending', 'Completed', 'Failed', 'Refunded'],
      message: '{VALUE} is not a valid payment status'
    },
    default: 'Pending'
  },
  
  // Payment Details (Will be updated by paymentController)
  transactionId: {
    type: String,
    default: null
  },
  razorpayOrderId: {
    type: String,
    default: null
  },
  razorpayPaymentId: {
    type: String,
    default: null
  },
  razorpaySignature: {
    type: String,
    default: null
  },
  paymentMethod: {
    type: String,
    enum: ['UPI', 'Card', 'NetBanking', 'Wallet', null],
    default: null
  },
  paidAt: {
    type: Date,
    default: null
  },
  
  // QR Code (Generated after payment)
  qrData: {
    type: String,
    default: null
  },
  qrImage: {
    type: String,
    default: null
  },
  
  // Check-in Details
  checkedIn: {
    type: Boolean,
    default: false
  },
  checkInTime: {
    type: Date,
    default: null
  },
  checkInBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Confirmation
  confirmationDate: {
    type: Date,
    default: null
  },
  bookingNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  
  // Cancellation
  cancelledAt: {
    type: Date,
    default: null
  },
  cancellationReason: {
    type: String,
    default: null
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Admin Notes
  adminNotes: {
    type: String,
    default: null
  },
  
  // Activity Snapshot
  activitySnapshot: {
    title: String,
    venue: String,
    address: String,
    city: String,
    thumbnailImage: String
  }
}, {
  timestamps: true
});

// Indexes for better query performance
bookingSchema.index({ bookingNumber: 1 });
bookingSchema.index({ 'customerDetails.email': 1 });
bookingSchema.index({ 'customerDetails.phone': 1 });
bookingSchema.index({ activity: 1, bookingDate: 1 });
bookingSchema.index({ bookingStatus: 1, paymentStatus: 1 });
bookingSchema.index({ transactionId: 1 });
bookingSchema.index({ razorpayOrderId: 1 });
bookingSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);