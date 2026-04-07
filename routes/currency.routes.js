const express = require('express');
const router = express.Router();
const {
  getExchangeRates,
  getCurrencyFromCountry
} = require('../services/currencyService');

// GET /api/currency/rates
router.get('/rates', async (req, res) => {
  try {
    const rates = await getExchangeRates();
    res.status(200).json({ rates });
  } catch (error) {
    res.status(500).json({ message: 'Could not fetch rates' });
  }
});

// GET /api/currency/detect
router.get('/detect', async (req, res) => {
  try {
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '';

    // Skip for localhost
    if (ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') {
      return res.json({
        currency: 'NGN',
        countryCode: 'NG',
        country: 'Nigeria'
      });
    }

    const geoRes = await fetch(`${process.env.GEOIP_API_URL}${ip}`);
    const geoData = await geoRes.json();

    const countryCode = geoData.countryCode || 'US';
    const currency = getCurrencyFromCountry(countryCode);

    res.status(200).json({
      currency,
      countryCode,
      country: geoData.country || 'Unknown'
    });

  } catch (error) {
    console.error('Geo detect error:', error.message);
    res.status(200).json({
      currency: 'USD',
      countryCode: 'US',
      country: 'Unknown'
    });
  }
});

module.exports = router;