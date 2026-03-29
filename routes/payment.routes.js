const express = require('express');
const router = express.Router();
const {
  initializeCardPayment,
  initializeBankTransfer,
  verifyCardPayment,
  paystackWebhook
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// Webhook — raw body no auth
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  paystackWebhook
);

// Protected routes
router.post('/initialize', protect, initializeCardPayment);
router.post('/bank-transfer', protect, initializeBankTransfer);
router.post('/verify', protect, verifyCardPayment);

module.exports = router;