import BigNumber from "bignumber.js";

/**
 * Formats a minimal unit amount string to a human-readable decimal string based on decimals.
 * @param amount Minimal unit amount as a string.
 * @param decimals Number of decimals for the token.
 * @returns Formatted decimal string.
 */
export function formatTokenAmount(amount: string, decimals: number): string {
  return new BigNumber(amount)
    .dividedBy(new BigNumber(10).pow(decimals))
    .toFixed(decimals, BigNumber.ROUND_DOWN);
}

/**
 * Converts a human-readable decimal string to minimal unit string based on decimals.
 * @param amount Decimal amount as a string.
 * @param decimals Number of decimals for the token.
 * @returns Minimal unit amount as a string.
 */
export function toMinimalUnit(amount: string, decimals: number): string {
  const bigAmount = new BigNumber(amount);
  console.log(`BigNumber amount: ${bigAmount.toString()}`);
  const multiplier = new BigNumber(10).pow(decimals);
  console.log(`Multiplier (10^${decimals}): ${multiplier.toString()}`);
  const minimalAmount = bigAmount.multipliedBy(multiplier).integerValue(BigNumber.ROUND_DOWN);
  console.log(`Minimal unit amount: ${minimalAmount.toString()}`);
  return minimalAmount.toFixed(0);
}

export const formatToNonZeroDecimal = (number: number | string): string => {
  const num = typeof number === 'string' ? parseFloat(number) : number;

  // If the number is less than 0.01, format with more decimal places
  if (num < 0.01 && num > 0) {
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
  const amountNumber = Number(formattedAmount);
  return BigInt(Math.round(amountNumber * Math.pow(10, decimals)));
};
