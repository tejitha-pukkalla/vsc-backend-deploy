const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
// app.use(cors());
app.use(cors({
  origin: [
    'https://vsc-admin-deploy.onrender.com',  // Your frontend URL
    'http://localhost:5173',                   // Local Vite dev server
    'http://localhost:5000'                    // Local alternative port
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/activities', require('./routes/activityRoutes')); 
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/qr', require('./routes/qrRoutes'));
app.use('/api/contact', require('./routes/contactRoutes'));

// Test route
app.get('/', (req, res) => {
  res.json({ 
    message: '🏟️ Sports Stadium API is running!',
    endpoints: {
      auth: '/api/auth',
      activities: '/api/activities',
      bookings: '/api/bookings',
      payments: '/api/payments',
      qr: '/api/qr',
      contact: '/api/contact'
    }
  });
});

// Health check route with Cloudinary status
app.get('/health', (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'Server is running',
    database: 'connected',
    cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? 'configured' : ' not configured'
  });
});

// 404 handler - must be after all routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler - must be last
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Multer file upload errors
  if (err.message && err.message.includes('Only image files')) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  
  // File size limit error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File size too large. Maximum size is 10MB'
    });
  }
  
  // Cloudinary errors
  if (err.message && err.message.includes('Cloudinary')) {
    return res.status(500).json({
      success: false,
      message: 'Error uploading to cloud storage',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }

  // MongoDB errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n Server running on port ${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: Connected`);
  console.log(`  Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? ' Connected' : ' Not configured'}`);
  console.log(`\n Available Routes:`);
  console.log(`   - GET  /`);
  console.log(`   - GET  /health`);
  console.log(`   - POST /api/auth/...`);
  console.log(`   - ALL  /api/activities/...`);
  console.log(`   - ALL  /api/bookings/...`);
  console.log(`   - ALL  /api/payments/...`);
  console.log(`\n`);
});