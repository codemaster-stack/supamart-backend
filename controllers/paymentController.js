const Order = require('../models/Order');
const Product = require('../models/Product');
const Escrow = require('../models/Escrow');
const Wallet = require('../models/Wallet');
const Notification = require('../models/Notification');
const {
  initializePayment,
  verifyPayment,
  generateReference
} = require('../services/paystackService');
const { getExchangeRates, computePrice } = require('../services/currencyService');
const {
  initializePayment,
  verifyPayment,
  generateReference,
  createVirtualAccount
} = require('../services/paystackService');

// ─── INITIALIZE CARD PAYMENT ──────────────────────────────
// POST /api/payments/initialize
const initializeCardPayment = async (req, res) => {
  try {
    const { productId, quantity, currency } = req.body;

    if (!productId || !currency) {
      return res.status(400).json({
        message: 'Product and currency are required'
      });
    }

    // Only NGN supported on Paystack test for now
    // USD/GBP/EUR requires Paystack international
    const supportedCurrencies = ['NGN', 'USD', 'GBP', 'EUR'];
    if (!supportedCurrencies.includes(currency)) {
      return res.status(400).json({ message: 'Invalid currency' });
    }

    // Get product
    const product = await Product.findById(productId)
      .populate('storeId');

    if (!product || !product.isActive) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.sellerId.toString() === req.user.id) {
      return res.status(400).json({
        message: 'You cannot buy your own product'
      });
    }

    const qty = parseInt(quantity) || 1;

    // Compute price
    const rates = await getExchangeRates();
    const unitPrice = computePrice(product.basePriceNGN, currency, rates);
    const totalAmount = unitPrice * qty;

    // Generate unique reference
    const reference = generateReference(req.user.id);

    // Store pending order info in metadata
    const metadata = {
      userId: req.user.id,
      productId: product._id.toString(),
      quantity: qty,
      currency,
      totalAmount,
      productName: product.name,
      storeName: product.storeId?.businessName || 'Unknown Store'
    };

    // Initialize Paystack payment
    const callbackUrl =
      `${process.env.CLIENT_URL}/pages/checkout/verify.html?reference=${reference}`;

    const paystackResponse = await initializePayment({
      email: req.user.email,
      amount: totalAmount,
      currency,
      reference,
      metadata,
      callbackUrl
    });

    res.status(200).json({
      message: 'Payment initialized',
      authorizationUrl: paystackResponse.data.authorization_url,
      reference,
      amount: totalAmount,
      currency
    });

  } catch (error) {
    console.error('Initialize payment error:', error);
    res.status(500).json({
      message: error.message || 'Payment initialization failed'
    });
  }
};


// ─── INITIALIZE BANK TRANSFER ─────────────────────────────
// POST /api/payments/bank-transfer
const initializeBankTransfer = async (req, res) => {
  try {
    const { productId, quantity, currency } = req.body;

    if (!productId || !currency) {
      return res.status(400).json({
        message: 'Product and currency are required'
      });
    }

    // Bank transfer only works for NGN on Paystack
    if (currency !== 'NGN') {
      return res.status(400).json({
        message: 'Bank transfer is only available for NGN payments'
      });
    }

    const product = await Product.findById(productId)
      .populate('storeId');

    if (!product || !product.isActive) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.sellerId.toString() === req.user.id) {
      return res.status(400).json({
        message: 'You cannot buy your own product'
      });
    }

    const qty = parseInt(quantity) || 1;
    const rates = await getExchangeRates();
    const unitPrice = computePrice(product.basePriceNGN, currency, rates);
    const totalAmount = unitPrice * qty;

    const reference = generateReference(req.user.id);

    const metadata = {
      userId: req.user.id,
      productId: product._id.toString(),
      quantity: qty,
      currency,
      totalAmount,
      productName: product.name,
      storeName: product.storeId?.businessName || 'Unknown Store'
    };

    const callbackUrl =
      `${process.env.CLIENT_URL}/pages/checkout/verify.html?reference=${reference}`;

    const paystackResponse = await createVirtualAccount({
      email: req.user.email,
      amount: totalAmount,
      currency,
      reference,
      metadata,
      callbackUrl
    });

    // Extract bank transfer details from response
    const transferData = paystackResponse.data;

    res.status(200).json({
      message: 'Bank transfer initialized',
      reference,
      amount: totalAmount,
      currency,
      authorizationUrl: transferData.authorization_url,
      accessCode: transferData.access_code,
      transferDetails: {
        bank: transferData.bank?.name || 'See payment page',
        accountNumber: transferData.bank?.account_number || 'See payment page',
        accountName: transferData.bank?.account_name || 'Paystack',
        amount: totalAmount,
        expiresIn: '30 minutes'
      }
    });

  } catch (error) {
    console.error('Bank transfer init error:', error);
    res.status(500).json({
      message: error.message || 'Bank transfer initialization failed'
    });
  }
};

// ─── VERIFY CARD PAYMENT ──────────────────────────────────
// POST /api/payments/verify
const verifyCardPayment = async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({ message: 'Reference is required' });
    }

    // Verify with Paystack
    const paystackResponse = await verifyPayment(reference);

    if (paystackResponse.data.status !== 'success') {
      return res.status(400).json({
        message: 'Payment was not successful',
        status: paystackResponse.data.status
      });
    }

    const metadata = paystackResponse.data.metadata;
    const {
      userId,
      productId,
      quantity,
      currency,
      totalAmount
    } = metadata;

    // Prevent double processing
    const existingOrder = await Order.findOne({
      buyerId: userId,
      productId,
      paymentReference: reference
    });

    if (existingOrder) {
      return res.status(200).json({
        message: 'Order already processed',
        order: existingOrder
      });
    }

    // Get product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Create order
    const order = await Order.create({
      buyerId: userId,
      sellerId: product.sellerId,
      productId: product._id,
      quantity,
      currency,
      amountPaid: totalAmount,
      status: 'paid',
      paymentMethod: 'card',
      paymentReference: reference
    });

    // Create escrow
    await Escrow.create({
      orderId: order._id,
      currency,
      amountHeld: totalAmount,
      status: 'held'
    });

    // Notify seller
    await Notification.create({
      userId: product.sellerId,
      type: 'new_order',
      message: `New order for "${product.name}" — ${currency} ${totalAmount.toFixed(2)}. Payment verified via card. Funds in escrow.`
    });

    res.status(201).json({
      message: 'Payment verified and order created successfully',
      order
    });

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      message: error.message || 'Payment verification failed'
    });
  }
};

// ─── PAYSTACK WEBHOOK ─────────────────────────────────────
// POST /api/payments/webhook
const paystackWebhook = async (req, res) => {
  try {
    const crypto = require('crypto');
    const secret = process.env.PAYSTACK_SECRET_KEY;

    // Verify webhook signature
    const hash = crypto
      .createHmac('sha512', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      const reference = event.data.reference;
      const metadata = event.data.metadata;

      // Check if order already exists
      const existingOrder = await Order.findOne({
        paymentReference: reference
      });

      if (!existingOrder && metadata) {
        const {
          userId,
          productId,
          quantity,
          currency,
          totalAmount
        } = metadata;

        const product = await Product.findById(productId);

        if (product) {
          const order = await Order.create({
            buyerId: userId,
            sellerId: product.sellerId,
            productId: product._id,
            quantity,
            currency,
            amountPaid: totalAmount,
            status: 'paid',
            paymentMethod: 'card',
            paymentReference: reference
          });

          await Escrow.create({
            orderId: order._id,
            currency,
            amountHeld: totalAmount,
            status: 'held'
          });

          await Notification.create({
            userId: product.sellerId,
            type: 'new_order',
            message: `New order for "${product.name}" — ${currency} ${totalAmount.toFixed(2)} via card.`
          });
        }
      }
    }

    res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ message: 'Webhook error' });
  }
};

module.exports = {
  initializeCardPayment,
  initializeBankTransfer,
  verifyCardPayment,
  paystackWebhook
};