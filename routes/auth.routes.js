const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);

// One-time admin setup route
router.post('/make-admin', async (req, res) => {
  try {
    const { email, setupKey } = req.body;

    // Validate setup key
    const SETUP_KEY = 'supamart-admin-2024';
    if (setupKey !== SETUP_KEY) {
      return res.status(403).json({ message: 'Invalid setup key' });
    }

    const User = require('../models/User');

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.role = 'admin';
    await user.save();

    res.status(200).json({
      message: 'Admin account created successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Make admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;