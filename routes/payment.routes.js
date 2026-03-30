const express = require('express');
const router = express.Router();
const {
  initializeCardPayment,
  initializeBankTransfer,
  verifyCardPayment,
  paystackWebhook
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// Webhook — no auth needed
router.post('/webhook', paystackWebhook);

// Protected routes
router.post('/initialize', protect, initializeCardPayment);
router.post('/bank-transfer', protect, initializeBankTransfer);
router.post('/verify', protect, verifyCardPayment);

module.exports = router;