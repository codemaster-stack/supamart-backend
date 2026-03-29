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

const Dispute = require('../models/Dispute');

// ─── GET ALL DISPUTES ─────────────────────────────────────
const getAllDisputes = async (req, res) => {
  try {
    const disputes = await Dispute.find()
      .populate('orderId')
      .populate('raisedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({ disputes });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── GET SINGLE DISPUTE ───────────────────────────────────
const getDispute = async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id)
      .populate('raisedBy', 'name email')
      .populate({
        path: 'orderId',
        populate: [
          { path: 'buyerId', select: 'name email' },
          { path: 'sellerId', select: 'name email' },
          { path: 'productId', select: 'name images' }
        ]
      });

    if (!dispute) {
      return res.status(404).json({ message: 'Dispute not found' });
    }

    res.status(200).json({ dispute });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── ADD MESSAGE TO DISPUTE ───────────────────────────────
const addDisputeMessage = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) {
      return res.status(404).json({ message: 'Dispute not found' });
    }

    dispute.messages.push({
      senderId: req.user.id,
      senderName: req.user.name,
      senderRole: req.user.role,
      message
    });

    dispute.status = 'under_review';
    await dispute.save();

    // Notify buyer and seller
    const order = await Order.findById(dispute.orderId);
    if (order) {
      await Notification.create({
        userId: order.buyerId,
        type: 'dispute_update',
        message: `Admin has responded to your dispute for order #${order._id.toString().slice(-6).toUpperCase()}.`
      });
      await Notification.create({
        userId: order.sellerId,
        type: 'dispute_update',
        message: `Admin has reviewed the dispute for order #${order._id.toString().slice(-6).toUpperCase()}.`
      });
    }

    res.status(200).json({
      message: 'Message sent',
      dispute
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── RESOLVE DISPUTE ──────────────────────────────────────
const resolveDispute = async (req, res) => {
  try {
    const { resolution } = req.body;
    // resolution = 'seller' (release to seller) or 'buyer' (refund buyer)

    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) {
      return res.status(404).json({ message: 'Dispute not found' });
    }

    const escrow = await Escrow.findOne({ orderId: dispute.orderId });
    if (!escrow) {
      return res.status(404).json({ message: 'Escrow not found' });
    }

    const order = await Order.findById(dispute.orderId);

    if (resolution === 'seller') {
      // Release to seller
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

      dispute.status = 'resolved_seller';
      dispute.messages.push({
        senderId: req.user.id,
        senderName: req.user.name,
        senderRole: 'admin',
        message: `Dispute resolved. Funds released to seller.`
      });
      await dispute.save();

      await Notification.create({
        userId: order.sellerId,
        type: 'dispute_resolved',
        message: `Dispute resolved in your favour. ${escrow.currency} ${escrow.amountHeld.toFixed(2)} released to your wallet.`
      });

      await Notification.create({
        userId: order.buyerId,
        type: 'dispute_resolved',
        message: `Dispute for order #${order._id.toString().slice(-6).toUpperCase()} has been resolved. Funds released to seller.`
      });

    } else if (resolution === 'buyer') {
      // Refund buyer
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

      dispute.status = 'resolved_buyer';
      dispute.messages.push({
        senderId: req.user.id,
        senderName: req.user.name,
        senderRole: 'admin',
        message: `Dispute resolved. Buyer has been refunded.`
      });
      await dispute.save();

      await Notification.create({
        userId: order.buyerId,
        type: 'dispute_resolved',
        message: `Dispute resolved in your favour. ${escrow.currency} ${escrow.amountHeld.toFixed(2)} refunded to your wallet.`
      });

      await Notification.create({
        userId: order.sellerId,
        type: 'dispute_resolved',
        message: `Dispute for order #${order._id.toString().slice(-6).toUpperCase()} resolved. Buyer was refunded.`
      });
    }

    res.status(200).json({ message: 'Dispute resolved successfully' });

  } catch (error) {
    console.error('Resolve dispute error:', error);
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
  adminDeleteProduct,
  getAllDisputes,
  getDispute,
  addDisputeMessage,
  resolveDispute
};