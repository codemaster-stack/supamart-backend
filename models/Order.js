const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  currency: {
    type: String,
    enum: ['NGN', 'USD', 'GBP', 'EUR'],
    required: true
  },
  amountPaid: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: [
      'pending', 'paid', 'shipped',
      'delivered', 'completed', 'disputed', 'refunded'
    ],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['wallet', 'card', 'bank_transfer'],
    default: 'wallet'
  },
  paymentReference: {
    type: String,
    default: null
  },
  deliveryFee: {
    type: Number,
    default: 0
  },
  deliveryType: {
    type: String,
    enum: ['within_city', 'within_state', 'within_country'],
    default: 'within_country'
  },
  deliveryAddress: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);