const express = require('express');
const router = express.Router();
const {
  getStats,
  getAllUsers,
  toggleBanUser,
  getAllOrders,
  getAllEscrow,
  releaseEscrow,
  refundEscrow,
  adminDeleteProduct
} = require('../controllers/adminController');
const { protect, requireRole } = require('../middleware/authMiddleware');

// All admin routes require admin role
router.use(protect, requireRole('admin'));

router.get('/stats', getStats);
router.get('/users', getAllUsers);
router.patch('/users/:id/ban', toggleBanUser);
router.get('/orders', getAllOrders);
router.get('/escrow', getAllEscrow);
router.post('/escrow/:id/release', releaseEscrow);
router.post('/escrow/:id/refund', refundEscrow);
router.delete('/products/:id', adminDeleteProduct);

module.exports = router;