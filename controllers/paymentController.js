const Order = require('../models/Order');
const Product = require('../models/Product');
const Escrow = require('../models/Escrow');
const Wallet = require('../models/Wallet');
const Notification = require('../models/Notification');
const paystackService = require('../services/paystackService');
const {
  getExchangeRates,
  computePrice
} = require('../services/currencyService');

// ─── INITIALIZE CARD PAYMENT ──────────────────────────────
const initializeCardPayment = async (req, res) => {
  try {
    const { productId, quantity, currency } = req.body;

    if (!productId || !currency) {
      return res.status(400).json({
        message: 'Product and currency are required'
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
    const reference = paystackService.generateReference(req.user.id);

    const metadata = {
      userId: req.user.id,
      productId: product._id.toString(),
      quantity: qty,
      currency,
      totalAmount,
      productName: product.name,
      storeName: product.storeId?.businessName || ''
    };

    const callbackUrl =
      `${process.env.CLIENT_URL}/pages/checkout/verify.html` +
      `?reference=${reference}`;

    const paystackResponse = await paystackService.initializePayment({
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
    console.error('Initialize card payment error:', error.message);
    res.status(500).json({
      message: error.message || 'Payment initialization failed'
    });
  }
};

// ─── INITIALIZE BANK TRANSFER ─────────────────────────────
const initializeBankTransfer = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const currency = 'NGN';

    if (!productId) {
      return res.status(400).json({ message: 'Product is required' });
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
    const reference = paystackService.generateReference(req.user.id);

    const metadata = {
      userId: req.user.id,
      productId: product._id.toString(),
      quantity: qty,
      currency,
      totalAmount,
      productName: product.name,
      storeName: product.storeId?.businessName || ''
    };

    const callbackUrl =
      `${process.env.CLIENT_URL}/pages/checkout/verify.html` +
      `?reference=${reference}`;

    const paystackResponse = await paystackService.createVirtualAccount({
      email: req.user.email,
      amount: totalAmount,
      currency,
      reference,
      metadata,
      callbackUrl
    });

    res.status(200).json({
      message: 'Bank transfer initialized',
      authorizationUrl: paystackResponse.data.authorization_url,
      reference,
      amount: totalAmount,
      currency,
      accessCode: paystackResponse.data.access_code
    });

  } catch (error) {
    console.error('Bank transfer error:', error.message);
    res.status(500).json({
      message: error.message || 'Bank transfer initialization failed'
    });
  }
};

// ─── VERIFY PAYMENT ───────────────────────────────────────
const verifyCardPayment = async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({ message: 'Reference is required' });
    }

    const paystackResponse = await paystackService.verifyPayment(reference);

    if (paystackResponse.data.status !== 'success') {
      return res.status(400).json({
        message: 'Payment was not successful',
        status: paystackResponse.data.status
      });
    }

    const metadata = paystackResponse.data.metadata;

    if (!metadata || !metadata.productId) {
      return res.status(400).json({
        message: 'Invalid payment metadata'
      });
    }

    const { userId, productId, quantity, currency, totalAmount } = metadata;

    // Prevent double processing
    const existingOrder = await Order.findOne({
      paymentReference: reference
    });

    if (existingOrder) {
      return res.status(200).json({
        message: 'Order already processed',
        order: existingOrder
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

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
      message: `New order for "${product.name}" — ${currency} ${totalAmount.toFixed(2)} via card. Funds in escrow.`
    });

    res.status(201).json({
      message: 'Payment verified and order created successfully',
      order
    });

  } catch (error) {
    console.error('Verify payment error:', error.message);
    res.status(500).json({
      message: error.message || 'Payment verification failed'
    });
  }
};

// ─── PAYSTACK WEBHOOK ─────────────────────────────────────
const paystackWebhook = async (req, res) => {
  try {
    const crypto = require('crypto');
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const body = JSON.stringify(req.body);

    const hash = crypto
      .createHmac('sha512', secret)
      .update(body)
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      const reference = event.data.reference;
      const metadata = event.data.metadata;

      const existingOrder = await Order.findOne({
        paymentReference: reference
      });

      if (!existingOrder && metadata && metadata.productId) {
        const { userId, productId, quantity, currency, totalAmount } = metadata;
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
            message: `New order for "${product.name}" — payment confirmed via webhook.`
          });
        }
      }
    }

    res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error.message);
    res.status(200).json({ received: true });
  }
};

module.exports = {
  initializeCardPayment,
  initializeBankTransfer,
  verifyCardPayment,
  paystackWebhook
};