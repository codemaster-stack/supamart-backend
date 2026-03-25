const express = require('express');
const router = express.Router();
const {
  placeOrder,
  getBuyerOrders,
  getSellerOrders,
  getOrder,
  confirmDelivery,
  raiseDispute,
  markShipped
} = require('../controllers/orderController');
const { protect, requireRole } = require('../middleware/authMiddleware');

// All routes require login
router.post('/', protect, requireRole('buyer'), placeOrder);
router.get('/buyer', protect, requireRole('buyer'), getBuyerOrders);
router.get('/seller', protect, requireRole('seller'), getSellerOrders);
router.get('/:id', protect, getOrder);
router.patch('/:id/confirm-delivery', protect, requireRole('buyer'), confirmDelivery);
router.patch('/:id/dispute', protect, requireRole('buyer'), raiseDispute);
router.patch('/:id/ship', protect, requireRole('seller'), markShipped);

module.exports = router;