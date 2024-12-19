import { BigNumber } from 'bignumber.js';
import { formatTokenAmount } from './numberFormatUtils';
import { IcrcService } from '../services/icrc/IcrcService';

/**
 * Validates if a token combination is allowed for liquidity provision
 */
export function validateTokenCombination(token0Symbol: string, token1Symbol: string, allowedTokens: string[]): boolean {
    // Token1 (second token) must be in allowed tokens list
    const hasAllowedToken = allowedTokens.includes(token1Symbol);
    
    // Tokens must be different
    const isDifferentTokens = token0Symbol !== token1Symbol;
    
    return hasAllowedToken && isDifferentTokens;
}

/**
 * Formats a display value based on token decimals
 */
export function formatDisplayValue(value: string, tokenDecimals: number): string {
    if (!value || value === "0") return "0";
    
    const parts = value.split('.');
    const maxDecimals = tokenDecimals;
    
    if (parts.length === 2) {
        parts[1] = parts[1].slice(0, maxDecimals);
        if (parts[1].length === 0) return parts[0];
        return parts.join('.');
    }
    
    return parts[0];
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
 * Calculates the maximum amount considering transfer fees
 */
export async function calculateMaxAmount(
    token: FE.Token, 
    balance: string, 
    feeMultiplier: number = 1
): Promise<string> {
    try {
        // Get real token fee
        let tokenFee;
        try {
            tokenFee = await IcrcService.getTokenFee(token);
        } catch (error) {
            console.error("Error getting token fee, falling back to fee_fixed:", error);
            if (!token.fee_fixed) {
                throw new Error("Could not determine token fee");
            }
            tokenFee = BigInt(token.fee_fixed.toString().replace(/_/g, ''));
        }

        // Clean the balance
        const cleanBalance = balance.toString().replace(/_/g, '');
        const balanceBN = new BigNumber(cleanBalance);

        // Calculate max amount considering transfer fee
        const totalFees = new BigNumber(tokenFee.toString()).multipliedBy(feeMultiplier);
        let maxAmount = balanceBN.minus(totalFees);
        
        if (maxAmount.isLessThanOrEqualTo(0) || maxAmount.isNaN()) {
            throw new Error("Insufficient balance to cover fees");
        }

        // Format the max amount for display
        return formatTokenAmount(maxAmount.toString(), token.decimals);
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
    token1: FE.Token,
    token0Balance: string,
    token1Balance: string
): boolean {
    try {
        // Clean the input values first
        const cleanAmount0 = amount0.toString().replace(/[,_]/g, '');
        const cleanAmount1 = amount1.toString().replace(/[,_]/g, '');
        
        // Use BigNumber for precise decimal arithmetic
        const amount0Decimal = new BigNumber(cleanAmount0)
            .times(new BigNumber(10).pow(token0.decimals))
            .integerValue(BigNumber.ROUND_FLOOR);
        
        const amount1Decimal = new BigNumber(cleanAmount1)
            .times(new BigNumber(10).pow(token1.decimals))
            .integerValue(BigNumber.ROUND_FLOOR);

        // Clean and convert balances
        const balance0Decimal = new BigNumber(token0Balance.toString().replace(/_/g, ''));
        const balance1Decimal = new BigNumber(token1Balance.toString().replace(/_/g, ''));

        // Add fees if needed
        const fee0 = new BigNumber(token0.fee || 0);
        const fee1 = new BigNumber(token1.fee || 0);

        // Compare amounts with balances
        return amount0Decimal.plus(fee0).isGreaterThan(balance0Decimal) || 
               amount1Decimal.plus(fee1).isGreaterThan(balance1Decimal);
    } catch (err) {
        console.error("Error in hasInsufficientBalance:", err);
        return true; // Return true on error to prevent invalid transactions
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
    if (!poolExists) return "Pool Does Not Exist";
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
        const amt0 = new BigNumber(amount0.toString().replace(/[,_]/g, ''));
        const amt1 = new BigNumber(amount1.toString().replace(/[,_]/g, ''));
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
    const num = Number(cleanValue) / 1e6; // Convert from microdollars to dollars
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
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

    // Handle decimal point
    if (cleanValue.includes('.')) {
        const [whole, decimal] = cleanValue.split('.');
        cleanValue = `${whole}.${decimal.slice(0, maxDecimals)}`;
    }

    // Remove leading zeros unless it's "0." or just "0"
    if (cleanValue.length > 1 && cleanValue.startsWith('0') && cleanValue[1] !== '.') {
        cleanValue = cleanValue.replace(/^0+/, '');
    }

    // If empty or invalid after processing, set to default
    if (!cleanValue || cleanValue === '.') {
        cleanValue = defaultValue;
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
    const cleanAmount = amount.toString().replace(/[,_]/g, '');
    return new BigNumber(cleanAmount)
        .times(new BigNumber(tokenPrice))
        .toNumber();
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