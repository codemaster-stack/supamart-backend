const express = require('express');
const router = express.Router();
const {
  getMyWallets,
  initializeWalletFunding,
  verifyWalletFunding,
  fundWallet
} = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getMyWallets);
router.post('/fund-initialize', protect, initializeWalletFunding);
router.post('/fund-verify', protect, verifyWalletFunding);
router.post('/fund', protect, fundWallet); // test only

module.exports = router;