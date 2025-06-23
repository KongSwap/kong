import { BigNumber } from 'bignumber.js';
import { get } from 'svelte/store';
import { currentUserBalancesStore } from '$lib/stores/balancesStore';
import { calculateLiquidityAmounts } from "$lib/api/pools";

/**
 * Formats a display value based on token decimals
 */
export function formatDisplayValue(value: string, tokenDecimals: number): string {
    if (!value || value === "0") return "0";
    
    const bn = new BigNumber(value).dividedBy(Math.pow(10, tokenDecimals));
    return bn.toFormat(tokenDecimals, BigNumber.ROUND_DOWN, {
        groupSeparator: ',',
        decimalSeparator: '.'
    });
}

/**
 * Validates if a string is a valid number input
 */
export function isValidNumber(value: string): boolean {
    if (!value) return true;
    // Remove commas and underscores first
    const cleanValue = value.replace(/[,_]/g, '');
    // Allow numbers with optional decimal point and optional scientific notation
    const regex = /^[0-9]*\.?[0-9]*(?:[eE][+-]?[0-9]+)?$/;
    return regex.test(cleanValue) && !isNaN(Number(cleanValue));
}

/**
 * Calculates the maximum amount considering transfer fees.
 */
export async function calculateMaxAmount(
    token: Kong.Token, 
    rawBalance: string, 
    feeMultiplier: number = 1
): Promise<string> {
    try {
        if (!token) return "0";
        if (!token.fee && !token.fee_fixed) { throw new Error("Could not determine token fee"); }

        const balanceMicro = new BigNumber(rawBalance.replace(/_/g, ''));
        const tokenFeeMicro = new BigNumber(token.fee_fixed?.toString().replace(/_/g, '') || '0');
        const totalFeesMicro = tokenFeeMicro.multipliedBy(feeMultiplier);

        // Subtract fee from the balance
        const maxAmountMicro = balanceMicro.minus(totalFeesMicro);

        if (maxAmountMicro.isLessThan(0) || maxAmountMicro.isNaN()) {
            throw new Error("Insufficient balance to cover fees");
        }

        if (maxAmountMicro.isZero()) {
            return "0";
        }

        // Convert microtokens → tokens
        const decimals = token.decimals ?? 6;
        const maxAmountTokens = maxAmountMicro.dividedBy(Math.pow(10, decimals));

        return maxAmountTokens.toFormat(decimals, BigNumber.ROUND_DOWN, {
            groupSeparator: ',',
            decimalSeparator: '.'
        });
    } catch (err) {
        throw new Error(err instanceof Error ? err.message : "Failed to calculate max amount");
    }
}

/**
 * Formats a number with commas while preserving decimal places
 */
export function formatWithCommas(value: string): string {
    if (!value) return "0";
    const parts = value.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
}

/**
 * Checks if a user has insufficient balance for a liquidity operation
 */
export function hasInsufficientBalance(
    amount0: string,
    amount1: string,
    token0: Kong.Token,
    token1: Kong.Token
): boolean {
    if (!token0 || !token1) return false;
    try {
        const deposit0 = new BigNumber(amount0.replace(/[,_]/g, ''));
        const deposit1 = new BigNumber(amount1.replace(/[,_]/g, ''));

        // Grab balances from our token store
        const storeValue = get(currentUserBalancesStore);
        const balance0 = storeValue[token0.address];
        const balance1 = storeValue[token1.address];

        if (!balance0 || !balance1) return true;

        // Convert balances to tokens
        const balance0Tokens = new BigNumber(balance0.in_tokens ?? '0')
            .dividedBy(new BigNumber(10).pow(token0.decimals));
        const balance1Tokens = new BigNumber(balance1.in_tokens ?? '0')
            .dividedBy(new BigNumber(10).pow(token1.decimals));

        // Convert fee_fixed (microtokens) to tokens
        const fee0Tokens = new BigNumber(token0.fee_fixed ?? '0')
            .dividedBy(new BigNumber(10).pow(token0.decimals));
        const fee1Tokens = new BigNumber(token1.fee_fixed ?? '0')
            .dividedBy(new BigNumber(10).pow(token1.decimals));

        // Compare deposit + fee to the user's token balances
        const insufficientToken0 = deposit0.plus(fee0Tokens).isGreaterThan(balance0Tokens);
        const insufficientToken1 = deposit1.plus(fee1Tokens).isGreaterThan(balance1Tokens);

        return insufficientToken0 || insufficientToken1;
    } catch (err) {
        console.error("Error in hasInsufficientBalance:", err);
        return true;
    }
}

/**
 * Gets the appropriate button text based on form state
 */
export function getButtonText(
    token0: Kong.Token | null,
    token1: Kong.Token | null,
    poolExists: boolean,
    hasInsufficientBalance: boolean,
    amount0: string,
    amount1: string,
    loading: boolean,
    loadingState: string
): string {
    if (!token0 || !token1) return "Select Tokens";
    if (hasInsufficientBalance) return "Insufficient Balance";
    if (!amount0 || !amount1) return "Enter Amounts";
    if (loading) return loadingState || "Loading...";
    return "Review Transaction";
}

/**
 * Calculates and formats the pool ratio between two tokens
 */
export function calculatePoolRatio(
    token0: Kong.Token | null,
    token1: Kong.Token | null,
    amount0: string,
    amount1: string
): string {
    if (token0 && token1 && amount0 && amount1) {
        const amt0 = new BigNumber(amount0.replace(/[,_]/g, ''));
        const amt1 = new BigNumber(amount1.replace(/[,_]/g, ''));
        if (amt0.isGreaterThan(0) && amt1.isGreaterThan(0)) {
            return `1 ${token0.symbol} = ${amt1.dividedBy(amt0).toFixed(6)} ${token1.symbol}`;
        }
    }
    return '';
}

/**
 * Calculates and formats the USD ratio between two tokens
 */
export function calculateUsdRatio(
    token0: Kong.Token | null,
    token1: Kong.Token | null
): string {
    if (token0?.metrics.price && token1?.metrics.price) {
        const ratio = new BigNumber(token0.metrics.price).dividedBy(token1.metrics.price);
        return `1 ${token0.symbol} ≈ $${ratio.times(token1.metrics.price).toFixed(2)}`;
    }
    return '';
}

/**
 * Formats a large number for display (e.g., TVL, volume)
 */
export function formatLargeNumber(value: string | number | bigint, decimals: number = 2): string {
    const cleanValue = value.toString().replace(/_/g, '');
    const num = Number(cleanValue) / 1e6; // Convert from microdollars (or micro-units) to 'whole' units
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(num);
}

/**
 * Handles input validation and formatting for liquidity amounts
 */
export function processLiquidityInput(
    value: string, 
    maxDecimals: number,
    defaultValue: string = "0"
): string {
    // Remove commas and underscores
    let cleanValue = value.replace(/[,_]/g, '');
    
    if (!isValidNumber(cleanValue)) {
        return defaultValue;
    }

    // If the string has leading zeroes, remove them unless it's "0." or just "0"
    if (cleanValue.length > 1 && cleanValue.startsWith('0') && cleanValue[1] !== '.') {
        cleanValue = cleanValue.replace(/^0+/, '');
    }
    // If it starts with '.', prefix '0'
    if (cleanValue.startsWith('.')) {
        cleanValue = '0' + cleanValue;
    }

    // Handle decimal part up to maxDecimals
    if (cleanValue.includes('.')) {
        const [whole, decimal] = cleanValue.split('.');
        cleanValue = `${whole || '0'}.${decimal.slice(0, maxDecimals)}`;
    }

    // If empty or just '.', fallback
    if (!cleanValue || cleanValue === '.') {
        cleanValue = defaultValue;
    }

    // If there's a trailing dot (like "123."), remove it
    if (cleanValue.endsWith('.')) {
        cleanValue = cleanValue.slice(0, -1);
    }

    return cleanValue;
}

/**
 * Validates if a pool exists for the given token pair
 */
export function findPool(
    token0: Kong.Token | null,
    token1: Kong.Token | null,
    pools: BE.Pool[]
): BE.Pool | null {
    if (!token0 || !token1) return null;
    
    return pools.find(p => 
        (p.address_0 === token0.address && p.address_1 === token1.address) ||
        (p.address_0 === token1.address && p.address_1 === token0.address)
    ) || null;
}

export function getPoolForTokenPair(
    token0: Kong.Token | null,
    token1: Kong.Token | null,
    pools: BE.Pool[]
): BE.Pool | null {
    if (!token0 || !token1) return null;
    
    return pools.find(p => 
        (p.address_0 === token0.address && p.address_1 === token1.address) ||
        (p.address_0 === token1.address && p.address_1 === token0.address)
    ) || null;
}

export interface TokenPairState {
    token0: Kong.Token | null;
    token1: Kong.Token | null;
    amount0: string;
    amount1: string;
    error: string | null;
}

export function validateTokenSelect(
    selectedToken: Kong.Token,
    otherToken: Kong.Token | null,
    allowedTokens: string[],
    defaultToken: string,
    tokens: Kong.Token[]
): { 
    isValid: boolean;
    newToken: Kong.Token | null;
    error?: string;
} {
    if (!otherToken) { return { isValid: true, newToken: selectedToken };}
    const hasAllowedToken = allowedTokens.includes(selectedToken.symbol) || allowedTokens.includes(otherToken.symbol);
    const isDifferentTokens = selectedToken.symbol !== otherToken.symbol;
    const isValid = hasAllowedToken && isDifferentTokens

    if (!isValid) {
        const defaultTokenObj = tokens.find(t => t.symbol === defaultToken);
        return {
            isValid: false,
            newToken: defaultTokenObj || null,
            error: 'One token must be ICP or ckUSDT'
        };
    }

    return { isValid: true, newToken: selectedToken };
}

/**
 * Calculates token1 amount based on token0 amount and pool ratio
 * @param amount0 Amount of token0
 * @param token0 Token0 details
 * @param token1 Token1 details
 * @param pool Pool details
 * @returns Calculated amount of token1
 */
export async function calculateToken1FromPoolRatio(
  amount0: string,
  token0: Kong.Token,
  token1: Kong.Token,
  pool: BE.Pool
): Promise<string> {
  try {
    // Remove any commas from the input
    const sanitizedAmount0 = amount0.replace(/,/g, '');
    
    if (!sanitizedAmount0) {
      return "0";
    }

    const amount0BN = new BigNumber(sanitizedAmount0);
    if (amount0BN.isNaN() || amount0BN.lte(0)) {
      return "0";
    }

    // If pool is empty, we can't use the backend calculation
    const balance0BN = new BigNumber(pool.balance_0.toString());
    const balance1BN = new BigNumber(pool.balance_1.toString());
    
    if (balance0BN.lte(0) || balance1BN.lte(0)) {
      return "0";
    }
    
    // Convert to raw token amount (with decimals)
    const amount0Raw = BigInt(
      amount0BN.times(new BigNumber(10).pow(token0.decimals)).toFixed(0)
    );
    
    // Use backend service to calculate the corresponding token1 amount
    const result = await calculateLiquidityAmounts(
      token0.symbol,
      amount0Raw,
      token1.symbol
    );
    
    if ('Err' in result) {
      throw new Error("Failed to calculate liquidity amounts");
    }
    
    // Convert the result back to a human-readable format
    const amount1BN = new BigNumber(result.Ok.amount_1.toString())
      .dividedBy(new BigNumber(10).pow(token1.decimals));
    
    // Format to 6 decimal places for display
    return amount1BN.toFixed(6);
  } catch (error) {
    console.error("Error calculating token1 from pool ratio:", error);
    return "0";
  }
}

/**
 * Calculates token0 amount based on token1 amount and pool ratio
 * @param amount1 Amount of token1
 * @param token0 Token0 details
 * @param token1 Token1 details
 * @param pool Pool details
 * @returns Calculated amount of token0
 */
export async function calculateToken0FromPoolRatio(
  amount1: string,
  token0: Kong.Token,
  token1: Kong.Token,
  pool: BE.Pool
): Promise<string> {
  try {
    // Remove any commas from the input
    const sanitizedAmount1 = amount1.replace(/,/g, '');
    
    if (!sanitizedAmount1) {
      return "0";
    }

    const amount1BN = new BigNumber(sanitizedAmount1);
    if (amount1BN.isNaN() || amount1BN.lte(0)) {
      return "0";
    }

    // If pool is empty, we can't use the backend calculation
    const balance0BN = new BigNumber(pool.balance_0.toString());
    const balance1BN = new BigNumber(pool.balance_1.toString());
    
    if (balance0BN.lte(0) || balance1BN.lte(0)) {
      return "0";
    }
    
    // Since calculateLiquidityAmounts expects token0 amount as input,
    // we first need to estimate token0 amount based on pool ratio
    // Get raw balances from the pool
    const amount1Raw = amount1BN.times(new BigNumber(10).pow(token1.decimals));
    
    // Calculate the initial estimate using the pool ratio
    // amount0 = amount1 * (balance0 / balance1)
    const estimatedAmount0Raw = amount1Raw.times(balance0BN).dividedBy(balance1BN);
    
    // Convert to raw token amount (with decimals)
    const estimatedAmount0 = BigInt(estimatedAmount0Raw.toFixed(0));
    
    // Use backend service to calculate the corresponding token1 amount
    const result = await calculateLiquidityAmounts(
      token0.symbol,
      estimatedAmount0,
      token1.symbol
    );
    
    if ('Err' in result) {
      throw new Error("Failed to calculate liquidity amounts");
    }
    
    // The backend might give us a different token1 amount than requested.
    // We need to scale our token0 amount to match the requested token1 amount.
    const resultAmount1BN = new BigNumber(result.Ok.amount_1.toString());
    const requestedAmount1Raw = amount1BN.times(new BigNumber(10).pow(token1.decimals));
    
    // Scale factor = requested amount1 / result amount1
    const scaleFactor = requestedAmount1Raw.dividedBy(resultAmount1BN);
    
    // Scale the token0 amount
    const scaledAmount0BN = new BigNumber(result.Ok.amount_0.toString())
      .times(scaleFactor)
      .dividedBy(new BigNumber(10).pow(token0.decimals));
    
    // Format to 6 decimal places for display
    return scaledAmount0BN.toFixed(6);
  } catch (error) {
    console.error("Error calculating token0 from pool ratio:", error);
    return "0";
  }
}

/**
 * Calculates token1 amount based on token0 amount and price
 * @param amount0 Amount of token0
 * @param price Price of token0 in terms of token1
 * @returns Calculated amount of token1
 */
export function calculateToken1FromPrice(
  amount0: string,
  price: string
): string {
  try {
    // Remove any commas from inputs
    const sanitizedAmount0 = amount0.replace(/,/g, '');
    const sanitizedPrice = price.replace(/,/g, '');
    
    if (!sanitizedAmount0 || !sanitizedPrice) {
      return "0";
    }
    
    const amount0BN = new BigNumber(sanitizedAmount0);
    const priceBN = new BigNumber(sanitizedPrice);
    
    if (amount0BN.isNaN() || priceBN.isNaN() || amount0BN.lte(0) || priceBN.lte(0)) {
      return "0";
    }
    
    // Calculate amount1 = amount0 * price using BigNumber
    const amount1BN = amount0BN.times(priceBN);
    return amount1BN.toString();
  } catch (error) {
    console.error("Error calculating token1 from price:", error);
    return "0";
  }
}

/**
 * Calculates token0 amount based on token1 amount and price
 * @param amount1 Amount of token1
 * @param price Price of token0 in terms of token1
 * @returns Calculated amount of token0
 */
export function calculateToken0FromPrice(
  amount1: string,
  price: string
): string {
  try {
    // Remove any commas from inputs
    const sanitizedAmount1 = amount1.replace(/,/g, '');
    const sanitizedPrice = price.replace(/,/g, '');
    
    if (!sanitizedAmount1 || !sanitizedPrice) {
      return "0";
    }
    
    const amount1BN = new BigNumber(sanitizedAmount1);
    const priceBN = new BigNumber(sanitizedPrice);
    
    if (amount1BN.isNaN() || priceBN.isNaN() || amount1BN.lte(0) || priceBN.lte(0)) {
      return "0";
    }
    
    // Calculate amount0 = amount1 / price using BigNumber
    const amount0BN = amount1BN.dividedBy(priceBN);
    return amount0BN.toString();
  } catch (error) {
    console.error("Error calculating token0 from price:", error);
    return "0";
  }
}

/**
 * Calculates token amount based on percentage of balance
 * @param token Token details
 * @param balance Token balance in raw format
 * @param percentage Percentage to calculate (0-100)
 * @returns Calculated token amount
 */
export function calculateAmountFromPercentage(
  token: Kong.Token,
  balance: string,
  percentage: number
): string {
  try {
    if (!token || !balance) return "0";
    
    const balanceValue = new BigNumber(balance).div(
      new BigNumber(10).pow(token.decimals)
    );
    
    if (!balanceValue.isFinite() || balanceValue.isLessThanOrEqualTo(0)) return "0";
    
    // If it's 100% (MAX), subtract both the token fee and transaction fee
    const adjustedBalance =
      percentage === 100
        ? balanceValue.minus(new BigNumber(token.fee * 2))
        : balanceValue.times(percentage).div(100);
    
    // Return the raw value without formatting (no commas)
    return adjustedBalance.gt(0)
      ? adjustedBalance.toFixed(token.decimals)
      : "0";
  } catch (error) {
    console.error("Error calculating percentage amount:", error);
    return "0";
  }
}

/**
 * Formats a number to non-zero decimal places
 * @param value Number to format
 * @returns Formatted string
 */
export function formatToNonZeroDecimal(value: number): string {
  if (isNaN(value) || value === 0) return "0";
  
  if (value < 0.01) {
    return value.toFixed(6);
  } else if (value < 1) {
    return value.toFixed(4);
  } else if (value < 10000) {
    return value.toFixed(2);
  } else {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}

// Optimized calculation function with minimized parameters using BigNumber
export function calculateUserPoolPercentage(
  poolBalance0: bigint | undefined,
  poolBalance1: bigint | undefined,
  userAmount0: string | number | undefined,
  userAmount1: string | number | undefined,
  poolFee0?: bigint | undefined,
  poolFee1?: bigint | undefined,
): string {
  if (!poolBalance0 || !poolBalance1 || !userAmount0 || !userAmount1) {
    return "0";
  }
  
  try {
    // Convert values to BigNumber with proper scaling
    const userAmount0BN = new BigNumber(userAmount0);
    const userAmount1BN = new BigNumber(userAmount1);
    
    // Pool balances should include fees for accurate percentage
    const poolBalance0BN = new BigNumber(poolBalance0.toString());
    const poolBalance1BN = new BigNumber(poolBalance1.toString());
    
    // Add fees to pool balances if provided
    const poolFee0BN = poolFee0 ? new BigNumber(poolFee0.toString()) : new BigNumber(0);
    const poolFee1BN = poolFee1 ? new BigNumber(poolFee1.toString()) : new BigNumber(0);
    
    const totalPoolBalance0 = poolBalance0BN.plus(poolFee0BN);
    const totalPoolBalance1 = poolBalance1BN.plus(poolFee1BN);
    
    if (totalPoolBalance0.isZero() || totalPoolBalance1.isZero()) return "0";
    
    // Calculate percentages based on both tokens
    const percentage0 = userAmount0BN.div(totalPoolBalance0).times(100);
    const percentage1 = userAmount1BN.div(totalPoolBalance1).times(100);
    
    // Use the average of both percentages (they should be very close)
    const averagePercentage = percentage0.plus(percentage1).div(2);
    
    // Format to 2 decimal places
    return formatToNonZeroDecimal(averagePercentage.toNumber());
  } catch (error) {
    console.error("Error calculating pool percentage:", error);
    return "0";
  }
}

// Calculate user's pool share percentage using LP tokens for accurate representation including fees
export function calculateUserPoolShareWithLPTokens(
  userLPBalance: string | number | undefined,
  totalLPSupply: bigint | undefined,
  lpTokenDecimals: number = 8, // Default to 8 decimals for LP tokens
): string {
  if (!userLPBalance || !totalLPSupply || totalLPSupply === 0n) {
    return "0";
  }
  
  try {
    // User LP balance is likely already in decimal format (e.g., 100.5 LP tokens)
    // Total LP supply is in raw format (bigint)
    const userLPBalanceBN = new BigNumber(userLPBalance.toString());
    
    // Convert total LP supply from raw to decimal format
    const totalLPSupplyBN = new BigNumber(totalLPSupply.toString()).dividedBy(
      new BigNumber(10).pow(lpTokenDecimals)
    );
    
    if (totalLPSupplyBN.isZero()) return "0";
    
    // Calculate percentage: (userLPBalance / totalLPSupply) * 100
    const percentage = userLPBalanceBN.div(totalLPSupplyBN).times(100);
    
    // Format to appropriate decimal places
    return formatToNonZeroDecimal(percentage.toNumber());
  } catch (error) {
    console.error("Error calculating pool share percentage:", error);
    return "0";
  }
}