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
const {
  getDeliveryFee,
  canDeliverToCountry
} = require('../services/deliveryService');

// GET /api/orders/delivery-fee
router.get('/delivery-fee', protect, async (req, res) => {
  try {
    const { storeId, currency } = req.query;
    const Store = require('../models/Store');

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const buyerCountry = req.user.countryCode || 'NG';
    const sellerCountry = store.countryCode || 'NG';

    const canDeliver = canDeliverToCountry(sellerCountry, buyerCountry);

    if (!canDeliver) {
      return res.status(200).json({
        canDeliver: false,
        message: `This seller only delivers within ${store.country || 'their country'}`
      });
    }

    const fees = getDeliveryFee(sellerCountry, currency || 'NGN');

    res.status(200).json({
      canDeliver: true,
      fees,
      sellerCountry,
      buyerCountry
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// All routes require login
router.post('/', protect, requireRole('buyer'), placeOrder);
router.get('/buyer', protect, requireRole('buyer'), getBuyerOrders);
router.get('/seller', protect, requireRole('seller'), getSellerOrders);
router.get('/:id', protect, getOrder);
router.patch('/:id/confirm-delivery', protect, requireRole('buyer'), confirmDelivery);
router.patch('/:id/dispute', protect, requireRole('buyer'), raiseDispute);
router.patch('/:id/ship', protect, requireRole('seller'), markShipped);

module.exports = router;