const Wallet = require('../models/Wallet');

// GET /api/wallets
const getMyWallets = async (req, res) => {
  try {
    const wallets = await Wallet.find({ userId: req.user.id });

    // Ensure all 4 currencies exist
    const currencies = ['NGN', 'USD', 'GBP', 'EUR'];
    const walletMap = {};
    wallets.forEach(w => { walletMap[w.currency] = w; });

    const result = currencies.map(currency => ({
      currency,
      balance: walletMap[currency]?.balance || 0,
      id: walletMap[currency]?._id || null
    }));

    res.status(200).json({ wallets: result });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/wallets/fund — for testing only (mock top-up)
const fundWallet = async (req, res) => {
  try {
    const { currency, amount } = req.body;

    if (!currency || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid currency and amount required' });
    }

    let wallet = await Wallet.findOne({
      userId: req.user.id,
      currency
    });

    if (!wallet) {
      wallet = await Wallet.create({
        userId: req.user.id,
        currency,
        balance: 0
      });
    }

    wallet.balance += Number(amount);
    await wallet.save();

    res.status(200).json({
      message: `${currency} wallet funded successfully`,
      wallet
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getMyWallets, fundWallet };