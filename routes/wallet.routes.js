const express = require('express');
const router = express.Router();
const { getMyWallets, fundWallet } = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getMyWallets);
router.post('/fund', protect, fundWallet); // mock top-up for testing

module.exports = router;