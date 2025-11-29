const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

// ========================================
// ✅ PUBLIC ROUTES (No authentication)
// ========================================

// Get activities by category (Public)
router.get('/category/:category', activityController.getActivitiesByCategory);

// Check availability (Public)
router.post('/:id/check-availability', activityController.checkAvailability);

// ========================================
// 🔒 PROTECTED ROUTES (Authentication required)
// ========================================

// Create new activity (Admin + Manager)
router.post(
  '/',
  protect,  // ✅ Apply middleware individually
  authorize('superadmin', 'manager'),
  upload.array('images', 10),
  activityController.createActivity
);

// Get all activities (Admin, Manager, Accountant)
router.get(
  '/', 
  protect,  // ✅ Apply middleware individually
  authorize('superadmin', 'manager', 'accountant'),
  activityController.getAllActivities
);

// Get activity statistics (Admin, Manager, Accountant)
router.get(
  '/stats/overview', 
  protect,  // ✅ Apply middleware individually
  authorize('superadmin', 'manager', 'accountant'),
  activityController.getActivityStats
);

// Bulk update status (Admin + Manager)
router.patch(
  '/bulk/status', 
  protect,  // ✅ Apply middleware individually
  authorize('superadmin', 'manager'),
  activityController.bulkUpdateStatus
);

// Get single activity by ID (Protected - All authenticated users)
router.get(
  '/:id',
  protect,  // ✅ Apply middleware individually
  activityController.getActivityById
);

// Update activity (Admin + Manager)
router.put(
  '/:id',
  protect,  // ✅ Apply middleware individually
  authorize('superadmin', 'manager'),
  upload.array('images', 10),
  activityController.updateActivity
);

// Delete activity (Super Admin only)
router.delete(
  '/:id', 
  protect,  // ✅ Apply middleware individually
  authorize('superadmin'),
  activityController.deleteActivity
);

// Change activity status (Admin + Manager)
router.patch(
  '/:id/status', 
  protect,  // ✅ Apply middleware individually
  authorize('superadmin', 'manager'),
  activityController.changeActivityStatus
);

module.exports = router;