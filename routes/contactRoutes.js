// backend/routes/contactRoutes.js
const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { protect, authorize } = require('../middleware/auth');

// ========================================
// PUBLIC ROUTES (No authentication)
// ========================================

// @route   POST /api/contact/submit
// @desc    Submit contact form (Public - Website visitors)
// @access  Public
router.post('/submit', contactController.submitContactForm);

// ========================================
// PROTECTED ROUTES (Authentication required)
// ========================================

// Get contact statistics (For dashboard)
router.get(
  '/stats',
  protect,
  authorize('superadmin', 'manager', 'accountant'),
  contactController.getContactStats
);

// Get all contacts with filters (Admin panel)
router.get(
  '/',
  protect,
  authorize('superadmin', 'manager', 'accountant'),
  contactController.getAllContacts
);

// ========================================
// DYNAMIC ROUTES (Must be after static routes)
// ========================================

// Get single contact by ID
router.get(
  '/:id',
  protect,
  authorize('superadmin', 'manager', 'accountant'),
  contactController.getContactById
);

// Update contact status and notes
router.put(
  '/:id',
  protect,
  authorize('superadmin', 'manager', 'accountant'),
  contactController.updateContact
);

// Delete contact (Admin only)
router.delete(
  '/:id',
  protect,
  authorize('superadmin'),
  contactController.deleteContact
);

// Bulk update contact status
router.patch(
  '/bulk/status',
  protect,
  authorize('superadmin', 'manager'),
  contactController.bulkUpdateStatus
);

module.exports = router;