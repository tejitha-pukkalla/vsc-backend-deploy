const express = require('express');
const {
  register,
  login,
  getMe,
  logout,
  getAllUsers,
  updateUser,
  deleteUser
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/login', login);
router.post('/logout', logout);

// Protected routes (All authenticated users)
router.get('/me', protect, getMe);

// Super Admin only routes
router.post('/register', protect, authorize('superadmin'), register);
// router.post('/register', register);
router.get('/users', protect, authorize('superadmin'), getAllUsers);
router.put('/users/:id', protect, authorize('superadmin'), updateUser);
router.delete('/users/:id', protect, authorize('superadmin'), deleteUser);

module.exports = router;