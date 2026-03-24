const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth.routes');
const storeRoutes = require('./routes/store.routes');

dotenv.config();

const app = express();

// Security
app.use(helmet());

// CORS — allows your frontend (Vercel) to talk to this backend
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/', (req, res) => {
  res.json({ message: 'Supamart API is running ✅' });
});

// ─── Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/stores', storeRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Supamart backend running on port ${PORT}`);
});

module.exports = app;