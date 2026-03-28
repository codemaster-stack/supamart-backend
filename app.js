const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// ─── Trust Render's proxy (fixes X-Forwarded-For error) ───
app.set('trust proxy', 1);

// Security
app.use(helmet());

// CORS
const allowedOrigins = [
  process.env.CLIENT_URL,
  'https://supamart-frontend-g449.vercel.app',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate limiting — fixed for proxy
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  validate: { xForwardedForHeader: false }
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Supamart API is running ✅' });
});

// ─── Routes ───
const authRoutes = require('./routes/auth.routes');
const storeRoutes = require('./routes/store.routes');
const productRoutes = require('./routes/product.routes');
const currencyRoutes = require('./routes/currency.routes');
const orderRoutes = require('./routes/order.routes');
const walletRoutes = require('./routes/wallet.routes');
const adminRoutes = require('./routes/admin.routes');

app.use('/api/auth', authRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/products', productRoutes);
app.use('/api/currency', currencyRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/admin', adminRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: process.env.NODE_ENV === 'production'
      ? 'Something went wrong'
      : err.message
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Supamart backend running on port ${PORT}`);
});

module.exports = app;
