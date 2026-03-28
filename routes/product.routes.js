const express = require('express');
const router = express.Router();
const {
  createProduct,
  getAllProducts,
  getProduct,
  getProductsByStore,
  getMyProducts,
  updateProduct,
  deleteProduct
} = require('../controllers/productController');
const { protect, requireRole } = require('../middleware/authMiddleware');
const { uploadProductImages } = require('../services/uploadService');

// Public routes
router.get('/', getAllProducts);
router.get('/store/:storeId', getProductsByStore);
router.get('/seller/my-products', protect, requireRole('seller'), getMyProducts);
router.get('/:id', getProduct);

// Seller protected routes
router.post(
  '/',
  protect,
  requireRole('seller'),
  uploadProductImages.array('images', 5),
  createProduct
);
router.put(
  '/:id',
  protect,
  requireRole('seller'),
  uploadProductImages.array('images', 5),
  updateProduct
);
router.delete('/:id', protect, requireRole('seller'), deleteProduct);

module.exports = router;