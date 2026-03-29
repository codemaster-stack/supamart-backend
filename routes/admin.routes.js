const express = require('express');
const router = express.Router();
const {
  getStats,
  getAllUsers,
  toggleBanUser,
  deleteUser,
  getAllOrders,
  getAllEscrow,
  releaseEscrow,
  refundEscrow,
  adminDeleteProduct,
  getAllDisputes,
  getDispute,
  addDisputeMessage,
  resolveDispute
} = require('../controllers/adminController');
const { protect, requireRole } = require('../middleware/authMiddleware');

router.use(protect, requireRole('admin'));

router.get('/stats', getStats);
router.get('/users', getAllUsers);
router.patch('/users/:id/ban', toggleBanUser);
router.delete('/users/:id', deleteUser);
router.get('/orders', getAllOrders);
router.get('/escrow', getAllEscrow);
router.post('/escrow/:id/release', releaseEscrow);
router.post('/escrow/:id/refund', refundEscrow);
router.delete('/products/:id', adminDeleteProduct);
router.get('/disputes', getAllDisputes);
router.get('/disputes/:id', getDispute);
router.post('/disputes/:id/message', addDisputeMessage);
router.post('/disputes/:id/resolve', resolveDispute);

module.exports = router;