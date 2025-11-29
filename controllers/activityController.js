const Activity = require('../models/Activity');
const mongoose = require('mongoose');
const { deleteFromCloudinary, deleteMultipleFromCloudinary } = require('../config/cloudinary');

// @desc    Create new activity
// @route   POST /api/activities
// @access  Private (Admin only)
exports.createActivity = async (req, res) => {
  try {
    console.log(' Received request body:', JSON.stringify(req.body, null, 2));
    console.log(' Received files:', req.files?.length || 0);

    const {
      title, description, category, venue, address, city, state, pincode,
      startDate, endDate, duration, availableDays, timeSlots,
      price, priceUnit, discountPercentage, maxParticipants, maxParticipantsPerSlot,
      minAge, maxAge, prerequisites, inclusions, exclusions, thingsToCarry, 
      safetyGuidelines, safetyRules, cancellationPolicy, termsAndConditions, 
      status, organizerName, organizerContact, organizerEmail, 
      latitude, longitude, videoUrl
    } = req.body;

    // Validation checks
    if (!title || !description || !category) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and category are required',
        received: { title: !!title, description: !!description, category: !!category }
      });
    }

    if (!venue || !address || !city || !state || !pincode) {
      return res.status(400).json({
        success: false,
        message: 'All location fields are required',
        received: { venue: !!venue, address: !!address, city: !!city, state: !!state, pincode: !!pincode }
      });
    }

    if (!startDate || !endDate || !duration) {
      return res.status(400).json({
        success: false,
        message: 'Start date, end date, and duration are required',
        received: { startDate: !!startDate, endDate: !!endDate, duration: !!duration }
      });
    }

    if (!price || !maxParticipants) {
      return res.status(400).json({
        success: false,
        message: 'Price and max participants are required',
        received: { price: !!price, maxParticipants: !!maxParticipants }
      });
    }

    // Get Cloudinary URLs from uploaded files
    const images = req.files ? req.files.map(file => file.path) : [];
    const thumbnailImage = images.length > 0 ? images[0] : null;

    // Parse and validate availableDays
    let parsedAvailableDays = [];
    if (availableDays) {
      try {
        parsedAvailableDays = typeof availableDays === 'string' ? JSON.parse(availableDays) : availableDays;
        console.log(' Available Days:', parsedAvailableDays);
      } catch (e) {
        console.error(' Error parsing availableDays:', e);
        return res.status(400).json({
          success: false,
          message: 'Invalid available days format',
          error: e.message
        });
      }
    }

    if (!parsedAvailableDays || parsedAvailableDays.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one available day is required'
      });
    }

    // Parse and validate time slots
    let parsedTimeSlots = [];
    if (timeSlots) {
      try {
        const slots = typeof timeSlots === 'string' ? JSON.parse(timeSlots) : timeSlots;
        console.log(' Raw time slots:', slots);

        if (!Array.isArray(slots) || slots.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'At least one time slot is required'
          });
        }

        parsedTimeSlots = slots.map((slot, index) => {
          if (!slot.startTime || !slot.endTime || !slot.availableSpots) {
            throw new Error(`Time slot ${index + 1}: Missing startTime, endTime, or availableSpots`);
          }

          return {
            startTime: String(slot.startTime).trim(),
            endTime: String(slot.endTime).trim(),
            availableSpots: Number(slot.availableSpots)
          };
        });

        console.log(' Parsed time slots:', parsedTimeSlots);
      } catch (e) {
        console.error(' Error parsing timeSlots:', e);
        return res.status(400).json({
          success: false,
          message: 'Invalid time slots format: ' + e.message,
          receivedTimeSlots: timeSlots
        });
      }
    }

    if (parsedTimeSlots.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one time slot is required'
      });
    }

    // Helper function to safely parse JSON
    const safeParseJSON = (data, fieldName, defaultValue = []) => {
      if (!data) return defaultValue;
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        return Array.isArray(parsed) ? parsed.filter(item => item && item.trim()) : defaultValue;
      } catch (e) {
        console.warn(` Warning: Could not parse ${fieldName}, using default`);
        return defaultValue;
      }
    };

    const activityData = {
      title: String(title).trim(),
      description: String(description).trim(),
      category,
      venue: String(venue).trim(),
      address: String(address).trim(),
      city: String(city).trim(),
      state: String(state).trim(),
      pincode: String(pincode).trim(),
      locationCoordinates: {
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null
      },
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      duration: Number(duration),
      availableDays: parsedAvailableDays,
      timeSlots: parsedTimeSlots,
      price: Number(price),
      priceUnit: priceUnit || 'per person',
      discountPercentage: discountPercentage ? Number(discountPercentage) : 0,
      maxParticipants: Number(maxParticipants),
      maxParticipantsPerSlot: maxParticipantsPerSlot ? Number(maxParticipantsPerSlot) : null,
      minAge: minAge ? Number(minAge) : null,
      maxAge: maxAge ? Number(maxAge) : null,
      prerequisites: safeParseJSON(prerequisites, 'prerequisites'),
      inclusions: safeParseJSON(inclusions, 'inclusions'),
      exclusions: safeParseJSON(exclusions, 'exclusions'),
      thingsToCarry: safeParseJSON(thingsToCarry, 'thingsToCarry'),
      safetyGuidelines: safeParseJSON(safetyGuidelines, 'safetyGuidelines'),
      safetyRules: safetyRules || 'Please follow all safety instructions provided by our trained staff.',
      cancellationPolicy: cancellationPolicy || '',
      termsAndConditions: termsAndConditions || '',
      status: status || 'Draft',
      images,
      thumbnailImage,
      videoUrl: videoUrl || null,
      organizer: {
        name: organizerName || '',
        contactNumber: organizerContact || '',
        email: organizerEmail || ''
      },
      createdBy: req.user._id
    };

    console.log(' Final activity data:', JSON.stringify(activityData, null, 2));

    const activity = await Activity.create(activityData);

    console.log(' Activity created successfully:', activity._id);

    res.status(201).json({
      success: true,
      message: 'Activity created successfully',
      data: activity
    });

  } catch (error) {
    console.error(' Error creating activity:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      errors: error.errors
    });
    
    // If error occurs, delete uploaded images from Cloudinary
    if (req.files && req.files.length > 0) {
      const imageUrls = req.files.map(file => file.path);
      await deleteMultipleFromCloudinary(imageUrls).catch(err => 
        console.error('Error cleaning up images:', err)
      );
    }
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Error creating activity',
      error: process.env.NODE_ENV === 'development' ? error.stack : 'Internal server error'
    });
  }
};

// @desc    Get all activities with filters
// @route   GET /api/activities
// @access  Private (Admin only)
exports.getAllActivities = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      category,
      city,
      state,
      minPrice,
      maxPrice,
      startDate,
      endDate,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (category) query.category = category;
    if (city) query.city = { $regex: city, $options: 'i' };
    if (state) query.state = { $regex: state, $options: 'i' };
    
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    
    if (startDate) query.startDate = { $gte: new Date(startDate) };
    if (endDate) query.endDate = { $lte: new Date(endDate) };
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { venue: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const activities = await Activity.find(query)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const totalCount = await Activity.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        activities,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(totalCount / limit),
          totalItems: totalCount,
          itemsPerPage: Number(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching activities',
      error: error.message
    });
  }
};

// @desc    Get single activity by ID
// @route   GET /api/activities/:id
// @access  Private
exports.getActivityById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid activity ID'
      });
    }

    const activity = await Activity.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found'
      });
    }

    res.status(200).json({
      success: true,
      data: activity
    });

  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching activity',
      error: error.message
    });
  }
};

// @desc    Update activity
// @route   PUT /api/activities/:id
// @access  Private (Admin only)
exports.updateActivity = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid activity ID'
      });
    }

    const activity = await Activity.findById(id);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found'
      });
    }

    const oldImages = [...activity.images];
    const updateData = { ...req.body };
    
    // Helper function to safely parse JSON
    const safeParseJSON = (data, fieldName, defaultValue = []) => {
      if (!data) return defaultValue;
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        return Array.isArray(parsed) ? parsed.filter(item => item && item.trim()) : defaultValue;
      } catch (e) {
        console.warn(`Warning: Could not parse ${fieldName}, using default`);
        return defaultValue;
      }
    };

    // Parse array fields
    ['availableDays', 'prerequisites', 'inclusions', 'exclusions', 'thingsToCarry', 'safetyGuidelines']
      .forEach(field => {
        if (updateData[field]) {
          updateData[field] = safeParseJSON(updateData[field], field);
        }
      });

    // Parse time slots
    if (updateData.timeSlots) {
      try {
        const slots = typeof updateData.timeSlots === 'string' ? JSON.parse(updateData.timeSlots) : updateData.timeSlots;
        updateData.timeSlots = slots.map(slot => ({
          startTime: String(slot.startTime).trim(),
          endTime: String(slot.endTime).trim(),
          availableSpots: Number(slot.availableSpots)
        }));
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid time slots format'
        });
      }
    }

    // Convert numeric fields
    ['duration', 'price', 'discountPercentage', 'maxParticipants', 'maxParticipantsPerSlot', 'minAge', 'maxAge']
      .forEach(field => {
        if (updateData[field]) {
          updateData[field] = Number(updateData[field]);
        }
      });

    if (req.files && req.files.length > 0) {
      updateData.images = req.files.map(file => file.path);
      updateData.thumbnailImage = req.files[0].path;
      
      if (req.body.replaceImages === 'true' && oldImages.length > 0) {
        await deleteMultipleFromCloudinary(oldImages).catch(err =>
          console.error('Error deleting old images:', err)
        );
      }
    }

    if (updateData.organizerName || updateData.organizerContact || updateData.organizerEmail) {
      updateData.organizer = {
        name: updateData.organizerName || activity.organizer?.name,
        contactNumber: updateData.organizerContact || activity.organizer?.contactNumber,
        email: updateData.organizerEmail || activity.organizer?.email
      };
      delete updateData.organizerName;
      delete updateData.organizerContact;
      delete updateData.organizerEmail;
    }

    if (updateData.latitude || updateData.longitude) {
      updateData.locationCoordinates = {
        latitude: updateData.latitude ? Number(updateData.latitude) : activity.locationCoordinates?.latitude,
        longitude: updateData.longitude ? Number(updateData.longitude) : activity.locationCoordinates?.longitude
      };
      delete updateData.latitude;
      delete updateData.longitude;
    }

    updateData.updatedBy = req.user._id;

    const updatedActivity = await Activity.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Activity updated successfully',
      data: updatedActivity
    });

  } catch (error) {
    console.error('Error updating activity:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Error updating activity',
      error: error.message
    });
  }
};

// Keep all other methods the same (deleteActivity, changeActivityStatus, etc.)
exports.deleteActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { hardDelete } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid activity ID'
      });
    }

    const activity = await Activity.findById(id);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found'
      });
    }

    if (hardDelete === 'true') {
      if (activity.images && activity.images.length > 0) {
        await deleteMultipleFromCloudinary(activity.images).catch(err =>
          console.error('Error deleting images from Cloudinary:', err)
        );
      }
      
      await Activity.findByIdAndDelete(id);
    } else {
      await Activity.findByIdAndUpdate(id, {
        status: 'Cancelled',
        isAvailable: false,
        updatedBy: req.user._id
      });
    }

    res.status(200).json({
      success: true,
      message: hardDelete === 'true' 
        ? 'Activity permanently deleted successfully' 
        : 'Activity soft deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting activity',
      error: error.message
    });
  }
};

exports.changeActivityStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid activity ID'
      });
    }

    if (!['Active', 'Inactive', 'Draft', 'Cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const activity = await Activity.findByIdAndUpdate(
      id,
      { 
        status,
        isAvailable: status === 'Active',
        updatedBy: req.user._id
      },
      { new: true }
    );

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Activity status updated successfully',
      data: activity
    });

  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating status',
      error: error.message
    });
  }
};

exports.getActivityStats = async (req, res) => {
  try {
    const totalActivities = await Activity.countDocuments();
    const activeActivities = await Activity.countDocuments({ status: 'Active' });
    const inactiveActivities = await Activity.countDocuments({ status: 'Inactive' });
    const draftActivities = await Activity.countDocuments({ status: 'Draft' });
    
    const bookingsData = await Activity.aggregate([
      {
        $group: {
          _id: null,
          totalBookings: { $sum: '$totalBookings' },
          totalRevenue: { $sum: { $multiply: ['$totalBookings', '$priceAfterDiscount'] } }
        }
      }
    ]);

    const categoryStats = await Activity.aggregate([
      { $match: { status: 'Active' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalActivities,
          activeActivities,
          inactiveActivities,
          draftActivities,
          totalBookings: bookingsData[0]?.totalBookings || 0,
          totalRevenue: bookingsData[0]?.totalRevenue || 0
        },
        categoryStats
      }
    });

  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
};

exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { activityIds, status } = req.body;

    if (!activityIds || !Array.isArray(activityIds) || activityIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Activity IDs array is required'
      });
    }

    if (!['Active', 'Inactive', 'Draft', 'Cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const result = await Activity.updateMany(
      { _id: { $in: activityIds } },
      { 
        status,
        isAvailable: status === 'Active',
        updatedBy: req.user._id
      }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} activities updated successfully`,
      data: {
        modifiedCount: result.modifiedCount
      }
    });

  } catch (error) {
    console.error('Error in bulk update:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating activities',
      error: error.message
    });
  }
};

exports.getActivitiesByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 10 } = req.query;

    const activities = await Activity.find({
      category,
      status: 'Active',
      isAvailable: true
    })
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: activities
    });

  } catch (error) {
    console.error('Error fetching activities by category:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching activities',
      error: error.message
    });
  }
};

exports.checkAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, timeSlot } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid activity ID'
      });
    }

    const activity = await Activity.findById(id);
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

    const requestedDate = new Date(date);
    if (requestedDate < activity.startDate || requestedDate > activity.endDate) {
      return res.status(400).json({
        success: false,
        message: 'Activity is not available on this date'
      });
    }

    const slot = activity.timeSlots.find(s => s.startTime === timeSlot);
    if (!slot) {
      return res.status(400).json({
        success: false,
        message: 'Invalid time slot'
      });
    }

    const isAvailable = slot.availableSpots > 0;

    res.status(200).json({
      success: true,
      data: {
        isAvailable,
        availableSpots: slot.availableSpots,
        timeSlot: slot
      }
    });

  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking availability',
      error: error.message
    });
  }
};