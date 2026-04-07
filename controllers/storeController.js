const Store = require('../models/Store');
const User = require('../models/User');
const Wallet = require('../models/Wallet');

// Helper to generate unique slug
const generateSlug = (businessName) => {
  const base = businessName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  const suffix = Math.random().toString(36).substring(2, 7);
  return `${base}-${suffix}`;
};

// ─── CREATE STORE ─────────────────────────────────────────
// POST /api/stores
const createStore = async (req, res) => {
  try {
    const { businessName, location, phoneNumber } = req.body;

    // Validation
    if (!businessName || !location || !phoneNumber) {
      return res.status(400).json({
        message: 'Business name, location and phone number are required'
      });
    }

    // Check if seller already has a store
    const existingStore = await Store.findOne({ userId: req.user.id });
    if (existingStore) {
      return res.status(400).json({
        message: 'You already have a store',
        store: existingStore
      });
    }

    // Get logo URL from Cloudinary upload (if uploaded)
    const logoUrl = req.file ? req.file.path : '';

    // Generate unique slug
    let slug = generateSlug(businessName);

    // Make sure slug is unique
    let slugExists = await Store.findOne({ slug });
    while (slugExists) {
      slug = generateSlug(businessName);
      slugExists = await Store.findOne({ slug });
    }

    // Create the store
    const store = await Store.create({
     userId: req.user.id,
     businessName,
     slug,
     logoUrl,
     location,
     country: req.body.country || 'Nigeria',
     countryCode: req.body.countryCode || 'NG',
     phoneNumber
     });

    // Create 4 wallets for seller if not already created
    const currencies = ['NGN', 'USD', 'GBP', 'EUR'];
    for (const currency of currencies) {
      const exists = await Wallet.findOne({
        userId: req.user.id,
        currency
      });
      if (!exists) {
        await Wallet.create({ userId: req.user.id, currency, balance: 0 });
      }
    }

    res.status(201).json({
      message: 'Store created successfully',
      store,
      storeUrl: `/pages/store/store.html?slug=${store.slug}`
    });

  } catch (error) {
    console.error('Create store error:', error);
    res.status(500).json({ message: 'Server error while creating store' });
  }
};

// ─── GET STORE BY SLUG ────────────────────────────────────
// GET /api/stores/:slug
const getStoreBySlug = async (req, res) => {
  try {
    const store = await Store.findOne({ slug: req.params.slug })
      .populate('userId', 'name email');

    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    res.status(200).json({ store });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── GET MY STORE ─────────────────────────────────────────
// GET /api/stores/my-store
const getMyStore = async (req, res) => {
  try {
    const store = await Store.findOne({ userId: req.user.id });

    if (!store) {
      return res.status(404).json({ message: 'You have not created a store yet' });
    }

    res.status(200).json({ store });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── UPDATE STORE ─────────────────────────────────────────
// PUT /api/stores/:id
const updateStore = async (req, res) => {
  try {
    const { businessName, location, phoneNumber } = req.body;

    const store = await Store.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    // Update fields
    if (businessName) store.businessName = businessName;
    if (location) store.location = location;
    if (phoneNumber) store.phoneNumber = phoneNumber;
    if (req.file) store.logoUrl = req.file.path;

    await store.save();

    res.status(200).json({
      message: 'Store updated successfully',
      store
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createStore, getStoreBySlug, getMyStore, updateStore };