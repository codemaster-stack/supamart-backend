const User = require('../models/User');
const Store = require('../models/Store');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Escrow = require('../models/Escrow');
const Wallet = require('../models/Wallet');
const Notification = require('../models/Notification');

// ─── DASHBOARD STATS ──────────────────────────────────────
const getStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalSellers,
      totalProducts,
      totalOrders,
      disputedOrders,
      heldEscrow
    ] = await Promise.all([
      User.countDocuments({ role: 'buyer' }),
      User.countDocuments({ role: 'seller' }),
      Product.countDocuments({ isActive: true }),
      Order.countDocuments(),
      Order.countDocuments({ status: 'disputed' }),
      Escrow.countDocuments({ status: 'held' })
    ]);

    res.status(200).json({
      stats: {
        totalUsers,
        totalSellers,
        totalProducts,
        totalOrders,
        disputedOrders,
        heldEscrow
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── GET ALL USERS ────────────────────────────────────────
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── BAN / UNBAN USER ─────────────────────────────────────
const toggleBanUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Cannot ban admin accounts' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      message: `User ${user.isActive ? 'unbanned' : 'banned'} successfully`,
      user
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── GET ALL ORDERS ───────────────────────────────────────
const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('buyerId', 'name email')
      .populate('sellerId', 'name email')
      .populate('productId', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json({ orders });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── GET ALL ESCROW ───────────────────────────────────────
const getAllEscrow = async (req, res) => {
  try {
    const escrows = await Escrow.find()
      .populate({
        path: 'orderId',
        populate: [
          { path: 'buyerId', select: 'name email' },
          { path: 'sellerId', select: 'name email' },
          { path: 'productId', select: 'name' }
        ]
      })
      .sort({ createdAt: -1 });
    res.status(200).json({ escrows });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── RELEASE ESCROW ───────────────────────────────────────
const releaseEscrow = async (req, res) => {
  try {
    const escrow = await Escrow.findById(req.params.id)
      .populate('orderId');

    if (!escrow) {
      return res.status(404).json({ message: 'Escrow record not found' });
    }

    if (escrow.status !== 'held' && escrow.status !== 'disputed') {
      return res.status(400).json({
        message: `Escrow is already ${escrow.status}`
      });
    }

    const order = escrow.orderId;

    // Credit seller wallet
    let sellerWallet = await Wallet.findOne({
      userId: order.sellerId,
      currency: escrow.currency
    });

    if (!sellerWallet) {
      sellerWallet = await Wallet.create({
        userId: order.sellerId,
        currency: escrow.currency,
        balance: 0
      });
    }

    sellerWallet.balance += escrow.amountHeld;
    await sellerWallet.save();

    escrow.status = 'released';
    escrow.releasedAt = new Date();
    await escrow.save();

    order.status = 'completed';
    await order.save();

    // Notify seller
    await Notification.create({
      userId: order.sellerId,
      type: 'funds_released',
      message: `Admin released ${escrow.currency} ${escrow.amountHeld.toFixed(2)} to your wallet.`
    });

    res.status(200).json({
      message: 'Escrow released to seller successfully'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── REFUND ESCROW (to buyer) ─────────────────────────────
const refundEscrow = async (req, res) => {
  try {
    const escrow = await Escrow.findById(req.params.id)
      .populate('orderId');

    if (!escrow) {
      return res.status(404).json({ message: 'Escrow record not found' });
    }

    if (escrow.status !== 'held' && escrow.status !== 'disputed') {
      return res.status(400).json({
        message: `Escrow is already ${escrow.status}`
      });
    }

    const order = escrow.orderId;

    // Refund buyer wallet
    let buyerWallet = await Wallet.findOne({
      userId: order.buyerId,
      currency: escrow.currency
    });

    if (!buyerWallet) {
      buyerWallet = await Wallet.create({
        userId: order.buyerId,
        currency: escrow.currency,
        balance: 0
      });
    }

    buyerWallet.balance += escrow.amountHeld;
    await buyerWallet.save();

    escrow.status = 'refunded';
    escrow.releasedAt = new Date();
    await escrow.save();

    order.status = 'refunded';
    await order.save();

    // Notify buyer
    await Notification.create({
      userId: order.buyerId,
      type: 'refund_issued',
      message: `Your refund of ${escrow.currency} ${escrow.amountHeld.toFixed(2)} has been processed.`
    });

    res.status(200).json({
      message: 'Buyer refunded successfully'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── DELETE PRODUCT ───────────────────────────────────────
const adminDeleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    product.isActive = false;
    await product.save();
    res.status(200).json({ message: 'Product removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getStats,
  getAllUsers,
  toggleBanUser,
  getAllOrders,
  getAllEscrow,
  releaseEscrow,
  refundEscrow,
  adminDeleteProduct
};