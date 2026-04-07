const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  businessName: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  logoUrl: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    required: true
  },
  country: {
    type: String,
    default: 'Nigeria'
  },
  countryCode: {
    type: String,
    default: 'NG'
  },
  phoneNumber: {
    type: String,
    required: true
  },
  deliveryFee: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });
module.exports = mongoose.model('Store', storeSchema);