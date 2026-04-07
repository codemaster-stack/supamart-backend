// ─── DELIVERY FEE LOGIC ───────────────────────────────────
// Rule: Buyer and seller must be in same country
// Delivery fee is fixed based on seller's set price

const DELIVERY_FEES = {
  NG: {
    currency: 'NGN',
    withinCity: 1500,
    withinState: 2500,
    withinCountry: 4000
  },
  US: {
    currency: 'USD',
    withinCity: 5,
    withinState: 10,
    withinCountry: 20
  },
  GB: {
    currency: 'GBP',
    withinCity: 4,
    withinState: 8,
    withinCountry: 15
  },
  DE: {
    currency: 'EUR',
    withinCity: 4,
    withinState: 8,
    withinCountry: 15
  }
};

// Check if buyer and seller are in same country
const canDeliverToCountry = (sellerCountryCode, buyerCountryCode) => {
  return sellerCountryCode === buyerCountryCode;
};

// Get delivery fee based on country
const getDeliveryFee = (countryCode, currency) => {
  const fees = DELIVERY_FEES[countryCode] || DELIVERY_FEES['NG'];
  return {
    withinCity: fees.withinCity,
    withinState: fees.withinState,
    withinCountry: fees.withinCountry,
    currency: currency || fees.currency
  };
};

module.exports = {
  canDeliverToCountry,
  getDeliveryFee,
  DELIVERY_FEES
};