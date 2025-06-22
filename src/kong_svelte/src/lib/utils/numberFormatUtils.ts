import BigNumber from "bignumber.js";

const TRAILING_ZEROS_AFTER_DIGIT = /(\.\d*[1-9])0+$/;
const TRAILING_ZERO_DECIMALS = /\.0+$/;

/**
 * Formats a minimal unit amount to a human-readable decimal string based on decimals.
 * @param amount Minimal unit amount as string, number, bigint, or BigNumber
 * @param decimals Number of decimals for the token.
 * @returns Formatted decimal string.
 */
export function formatBalance(
  amount: string | number | bigint | BigNumber,
  decimals: number,
  displayDecimals: number = 4
): string {
  const formattedAmount = typeof amount === 'string' ? amount : amount.toString();
  const value = new BigNumber(formattedAmount).dividedBy(
    new BigNumber(10).pow(decimals),
  );

  if (value.isZero()) return "0";

  // For very small values (< 0.000001), show up to 8 decimals
  if (value.isLessThan(0.001) && !value.isZero()) {
    return value.toFormat(decimals).replace(/\.?0+$/, "");
  }

  // For small values (< 0.01), show up to 6 decimals
  if (value.isLessThan(0.01)) {
    return value.toFormat(6).replace(/\.?0+$/, "");
  }

  // For normal values, show up to 4 decimals
  return value.toFormat(displayDecimals).replace(/\.?0+$/, "");
}

/**
 * Removes trailing zeroes after the decimal point.
 * Examples:
 *  - "0.00100" => "0.001"
 *  - "1.2300"  => "1.23"
 *  - "1.0"     => "1"
 */
const removeTrailingZeros = (value: string): string => {
  // Do it in two steps for clarity:
  //  1) Remove trailing zeros that come after a non-zero digit.
  //  2) If the entire decimal portion becomes zero, remove the decimal point.
  let stripped = value.replace(TRAILING_ZEROS_AFTER_DIGIT, "$1");
  stripped = stripped.replace(TRAILING_ZERO_DECIMALS, "");
  return stripped;
};

export const formatToNonZeroDecimal = (input: number | string): string => {
  // Quick checks for falsy/invalid inputs
  if (!input || input === "") return "0";

  // Use BigNumber for safe numeric handling
  const bigNum = new BigNumber(input);
  if (!bigNum.isFinite()) return "0";
  if (bigNum.isZero()) return "0";

  // For very small numbers (0 < num < 0.1)
  if (bigNum.isGreaterThan(0) && bigNum.isLessThan(0.1)) {
    const rawStr = bigNum.toString();

    // Handle scientific notation
    if (rawStr.includes("e")) {
      const [, exponentStr] = rawStr.split("e");
      const exponent = parseInt(exponentStr, 10);
      // Ensure at least 2 decimals, or more if exponent is large negative
      const decimalPlaces = Math.max(-exponent + 3, 2);
      return removeTrailingZeros(bigNum.toFixed(decimalPlaces));
    }

    // For normal decimals, detect how many leading zeros after "0."
    const match = /^0\.0*[1-9]/.exec(rawStr);
    if (match) {
      const leadingZeros = match[0].length - 2; // subtract "0."
      const decimalPlaces = Math.max(leadingZeros + 2, 2);
      return removeTrailingZeros(bigNum.toFixed(decimalPlaces));
    }

    // Fallback: use 3 decimals
    return removeTrailingZeros(bigNum.toFixed(3));
  }

  // For numbers >= 0.1
  // If > 1, use 2 decimals; otherwise, use 3 decimals
  const decimals = bigNum.isGreaterThanOrEqualTo(1) ? 2 : 3;
  return bigNum.toFormat(decimals);
};

/**
 * Calculates the USD value of a token amount based on its price.
 * 
 * @param amount The token amount as a string
 * @param token The token object containing price information
 * @returns Formatted USD value as a string
 */
export function calculateTokenUsdValue(amount: string, token: any): string {
  // Check for valid inputs
  if (!token?.metrics?.price || !amount) {
    return "0";
  }

  const price = token.metrics.price;
  
  if (!price) {
    return "0";
  }

  // Calculate USD value
  const usdValue = new BigNumber(amount).multipliedBy(price);
  return formatToNonZeroDecimal(usdValue.toString());
}

/**
 * Parses a token amount (string, number, bigint, or BigNumber) into a bigint,
 * always using BigNumber for all numeric operations.
 *
 * @param formattedAmount Amount as string, number, bigint, or BigNumber
 * @param decimals Number of decimals for the token
 * @returns Parsed amount as bigint
 */
export function parseTokenAmount(
  formattedAmount: string | number | bigint | BigNumber,
  decimals: number
): bigint {
  // 1) Handle empty or invalid inputs quickly
  if (!formattedAmount && formattedAmount !== 0) {
    return BigInt(0);
  }
  if (formattedAmount === '') {
    return BigInt(0);
  }

  // 2) Convert everything to a BigNumber
  let amountBN: BigNumber;
  if (formattedAmount instanceof BigNumber) {
    amountBN = formattedAmount;
  } else if (typeof formattedAmount === 'bigint') {
    // Convert bigint to string
    amountBN = new BigNumber(formattedAmount.toString());
  } else {
    // Handle string or number; remove commas for safety
    amountBN = new BigNumber(String(formattedAmount).replace(/,/g, ''));
  }

  // 3) Check validity
  if (!amountBN.isFinite() || amountBN.isNaN()) {
    return BigInt(0);
  }

  // 4) Scale by 10^decimals and floor
  const scaled = amountBN
    .multipliedBy(new BigNumber(10).pow(decimals))
    .integerValue(BigNumber.ROUND_DOWN);

  // 5) Convert to a regular decimal string (no scientific notation),
  //    then to a native bigint
  const scaledStr = scaled.toFixed(0); // ensures integer expansion, e.g. no "1e+10"
  return BigInt(scaledStr);
}

export const calculatePercentage = (amount: string | undefined, total: string | undefined): number => {
    const amountNum = new BigNumber(amount || 0);
    const totalNum = new BigNumber(total || 0);
    
    if (amountNum.isNaN() || totalNum.isNaN()) return 0;
    if (totalNum.isZero()) return amountNum.gt(0) ? 100 : 0;
    
    return amountNum.dividedBy(totalNum).multipliedBy(100).toNumber();
};

export const formatCategory = (category: any): string => {
    if (!category) return 'Other';
    if (typeof category === 'string') return category.replace(/_/g, ' ');
    return Object.keys(category)[0].replace(/_/g, ' ');
};

export const toFixed = (amount: string, decimals: number): string => {
    return new BigNumber(amount).multipliedBy(new BigNumber(10).pow(decimals)).toString();
};

/**
 * Converts a human-readable amount to a scaled token amount string.
 * Example: 5 KONG with 8 decimals -> "500000000"
 * 
 * @param amount Human readable amount (e.g. 5)
 * @param decimals Number of decimals for the token (e.g. 8)
 * @returns Scaled amount as string suitable for contract calls
 */
export const toScaledAmount = (amount: string, decimals: number): string => {
    const bigAmount = new BigNumber(amount);
    if (bigAmount.isNaN() || bigAmount.isZero()) return "0";
    
    return bigAmount
        .multipliedBy(new BigNumber(10).pow(decimals))
        .integerValue(BigNumber.ROUND_DOWN)
        .toString();
};

/**
 * Format a USD volume value into a human-readable string with appropriate suffixes
 */
export function formatVolume(volume: string): string {
  const bigVolume = new BigNumber(volume);
  if (bigVolume.isGreaterThanOrEqualTo(1_000_000)) {
    return `$${(bigVolume.dividedBy(1_000_000)).toFixed(2)}M`;
  } else if (bigVolume.isGreaterThanOrEqualTo(1_000)) {
    return `$${(bigVolume.dividedBy(1_000)).toFixed(2)}K`;
  } else {
    return `$${bigVolume.toFixed(2)}`;
  }
}

/**
 * Format a number with commas for thousands separators
 */
export function formatNumberWithCommas(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function calculatePercentageAmount(
  balance: bigint,
  percentage: number,
  token: Kong.Token
): string {
  const balanceNumber = new BigNumber(balance.toString());
  const percentageAmount = balanceNumber
    .multipliedBy(percentage)
    .dividedBy(100)
    .dividedBy(new BigNumber(10).pow(token.decimals))
    
  return percentageAmount.minus(token.fee).toFixed(token.decimals);
}