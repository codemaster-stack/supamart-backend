const axios = require('axios');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';

const paystackAPI = axios.create({
  baseURL: PAYSTACK_BASE,
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET}`,
    'Content-Type': 'application/json'
  }
});

// ─── Initialize Transaction ───────────────────────────────
// Creates a payment link for the buyer
const initializePayment = async ({
  email,
  amount,
  currency,
  reference,
  metadata,
  callbackUrl
}) => {
  try {
    // Paystack accepts amount in kobo (NGN) or smallest unit
    // For NGN: multiply by 100
    // For USD/GBP/EUR: multiply by 100
    const amountInSmallestUnit = Math.round(amount * 100);

    const response = await paystackAPI.post('/transaction/initialize', {
      email,
      amount: amountInSmallestUnit,
      currency: currency.toUpperCase(),
      reference,
      metadata,
      callback_url: callbackUrl
    });

    return response.data;

  } catch (error) {
    console.error('Paystack init error:', error.response?.data || error.message);
    throw new Error(
      error.response?.data?.message || 'Payment initialization failed'
    );
  }
};

// ─── Verify Transaction ───────────────────────────────────
// Confirms payment was successful
const verifyPayment = async (reference) => {
  try {
    const response = await paystackAPI.get(
      `/transaction/verify/${reference}`
    );
    return response.data;
  } catch (error) {
    console.error('Paystack verify error:', error.response?.data || error.message);
    throw new Error(
      error.response?.data?.message || 'Payment verification failed'
    );
  }
};

// ─── Generate Unique Reference ────────────────────────────
const generateReference = (userId) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SUPA-${userId.toString().slice(-6).toUpperCase()}-${timestamp}-${random}`;
};

// ─── Create Virtual Account (Bank Transfer) ───────────────
const createVirtualAccount = async ({
  email,
  amount,
  currency,
  reference,
  metadata,
  callbackUrl
}) => {
  try {
    // For bank transfer, we initialize with bank_transfer channel
    const amountInSmallestUnit = Math.round(amount * 100);

    const response = await paystackAPI.post('/transaction/initialize', {
      email,
      amount: amountInSmallestUnit,
      currency: currency.toUpperCase(),
      reference,
      metadata,
      callback_url: callbackUrl,
      channels: ['bank_transfer'],
      bank_transfer: {
        account_expires_at: new Date(
          Date.now() + 30 * 60 * 1000 // expires in 30 minutes
        ).toISOString()
      }
    });

    return response.data;

  } catch (error) {
    console.error('Paystack bank transfer error:',
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.message || 'Bank transfer initialization failed'
    );
  }
};

module.exports = {
  initializePayment,
  verifyPayment,
  generateReference,
  createVirtualAccount
};