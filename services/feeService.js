// ─── PLATFORM FEE LOGIC ───────────────────────────────────
const PLATFORM_MARKUP = 0.10; // 10%
const INTERNATIONAL_MULTIPLIER = 3;

// Calculate fee split from total amount paid
// Total = base * 1.10 (for NGN)
// Total = base * rate * 3 * 1.10 (for international)
// Platform fee = total - base_in_currency
// Seller gets = base_in_currency

const calculateFeeSplit = (basePriceNGN, currency, rates, quantity = 1) => {
  let sellerUnitAmount;
  let totalUnitAmount;

  if (currency === 'NGN') {
    sellerUnitAmount = basePriceNGN;
    totalUnitAmount = basePriceNGN * (1 + PLATFORM_MARKUP);
  } else {
    const rate = rates[currency] || 1;
    sellerUnitAmount = basePriceNGN * rate * INTERNATIONAL_MULTIPLIER;
    totalUnitAmount = sellerUnitAmount * (1 + PLATFORM_MARKUP);
  }

  const sellerTotal = sellerUnitAmount * quantity;
  const totalPaid = totalUnitAmount * quantity;
  const platformFee = totalPaid - sellerTotal;

  return {
    totalPaid: parseFloat(totalPaid.toFixed(4)),
    sellerAmount: parseFloat(sellerTotal.toFixed(4)),
    platformFee: parseFloat(platformFee.toFixed(4))
  };
};

module.exports = { calculateFeeSplit, PLATFORM_MARKUP };