const Order = require('../models/Order');
const Product = require('../models/Product');
const Store = require('../models/Store');
const Escrow = require('../models/Escrow');
const Wallet = require('../models/Wallet');
const Notification = require('../models/Notification');
const { getExchangeRates, computePrice } = require('../services/currencyService');
const {
  canDeliverToCountry,
  getDeliveryFee
} = require('../services/deliveryService');

// ─── PLACE ORDER ──────────────────────────────────────────
// POST /api/orders
const placeOrder = async (req, res) => {
  try {
    const { productId, quantity, currency } = req.body;

    if (!productId || !currency) {
      return res.status(400).json({
        message: 'Product and currency are required'
      });
    }

    const validCurrencies = ['NGN', 'USD', 'GBP', 'EUR'];
    if (!validCurrencies.includes(currency)) {
      return res.status(400).json({ message: 'Invalid currency' });
    }

    // Get product
    const product = await Product.findById(productId)
      .populate('storeId');

    if (!product || !product.isActive) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Prevent seller buying own product
    if (product.sellerId.toString() === req.user.id) {
      return res.status(400).json({
        message: 'You cannot buy your own product'
      });
    }

    const qty = parseInt(quantity) || 1;

    // Compute final price
    const rates = await getExchangeRates();
    const unitPrice = computePrice(product.basePriceNGN, currency, rates);
    const totalAmount = unitPrice * qty;

             

    // Check buyer wallet balance
 // Check buyer and seller are in same country
    const buyerCountry = req.user.countryCode || 'NG';
    const sellerStore = await Store.findOne({
      userId: product.sellerId
    });
    const sellerCountry = sellerStore?.countryCode || 'NG';

    if (!canDeliverToCountry(sellerCountry, buyerCountry)) {
      return res.status(400).json({
        message: `This seller only delivers within ${sellerStore?.country || 'their country'}. International shipping is not available yet.`
      });
    }

    // Get delivery fee
    const deliveryFees = getDeliveryFee(sellerCountry, currency);
    const deliveryFee = req.body.deliveryType === 'within_city'
      ? deliveryFees.withinCity
      : req.body.deliveryType === 'within_state'
        ? deliveryFees.withinState
        : deliveryFees.withinCountry;

    // Add delivery fee to total
    const totalWithDelivery = totalAmount + deliveryFee;

    // Check buyer wallet balance
    const buyerWallet = await Wallet.findOne({
      userId: req.user.id,
      currency
    });

    if (!buyerWallet || buyerWallet.balance < totalWithDelivery) {
      return res.status(400).json({
        message: `Insufficient ${currency} wallet balance. Required: ${totalWithDelivery.toFixed(2)} (includes delivery fee of ${deliveryFee})`
      });
    }

    // Deduct from buyer wallet
    buyerWallet.balance -= totalWithDelivery;
    await buyerWallet.save();

    // Create order
   const order = await Order.create({
      buyerId: req.user.id,
      sellerId: product.sellerId,
      productId: product._id,
      quantity: qty,
      currency,
      amountPaid: totalAmount,
      deliveryFee,
      deliveryType: req.body.deliveryType || 'within_country',
      deliveryAddress: req.body.deliveryAddress || '',
      status: 'paid'
    });

    // Escrow holds product amount + delivery fee
    await Escrow.create({
      orderId: order._id,
      currency,
      amountHeld: totalWithDelivery,
      status: 'held'
    });

    // Notify seller
    await Notification.create({
      userId: product.sellerId,
      type: 'new_order',
      message: `New order for "${product.name}" — ${currency} ${totalAmount.toFixed(2)}. Funds are in escrow.`
    });

    res.status(201).json({
      message: 'Order placed successfully. Payment is held in escrow.',
      order
    });

    // Deduct stock
await Product.findByIdAndUpdate(
  product._id,
  { $inc: { stock: -qty } }
);

// Auto deactivate if out of stock
if (product.stock - qty <= 0) {
  await Product.findByIdAndUpdate(
    product._id,
    { isActive: false }
  );
}

  } catch (error) {
    console.error('Place order error:', error);
    res.status(500).json({ message: 'Server error while placing order' });
  }
};

// ─── GET BUYER ORDERS ─────────────────────────────────────
// GET /api/orders/buyer
const getBuyerOrders = async (req, res) => {
  try {
    const orders = await Order.find({ buyerId: req.user.id })
      .populate('productId', 'name images basePriceNGN')
      .populate('sellerId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ orders });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── GET SELLER ORDERS ────────────────────────────────────
// GET /api/orders/seller
const getSellerOrders = async (req, res) => {
  try {
    const orders = await Order.find({ sellerId: req.user.id })
      .populate('productId', 'name images')
      .populate('buyerId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({ orders });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── GET SINGLE ORDER ─────────────────────────────────────
// GET /api/orders/:id
const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('productId', 'name images basePriceNGN description')
      .populate('sellerId', 'name')
      .populate('buyerId', 'name email');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Only buyer or seller can view
    const isOwner =
      order.buyerId._id.toString() === req.user.id ||
      order.sellerId._id.toString() === req.user.id;

    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get escrow record
    const escrow = await Escrow.findOne({ orderId: order._id });

    res.status(200).json({ order, escrow });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── CONFIRM DELIVERY (Buyer) ─────────────────────────────
// PATCH /api/orders/:id/confirm-delivery
const confirmDelivery = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Only buyer can confirm
    if (order.buyerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the buyer can confirm delivery' });
    }

    if (order.status !== 'shipped' && order.status !== 'paid') {
      return res.status(400).json({
        message: `Cannot confirm delivery for order with status: ${order.status}`
      });
    }

    // Update order status
    order.status = 'completed';
    await order.save();

    // Release escrow to seller
    const escrow = await Escrow.findOne({ orderId: order._id });
    if (escrow && escrow.status === 'held') {
      escrow.status = 'released';
      escrow.releasedAt = new Date();
      await escrow.save();

      // Credit seller wallet
      let sellerWallet = await Wallet.findOne({
        userId: order.sellerId,
        currency: order.currency
      });

      if (!sellerWallet) {
        sellerWallet = await Wallet.create({
          userId: order.sellerId,
          currency: order.currency,
          balance: 0
        });
      }

      sellerWallet.balance += escrow.amountHeld;
      await sellerWallet.save();

      // Notify seller
      await Notification.create({
        userId: order.sellerId,
        type: 'funds_released',
        message: `Payment of ${order.currency} ${escrow.amountHeld.toFixed(2)} has been released to your wallet for order #${order._id.toString().slice(-6).toUpperCase()}.`
      });
    }

    res.status(200).json({
      message: 'Delivery confirmed. Funds released to seller.',
      order
    });

  } catch (error) {
    console.error('Confirm delivery error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── RAISE DISPUTE ────────────────────────────────────────
// PATCH /api/orders/:id/dispute
const raiseDispute = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.buyerId.toString() !== req.user.id) {
      return res.status(403).json({
        message: 'Only the buyer can raise a dispute'
      });
    }

    if (['completed', 'refunded', 'disputed'].includes(order.status)) {
      return res.status(400).json({ message: 'Cannot dispute this order' });
    }

    order.status = 'disputed';
    await order.save();

    await Escrow.findOneAndUpdate(
      { orderId: order._id },
      { status: 'disputed' }
    );

    // Create dispute record
    const Dispute = require('../models/Dispute');
    await Dispute.create({
      orderId: order._id,
      raisedBy: req.user.id,
      reason: reason || 'No reason provided',
      messages: [{
        senderId: req.user.id,
        senderName: req.user.name,
        senderRole: 'buyer',
        message: reason || 'Dispute raised by buyer'
      }]
    });

    // Notify seller
    await Notification.create({
      userId: order.sellerId,
      type: 'dispute_raised',
      message: `A dispute has been raised for order #${order._id.toString().slice(-6).toUpperCase()}. Admin will review.`
    });

    res.status(200).json({
      message: 'Dispute raised. Admin will review within 24 hours.',
      order
    });

  } catch (error) {
    console.error('Raise dispute error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
// ─── MARK AS SHIPPED (Seller) ─────────────────────────────
// PATCH /api/orders/:id/ship
const markShipped = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.sellerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (order.status !== 'paid') {
      return res.status(400).json({
        message: 'Order must be in paid status to mark as shipped'
      });
    }

    order.status = 'shipped';
    await order.save();

    // Notify buyer
    await Notification.create({
      userId: order.buyerId,
      type: 'order_shipped',
      message: `Your order #${order._id.toString().slice(-6).toUpperCase()} has been shipped! Please confirm delivery when received.`
    });

    res.status(200).json({
      message: 'Order marked as shipped',
      order
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  placeOrder,
  getBuyerOrders,
  getSellerOrders,
  getOrder,
  confirmDelivery,
  raiseDispute,
  markShipped
};