const mongoose = require('mongoose');

const escrowSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  currency: {
    type: String,
    enum: ['NGN', 'USD', 'GBP', 'EUR'],
    required: true
  },
  amountHeld: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['held', 'released', 'refunded', 'disputed'],
    default: 'held'
  },
  releasedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Escrow', escrowSchema);