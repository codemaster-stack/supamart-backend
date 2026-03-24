const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  businessName: {
    type: String,
    required: [true, 'Business name is required'],
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
    required: [true, 'Shop location is required']
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Store', storeSchema);