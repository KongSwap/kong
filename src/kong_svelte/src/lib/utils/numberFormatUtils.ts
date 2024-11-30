import BigNumber from "bignumber.js";

/**
 * Formats a minimal unit amount string to a human-readable decimal string based on decimals.
 * @param amount Minimal unit amount as a string.
 * @param decimals Number of decimals for the token.
 * @returns Formatted decimal string.
 */
export function formatTokenAmount(amount: string, decimals: number): string {
  const value = new BigNumber(amount)
    .dividedBy(new BigNumber(10).pow(decimals));

  if (value.isZero()) return "0";

  // For very small values (< 0.000001), show up to 8 decimals
  if (value.isLessThan(0.000001) && !value.isZero()) {
    return value.toFormat(8).replace(/\.?0+$/, '');
  }

  // For small values (< 0.01), show up to 6 decimals
  if (value.isLessThan(0.01)) {
    return value.toFormat(6).replace(/\.?0+$/, '');
  }

  // For normal values, show up to 4 decimals
  return value.toFormat(4).replace(/\.?0+$/, '');
}

/**
 * Converts a human-readable decimal string to minimal unit string based on decimals.
 * @param amount Decimal amount as a string.
 * @param decimals Number of decimals for the token.
 * @returns Minimal unit amount as a string.
 */
export function toMinimalUnit(amount: string, decimals: number): string {
  const bigAmount = new BigNumber(amount);
  const multiplier = new BigNumber(10).pow(decimals);
  const minimalAmount = bigAmount.multipliedBy(multiplier).integerValue(BigNumber.ROUND_DOWN);
  return minimalAmount.toFixed(0);
}

export const formatToNonZeroDecimal = (number: number | string): string => {
  const num = typeof number === 'string' ? parseFloat(number) : number;

  // If the number is less than 0.01, format with more decimal places
  if (num < 0.1 && num > 0) {
    const numberStr = num.toString();
    const decimalPart = numberStr.split('.')[1] || '';
    
    // Find the first non-zero index in the decimal part
    const firstNonZeroIndex = decimalPart.search(/[1-9]/) + 2;

    // If a non-zero digit is found, format accordingly
    if (firstNonZeroIndex !== -1) {
      return new Intl.NumberFormat('en-US', {
        style: 'decimal',
        minimumFractionDigits: firstNonZeroIndex,
        maximumFractionDigits: firstNonZeroIndex
      }).format(num);
    }
  }

  // Default formatting for numbers >= 0.01
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

export const parseTokenAmount = (formattedAmount: number | string, decimals: number): bigint => {
  // Convert to string and handle scientific notation
  const amountStr = typeof formattedAmount === 'number' 
    ? formattedAmount.toString() 
    : formattedAmount;

  // Use BigNumber to handle the conversion accurately
  const amount = new BigNumber(amountStr)
    .multipliedBy(new BigNumber(10).pow(decimals))
    .integerValue(BigNumber.ROUND_DOWN);

  // Convert to bigint
  return BigInt(amount.toString());
};
