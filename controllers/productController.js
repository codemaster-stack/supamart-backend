const Product = require('../models/Product');
const Store = require('../models/Store');

// ─── CREATE PRODUCT ───────────────────────────────────────
// POST /api/products
const createProduct = async (req, res) => {
  try {
    const { name, description, basePriceNGN } = req.body;

    // Validation
    if (!name || !description || !basePriceNGN) {
      return res.status(400).json({
        message: 'Name, description and price are required'
      });
    }

    if (isNaN(basePriceNGN) || Number(basePriceNGN) <= 0) {
      return res.status(400).json({
        message: 'Please enter a valid price'
      });
    }

    // Get seller's store
    const store = await Store.findOne({ userId: req.user.id });
    if (!store) {
      return res.status(404).json({
        message: 'You must create a store before adding products'
      });
    }

    // Get uploaded image URLs from Cloudinary
    const images = req.files ? req.files.map(file => file.path) : [];

    // Create product
    const product = await Product.create({
      storeId: store._id,
      sellerId: req.user.id,
      name,
      description,
      images,
      basePriceNGN: Number(basePriceNGN)
    });

    res.status(201).json({
      message: 'Product created successfully',
      product
    });

  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Server error while creating product' });
  }
};

// ─── GET ALL PRODUCTS (Homepage feed) ─────────────────────
// GET /api/products
const getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const query = { isActive: true };

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const products = await Product.find(query)
      .populate('storeId', 'businessName slug logoUrl phoneNumber')
      .populate('sellerId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(query);

    res.status(200).json({
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── GET SINGLE PRODUCT ───────────────────────────────────
// GET /api/products/:id
const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('storeId', 'businessName slug logoUrl phoneNumber location')
      .populate('sellerId', 'name');

    if (!product || !product.isActive) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json({ product });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── GET PRODUCTS BY STORE ────────────────────────────────
// GET /api/products/store/:storeId
const getProductsByStore = async (req, res) => {
  try {
    const products = await Product.find({
      storeId: req.params.storeId,
      isActive: true
    }).sort({ createdAt: -1 });

    res.status(200).json({ products });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── GET MY PRODUCTS (Seller dashboard) ───────────────────
// GET /api/products/my-products
const getMyProducts = async (req, res) => {
  try {
    const store = await Store.findOne({ userId: req.user.id });
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const products = await Product.find({ storeId: store._id })
      .sort({ createdAt: -1 });

    res.status(200).json({ products });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── UPDATE PRODUCT ───────────────────────────────────────
// PUT /api/products/:id
const updateProduct = async (req, res) => {
  try {
    const { name, description, basePriceNGN } = req.body;

    const product = await Product.findOne({
      _id: req.params.id,
      sellerId: req.user.id
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (name) product.name = name;
    if (description) product.description = description;
    if (basePriceNGN) product.basePriceNGN = Number(basePriceNGN);
    if (req.files && req.files.length > 0) {
      product.images = req.files.map(file => file.path);
    }

    await product.save();

    res.status(200).json({
      message: 'Product updated successfully',
      product
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── DELETE PRODUCT (soft delete) ────────────────────────
// DELETE /api/products/:id
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      sellerId: req.user.id
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    product.isActive = false;
    await product.save();

    res.status(200).json({ message: 'Product removed successfully' });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  getProduct,
  getProductsByStore,
  getMyProducts,
  updateProduct,
  deleteProduct
};