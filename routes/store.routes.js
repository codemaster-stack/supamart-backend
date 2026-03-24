const express = require('express');
const router = express.Router();
const {
  createStore,
  getStoreBySlug,
  getMyStore,
  updateStore
} = require('../controllers/storeController');
const { protect, requireRole } = require('../middleware/authMiddleware');
const { uploadLogo } = require('../services/uploadService');

// Protected — seller only
router.post('/', protect, requireRole('seller'), uploadLogo.single('logo'), createStore);
router.get('/my-store', protect, requireRole('seller'), getMyStore);
router.put('/:id', protect, requireRole('seller'), uploadLogo.single('logo'), updateStore);

// Public
router.get('/:slug', getStoreBySlug);

module.exports = router;