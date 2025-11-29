const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: [true, 'Activity title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['Adventure Parks', 'Adventure', 'Water Sports', 'Air Sports', 'Team Sports', 'Individual Sports', 'Fitness', 'Other'],
      message: '{VALUE} is not a valid category'
    }
  },
  
  // Location Details
  venue: {
    type: String,
    required: [true, 'Venue is required']
  },
  address: {
    type: String,
    required: [true, 'Address is required']
  },
  city: {
    type: String,
    required: [true, 'City is required']
  },
  state: {
    type: String,
    required: [true, 'State is required']
  },
  pincode: {
    type: String,
    required: [true, 'Pincode is required'],
    match: [/^[0-9]{6}$/, 'Please provide a valid 6-digit pincode']
  },
  locationCoordinates: {
    latitude: { type: Number },
    longitude: { type: Number }
  },
  
  // Date & Time
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
    // ✅ REMOVED the problematic validator - we'll handle this in controller
  },
  duration: {
    type: Number,
    required: [true, 'Duration is required'],
    min: [1, 'Duration must be at least 1 minute']
  },
  availableDays: [{
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  }],
  timeSlots: [{
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    availableSpots: { type: Number, required: true, min: 1 }
  }],
  
  // Pricing
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  currency: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD', 'EUR']
  },
  discountPercentage: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative'],
    max: [100, 'Discount cannot exceed 100%']
  },
  priceAfterDiscount: {
    type: Number
  },
  
  // Booking Details
  maxParticipants: {
    type: Number,
    required: [true, 'Max participants is required'],
    min: [1, 'Must allow at least 1 participant']
  },
  minAge: {
    type: Number,
    min: [0, 'Age cannot be negative']
  },
  maxAge: {
    type: Number
    // ✅ REMOVED problematic validator - we'll handle this in controller
  },
  prerequisites: [String],
  
  // Media
  images: [{
    type: String
  }],
  thumbnailImage: {
    type: String
  },
  videoUrl: {
    type: String,
    match: [/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|vimeo\.com)/, 'Please provide a valid video URL']
  },
  
  // Additional Information
  inclusions: [String],
  exclusions: [String],
  thingsToCarry: [String],
  safetyGuidelines: [String],
  cancellationPolicy: String,
  termsAndConditions: String,
  
  // Status & Metadata
  status: {
    type: String,
    enum: {
      values: ['Active', 'Inactive', 'Draft', 'Cancelled'],
      message: '{VALUE} is not a valid status'
    },
    default: 'Draft'
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  totalBookings: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  
  // Organizer Details
  organizer: {
    name: String,
    contactNumber: {
      type: String,
      match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit contact number']
    },
    email: {
      type: String,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    }
  },
  
  // Admin tracking
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// ✅ Pre-save middleware for CREATE operations (when creating new documents)
activitySchema.pre('save', function() {
  // Calculate discounted price
  if (this.price != null && this.discountPercentage != null) {
    this.priceAfterDiscount = this.price - (this.price * this.discountPercentage) / 100;
  }
  
  // Validate date range (works for CREATE)
  if (this.endDate && this.startDate && this.endDate < this.startDate) {
    throw new Error('End date must be after start date');
  }
  
  // Validate age range (works for CREATE)
  if (this.minAge && this.maxAge && this.maxAge < this.minAge) {
    throw new Error('Max age must be greater than or equal to min age');
  }
});

//  Pre-update middleware for UPDATE operations
activitySchema.pre('findOneAndUpdate', async function() {
  try {
    const update = this.getUpdate();
    
    // Get the current document
    const docToUpdate = await this.model.findOne(this.getQuery());
    
    if (!docToUpdate) {
      return;
    }
    
    // Get the values (either from update or current document)
    const startDate = update.startDate || docToUpdate.startDate;
    const endDate = update.endDate || docToUpdate.endDate;
    const minAge = update.minAge !== undefined ? update.minAge : docToUpdate.minAge;
    const maxAge = update.maxAge !== undefined ? update.maxAge : docToUpdate.maxAge;
    
    // Validate date range
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (end < start) {
        throw new Error('End date must be after start date');
      }
    }
    
    // Validate age range
    if (minAge != null && maxAge != null && maxAge < minAge) {
      throw new Error('Max age must be greater than or equal to min age');
    }
    
    // Calculate discounted price if price or discount changes
    if (update.price !== undefined || update.discountPercentage !== undefined) {
      const price = update.price !== undefined ? update.price : docToUpdate.price;
      const discount = update.discountPercentage !== undefined ? update.discountPercentage : docToUpdate.discountPercentage;
      
      if (price != null && discount != null) {
        update.priceAfterDiscount = price - (price * discount) / 100;
      }
    }
  } catch (error) {
    throw error;
  }
});

// Indexes for better query performance
activitySchema.index({ title: 'text', description: 'text' });
activitySchema.index({ category: 1, status: 1 });
activitySchema.index({ city: 1, state: 1 });
activitySchema.index({ startDate: 1, endDate: 1 });
activitySchema.index({ price: 1 });

module.exports = mongoose.model('Activity', activitySchema);