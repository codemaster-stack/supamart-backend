// ─── PRICING LOGIC ────────────────────────────────────────
// Rule 1: Add 10% markup to seller base price
// Rule 2: For non-NGN users, convert then multiply by 3

const MARKUP = 1.10;
const INTERNATIONAL_MULTIPLIER = 3;

// Currency symbols
const CURRENCY_SYMBOLS = {
  NGN: '₦',
  USD: '$',
  GBP: '£',
  EUR: '€'
};

// Locale map for formatting
const CURRENCY_LOCALES = {
  NGN: 'en-NG',
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'de-DE'
};

// Fetch live exchange rates from NGN base
// Returns object like { USD: 0.00065, GBP: 0.00051, EUR: 0.00060 }
const getExchangeRates = async () => {
  try {
    const response = await fetch(process.env.EXCHANGE_RATE_API_URL);
    const data = await response.json();
    return data.rates; // rates from NGN
  } catch (error) {
    console.error('Exchange rate fetch failed, using fallback rates');
    // Fallback rates (approximate — update periodically)
    return {
      USD: 0.00065,
      GBP: 0.00051,
      EUR: 0.00060,
      NGN: 1
    };
  }
};

// Compute final display price
const computePrice = (basePriceNGN, currency, rates) => {
  const withMarkup = basePriceNGN * MARKUP;

  if (currency === 'NGN') {
    return withMarkup;
  }

  const rate = rates[currency];
  if (!rate) return withMarkup;

  const converted = withMarkup * rate;
  return converted * INTERNATIONAL_MULTIPLIER;
};

// Format price with currency symbol
const formatPrice = (amount, currency) => {
  const locale = CURRENCY_LOCALES[currency] || 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
};

// Detect currency from country code
const getCurrencyFromCountry = (countryCode) => {
  const map = {
    NG: 'NGN',
    US: 'USD',
    GB: 'GBP',
    DE: 'EUR',
    FR: 'EUR',
    IT: 'EUR',
    ES: 'EUR',
    NL: 'EUR',
    BE: 'EUR',
    PT: 'EUR',
    AT: 'EUR',
    IE: 'EUR',
    FI: 'EUR',
    GR: 'EUR'
  };
  return map[countryCode] || 'USD';
};

module.exports = {
  getExchangeRates,
  computePrice,
  formatPrice,
  getCurrencyFromCountry,
  CURRENCY_SYMBOLS
};