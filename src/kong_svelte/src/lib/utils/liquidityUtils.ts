import { BigNumber } from 'bignumber.js';
import { get } from 'svelte/store';
import { currentUserBalancesStore, tokenStore } from '$lib/stores/tokenStore';

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
    token: FE.Token, 
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
    token0: FE.Token,
    token1: FE.Token
): boolean {
    if (!token0 || !token1) return false;
    try {
        const deposit0 = new BigNumber(amount0.replace(/[,_]/g, ''));
        const deposit1 = new BigNumber(amount1.replace(/[,_]/g, ''));

        // Grab balances from our token store
        const storeValue = get(currentUserBalancesStore);
        const balance0 = storeValue[token0.canister_id];
        const balance1 = storeValue[token1.canister_id];

        if (!balance0 || !balance1) return true;

        // Convert balances to tokens
        const balance0Tokens = new BigNumber(balance0.in_tokens.toString() ?? '0')
            .dividedBy(new BigNumber(10).pow(token0.decimals));
        const balance1Tokens = new BigNumber(balance1.in_tokens.toString() ?? '0')
            .dividedBy(new BigNumber(10).pow(token1.decimals));

        // Convert fee_fixed (microtokens) to tokens
        const fee0Tokens = new BigNumber(token0.fee_fixed ?? '0')
            .dividedBy(new BigNumber(10).pow(token0.decimals));
        const fee1Tokens = new BigNumber(token1.fee_fixed ?? '0')
            .dividedBy(new BigNumber(10).pow(token1.decimals));

        // Compare deposit + fee to the user’s token balances
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
    token0: FE.Token | null,
    token1: FE.Token | null,
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
    token0: FE.Token | null,
    token1: FE.Token | null,
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
    token0: FE.Token | null,
    token1: FE.Token | null
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
 * Calculates USD value from token amount and price
 */
export function calculateUsdValue(
    amount: string,
    tokenPrice: string | number
): number {
    const cleanAmount = amount.replace(/[,_]/g, '');
    return new BigNumber(cleanAmount).times(new BigNumber(tokenPrice)).toNumber();
}

/**
 * Validates if a pool exists for the given token pair
 */
export function findPool(
    token0: FE.Token | null,
    token1: FE.Token | null,
    pools: BE.Pool[]
): BE.Pool | null {
    if (!token0 || !token1) return null;
    
    return pools.find(p => 
        (p.address_0 === token0.canister_id && p.address_1 === token1.canister_id) ||
        (p.address_0 === token1.canister_id && p.address_1 === token0.canister_id)
    ) || null;
}

/**
 * Validates if the form inputs are valid for submission
 */
export function validateLiquidityForm(
    token0: FE.Token | null,
    token1: FE.Token | null,
    amount0: string,
    amount1: string,
    error: string | null,
    hasInsufficientBalance: boolean,
    pool: BE.Pool | null
): boolean {
    return !!(
        token0 && 
        token1 && 
        parseFloat(amount0.replace(/[,_]/g, '')) > 0 && 
        parseFloat(amount1.replace(/[,_]/g, '')) > 0 && 
        !error && 
        !hasInsufficientBalance && 
        pool !== null
    );
}

export function getPoolForTokenPair(
    token0: FE.Token | null,
    token1: FE.Token | null,
    pools: BE.Pool[]
): BE.Pool | null {
    if (!token0 || !token1) return null;
    
    return pools.find(p => 
        (p.address_0 === token0.canister_id && p.address_1 === token1.canister_id) ||
        (p.address_0 === token1.canister_id && p.address_1 === token0.canister_id)
    ) || null;
}

export interface TokenPairState {
    token0: FE.Token | null;
    token1: FE.Token | null;
    amount0: string;
    amount1: string;
    error: string | null;
}

export function validateTokenSelect(
    selectedToken: FE.Token,
    otherToken: FE.Token | null,
    allowedTokens: string[],
    defaultToken: string,
    tokens: FE.Token[]
): { 
    isValid: boolean;
    newToken: FE.Token | null;
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