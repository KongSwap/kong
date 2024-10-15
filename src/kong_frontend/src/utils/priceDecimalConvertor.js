import BigNumber from 'bignumber.js';

export function priceRoundedPool(poolPrice, amount) {
  if (!amount) return amount; // Return the original amount if undefined or 0

  // Parse pool price to determine the number of decimals
  const priceF64 = parseFloat(poolPrice);
  if (isNaN(priceF64)) return amount; // Return original amount if price is NaN

  let decimals;

  // Determine number of decimals based on the pool price value
  if (priceF64 < 0.000001) {
    decimals = 8;  // 8 decimal places for extremely low prices
  } else if (priceF64 < 0.0001) {
    decimals = 6;  // 6 decimal places
  } else if (priceF64 < 0.01) {
    decimals = 4;  // 4 decimal places
  } else if (priceF64 < 10000) {
    decimals = 2;  // 2 decimal places for regular prices
  } else {
    decimals = 0;  // No decimals for large prices
  }

  // Remove commas and ensure the amount is a valid number before formatting
  const cleanedAmount = amount.toString().replace(/,/g, '');
  const formattedAmount = new BigNumber(cleanedAmount).toFormat(decimals, BigNumber.ROUND_DOWN);
  return formattedAmount;
}

export function priceRoundedAmount(poolPrice, amount) {
  if (!amount) return amount; // If amount is undefined or 0, return it directly

  let decimals = 0; // Default to 0 decimals if pool price isn't defined

  // Use default value of 1 for poolPrice if it's undefined, null, 0, or any other falsy value
  const effectivePoolPrice = poolPrice || 1;

  // Calculate the number of decimals to show based on the pool price
  const priceF64 = parseFloat(effectivePoolPrice);
  if (isNaN(priceF64)) return amount; // Return original amount if the price is NaN

  if (priceF64 < 0.000001) decimals = 0; // Show 0 decimal places
  else if (priceF64 < 0.0001) decimals = 1;
  else if (priceF64 < 0.01) decimals = 2;
  else if (priceF64 < 100) decimals = 3;
  else if (priceF64 < 1000) decimals = 4;
  else if (priceF64 < 10000) decimals = 5;
  else if (priceF64 < 100000) decimals = 6;
  else decimals = 8; // Show 8 decimal places for high prices

  // Remove commas and ensure the amount is a valid number before formatting
  const cleanedAmount = amount.toString().replace(/,/g, '');
  const formattedAmount = new BigNumber(cleanedAmount).toFormat(decimals, BigNumber.ROUND_DOWN);
  return formattedAmount;
}