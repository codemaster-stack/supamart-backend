const Wallet = require('../models/Wallet');
const {
  initializePayment,
  verifyPayment,
  generateReference
} = require('../services/paystackService');

// ─── GET MY WALLETS ───────────────────────────────────────
const getMyWallets = async (req, res) => {
  try {
    const wallets = await Wallet.find({ userId: req.user.id });

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

// ─── INITIALIZE WALLET FUNDING via Paystack ───────────────
// POST /api/wallets/fund-initialize
const initializeWalletFunding = async (req, res) => {
  try {
    const { currency, amount } = req.body;

    if (!currency || !amount || amount <= 0) {
      return res.status(400).json({
        message: 'Valid currency and amount required'
      });
    }

    // Only NGN for now via Paystack
    if (currency !== 'NGN') {
      return res.status(400).json({
        message: 'Only NGN wallet funding is available via card at this time'
      });
    }

    const reference = generateReference(req.user.id);

    const metadata = {
      type: 'wallet_funding',
      userId: req.user.id,
      currency,
      amount: Number(amount)
    };

    const callbackUrl =
      `${process.env.CLIENT_URL}/pages/buyer/wallet-verify.html` +
      `?reference=${reference}`;

    const paystackResponse = await initializePayment({
      email: req.user.email,
      amount: Number(amount),
      currency,
      reference,
      metadata,
      callbackUrl
    });

    res.status(200).json({
      message: 'Wallet funding initialized',
      authorizationUrl: paystackResponse.data.authorization_url,
      reference
    });

  } catch (error) {
    console.error('Wallet fund init error:', error.message);
    res.status(500).json({
      message: error.message || 'Failed to initialize wallet funding'
    });
  }
};

// ─── VERIFY WALLET FUNDING ────────────────────────────────
// POST /api/wallets/fund-verify
const verifyWalletFunding = async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({ message: 'Reference required' });
    }

    const paystackResponse = await verifyPayment(reference);

    if (paystackResponse.data.status !== 'success') {
      return res.status(400).json({
        message: 'Payment not successful'
      });
    }

    const metadata = paystackResponse.data.metadata;

    if (metadata.type !== 'wallet_funding') {
      return res.status(400).json({ message: 'Invalid payment type' });
    }

    const { userId, currency, amount } = metadata;

    // Prevent double funding
    const existingTx = await Wallet.findOne({
      userId,
      lastFundingReference: reference
    });

    if (existingTx) {
      return res.status(200).json({
        message: 'Wallet already funded for this transaction'
      });
    }

    let wallet = await Wallet.findOne({ userId, currency });

    if (!wallet) {
      wallet = await Wallet.create({ userId, currency, balance: 0 });
    }

    wallet.balance += Number(amount);
    wallet.lastFundingReference = reference;
    await wallet.save();

    res.status(200).json({
      message: `${currency} wallet funded successfully`,
      newBalance: wallet.balance,
      currency
    });

  } catch (error) {
    console.error('Wallet verify error:', error.message);
    res.status(500).json({
      message: error.message || 'Failed to verify wallet funding'
    });
  }
};

// ─── TEST TOP-UP (development only) ──────────────────────
const fundWallet = async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        message: 'Direct funding not allowed in production'
      });
    }

    const { currency, amount } = req.body;

    if (!currency || !amount || amount <= 0) {
      return res.status(400).json({
        message: 'Valid currency and amount required'
      });
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

module.exports = {
  getMyWallets,
  initializeWalletFunding,
  verifyWalletFunding,
  fundWallet
};