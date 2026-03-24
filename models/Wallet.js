const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  currency: {
    type: String,
    enum: ['NGN', 'USD', 'GBP', 'EUR'],
    required: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('Wallet', walletSchema);