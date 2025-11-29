const Booking = require('../models/Booking');
const Activity = require('../models/Activity');
const mongoose = require('mongoose');

// @desc    Create new booking (Customer initiates booking - Payment pending)
// @route   POST /api/bookings
// @access  Public (No authentication needed)
exports.createBooking = async (req, res) => {
  try {
    const {
      activityId,
      bookingDate,
      selectedTimeSlot,
      numberOfParticipants,
      customerDetails
    } = req.body;

    console.log(' Creating booking with data:', JSON.stringify(req.body, null, 2));

    // ✅ 1. Validate required fields
    if (!activityId || !bookingDate || !selectedTimeSlot || !numberOfParticipants || !customerDetails) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
        required: ['activityId', 'bookingDate', 'selectedTimeSlot', 'numberOfParticipants', 'customerDetails']
      });
    }

    // ✅ 2. Validate customer details
    const { name, email, phone, address } = customerDetails;
    if (!name || !email || !phone || !address) {
      return res.status(400).json({
        success: false,
        message: 'Customer details incomplete',
        required: ['name', 'email', 'phone', 'address']
      });
    }

    // ✅ 3. Validate time slot structure
    if (!selectedTimeSlot.startTime || !selectedTimeSlot.endTime) {
      return res.status(400).json({
        success: false,
        message: 'Time slot must have startTime and endTime'
      });
    }

    // ✅ 4. Check if activity exists and is active
    const activity = await Activity.findById(activityId);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found'
      });
    }

    if (activity.status !== 'Active' || !activity.isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Activity is not available for booking'
      });
    }

    // ✅ 5. Validate booking date
    const requestedDate = new Date(bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (requestedDate < today) {
      return res.status(400).json({
        success: false,
        message: 'Cannot book for past dates'
      });
    }

    if (requestedDate < activity.startDate || requestedDate > activity.endDate) {
      return res.status(400).json({
        success: false,
        message: 'Activity is not available on this date',
        availableRange: {
          start: activity.startDate,
          end: activity.endDate
        }
      });
    }

    // ✅ 6. Validate day of week
    const dayName = requestedDate.toLocaleDateString('en-US', { weekday: 'long' });
    if (!activity.availableDays.includes(dayName)) {
      return res.status(400).json({
        success: false,
        message: `Activity is not available on ${dayName}`,
        availableDays: activity.availableDays
      });
    }

    // ✅ 7. Find and validate time slot
    const timeSlot = activity.timeSlots.find(
      slot => slot.startTime === selectedTimeSlot.startTime && 
              slot.endTime === selectedTimeSlot.endTime
    );

    if (!timeSlot) {
      return res.status(400).json({
        success: false,
        message: 'Invalid time slot',
        availableSlots: activity.timeSlots
      });
    }

    // 8. Check available spots
    if (timeSlot.availableSpots < numberOfParticipants) {
      return res.status(400).json({
        success: false,
        message: 'Not enough spots available',
        requested: numberOfParticipants,
        available: timeSlot.availableSpots
      });
    }

    // 9. Validate max participants
    if (numberOfParticipants > activity.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${activity.maxParticipants} participants allowed`
      });
    }

    // 10. Calculate pricing
    const pricePerPerson = activity.priceAfterDiscount || activity.price;
    const totalAmount = pricePerPerson * numberOfParticipants;
    const discountAmount = (activity.price - pricePerPerson) * numberOfParticipants;
    const finalAmount = totalAmount;

    // 11. Reduce available spots temporarily
    const slotIndex = activity.timeSlots.findIndex(
      slot => slot.startTime === selectedTimeSlot.startTime && 
              slot.endTime === selectedTimeSlot.endTime
    );
    
    activity.timeSlots[slotIndex].availableSpots -= numberOfParticipants;
    await activity.save();

    console.log('Reduced available spots:', {
      slotIndex,
      newAvailableSpots: activity.timeSlots[slotIndex].availableSpots
    });

    // 12. Generate booking number manually
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Find last booking of today
    const lastBooking = await Booking.findOne({
      createdAt: {
        $gte: todayStart,
        $lt: todayEnd
      }
    }).sort({ createdAt: -1 });

    let sequence = 1;
    if (lastBooking && lastBooking.bookingNumber) {
      const lastSequence = parseInt(lastBooking.bookingNumber.slice(-4));
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }

    const bookingNumber = `BK-${year}${month}${day}-${String(sequence).padStart(4, '0')}`;

    console.log('Generated booking number:', bookingNumber);

    // 13. Create booking with generated booking number
    const booking = await Booking.create({
      bookingNumber, // ✅ Add booking number here
      activity: activityId,
      customerDetails: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        address: address.trim()
      },
      bookingDate: requestedDate,
      selectedTimeSlot: {
        startTime: selectedTimeSlot.startTime,
        endTime: selectedTimeSlot.endTime
      },
      numberOfParticipants,
      pricePerPerson,
      totalAmount,
      discountAmount,
      finalAmount,
      bookingStatus: 'Initiated',
      paymentStatus: 'Pending',
      activitySnapshot: {
        title: activity.title,
        venue: activity.venue,
        address: activity.address,
        city: activity.city,
        thumbnailImage: activity.thumbnailImage
      }
    });

    console.log('Booking created successfully:', booking.bookingNumber);

    //  14. Return booking ID and amount to frontend
    res.status(201).json({
      success: true,
      message: 'Booking initiated successfully. Please proceed to payment.',
      data: {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        amount: finalAmount,
        currency: 'INR',
        booking: {
          activityTitle: activity.title,
          venue: activity.venue,
          date: booking.bookingDate,
          timeSlot: booking.selectedTimeSlot,
          participants: numberOfParticipants,
          customerName: name
        }
      }
    });

  } catch (error) {
    console.error(' Error creating booking:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating booking',
      error: error.message
    });
  }
};

// @desc    Get booking by ID
// @route   GET /api/bookings/:id
// @access  Public (Customer can check with booking number)
exports.getBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID'
      });
    }

    const booking = await Booking.findById(id)
      .populate('activity', 'title description venue address city thumbnailImage')
      .populate('checkInBy', 'name email')
      .populate('cancelledBy', 'name email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.status(200).json({
      success: true,
      data: booking
    });

  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching booking',
      error: error.message
    });
  }
};

// @desc    Get all bookings with filters (Admin panel)
// @route   GET /api/bookings
// @access  Private (Admin, Manager, Accountant)
exports.getAllBookings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      bookingStatus,
      paymentStatus,
      activityId,
      fromDate,
      toDate,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Filters
    if (bookingStatus) query.bookingStatus = bookingStatus;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (activityId) query.activity = activityId;
    
    if (fromDate || toDate) {
      query.bookingDate = {};
      if (fromDate) query.bookingDate.$gte = new Date(fromDate);
      if (toDate) query.bookingDate.$lte = new Date(toDate);
    }
    
    if (search) {
      query.$or = [
        { bookingNumber: { $regex: search, $options: 'i' } },
        { 'customerDetails.name': { $regex: search, $options: 'i' } },
        { 'customerDetails.email': { $regex: search, $options: 'i' } },
        { 'customerDetails.phone': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const bookings = await Booking.find(query)
      .populate('activity', 'title venue city thumbnailImage')
      .populate('checkInBy', 'name')
      .populate('cancelledBy', 'name')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const totalCount = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(totalCount / limit),
          totalItems: totalCount,
          itemsPerPage: Number(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bookings',
      error: error.message
    });
  }
};

// @desc    Cancel booking (Admin only)
// @route   PATCH /api/bookings/:id/cancel
// @access  Private (Admin)
exports.cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID'
      });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Can only cancel if payment NOT completed
    if (booking.paymentStatus === 'Completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed bookings. Please process refund first.'
      });
    }

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
        console.log(' Restored available spots');
      }
    }

    // Update booking
    booking.bookingStatus = 'Cancelled';
    booking.cancelledAt = new Date();
    booking.cancellationReason = reason || 'Cancelled by admin';
    booking.cancelledBy = req.user._id;
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking
    });

  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling booking',
      error: error.message
    });
  }
};

// @desc    Get booking statistics (Admin dashboard)
// @route   GET /api/bookings/stats/overview
// @access  Private (Admin, Manager, Accountant)
exports.getBookingStats = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    
    const dateFilter = {};
    if (fromDate || toDate) {
      dateFilter.createdAt = {};
      if (fromDate) dateFilter.createdAt.$gte = new Date(fromDate);
      if (toDate) dateFilter.createdAt.$lte = new Date(toDate);
    }

    // Total bookings
    const totalBookings = await Booking.countDocuments(dateFilter);
    
    // By status
    const confirmedBookings = await Booking.countDocuments({ 
      ...dateFilter, 
      bookingStatus: 'Confirmed' 
    });
    const cancelledBookings = await Booking.countDocuments({ 
      ...dateFilter, 
      bookingStatus: 'Cancelled' 
    });
    const pendingBookings = await Booking.countDocuments({ 
      ...dateFilter, 
      bookingStatus: 'Initiated' 
    });

    // Revenue calculation
    const revenueData = await Booking.aggregate([
      { 
        $match: { 
          ...dateFilter,
          paymentStatus: 'Completed' 
        } 
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$finalAmount' },
          totalBookings: { $sum: 1 }
        }
      }
    ]);

    // Today's bookings
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    const todayBookings = await Booking.countDocuments({
      createdAt: { $gte: todayStart, $lte: todayEnd }
    });

    // Upcoming events (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const upcomingBookings = await Booking.countDocuments({
      bookingDate: { $gte: new Date(), $lte: nextWeek },
      bookingStatus: 'Confirmed'
    });

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalBookings,
          confirmedBookings,
          cancelledBookings,
          pendingBookings,
          todayBookings,
          upcomingBookings,
          totalRevenue: revenueData[0]?.totalRevenue || 0,
          completedPayments: revenueData[0]?.totalBookings || 0
        }
      }
    });

  } catch (error) {
    console.error('Error fetching booking stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
};

// @desc    Verify and check-in booking (Staff QR scanner)
// @route   POST /api/bookings/:id/checkin
// @access  Private (Staff)
exports.verifyAndCheckIn = async (req, res) => {
  try {
    const { id } = req.params;
    const { qrData } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID'
      });
    }

    const booking = await Booking.findById(id)
      .populate('activity', 'title venue');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Validation checks
    if (booking.bookingStatus !== 'Confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Booking is not confirmed',
        status: booking.bookingStatus
      });
    }

    if (booking.paymentStatus !== 'Completed') {
      return res.status(400).json({
        success: false,
        message: 'Payment not completed'
      });
    }

    if (booking.checkedIn) {
      return res.status(400).json({
        success: false,
        message: 'Already checked in',
        checkedInAt: booking.checkInTime
      });
    }

    // Verify QR data matches
    if (qrData && booking.qrData !== qrData) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code'
      });
    }

    // Check booking date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingDate = new Date(booking.bookingDate);
    bookingDate.setHours(0, 0, 0, 0);

    if (bookingDate.getTime() !== today.getTime()) {
      return res.status(400).json({
        success: false,
        message: 'This booking is not for today',
        bookingDate: booking.bookingDate
      });
    }

    //  Update check-in status
    booking.checkedIn = true;
    booking.checkInTime = new Date();
    booking.checkInBy = req.user._id;
    booking.bookingStatus = 'Completed';
    await booking.save();

    console.log(' Check-in successful:', booking.bookingNumber);

    res.status(200).json({
      success: true,
      message: 'Check-in successful',
      data: {
        bookingNumber: booking.bookingNumber,
        customerName: booking.customerDetails.name,
        activity: booking.activity.title,
        participants: booking.numberOfParticipants,
        checkInTime: booking.checkInTime
      }
    });

  } catch (error) {
    console.error('Error during check-in:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing check-in',
      error: error.message
    });
  }
};