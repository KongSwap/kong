import { formatToNonZeroDecimal } from "./numberFormatUtils";

/**
 * Formats a raw token balance considering its decimals
 * @param rawBalance The raw balance as a string (big integer format)
 * @param decimals The number of decimals for the token
 * @returns Formatted balance string
 */
export function formatBalance(rawBalance: string | undefined, decimals: number = 8): string {
    if (!rawBalance) return "0";
    
    // Convert from raw integer (considering decimals)
    const value = Number(rawBalance) / Math.pow(10, decimals);
    
    // Format with appropriate decimal places
    if (value === 0) return "0";
    
    // For very small values (< 0.000001), show up to 8 decimals
    if (value < 0.000001 && value > 0) {
        return value.toFixed(8).replace(/\.?0+$/, '');
    }
    
    // For small values (< 0.01), show up to 6 decimals
    if (value < 0.01) {
        return value.toFixed(6).replace(/\.?0+$/, '');
    }
    
    // For normal values, show up to 4 decimals
    return value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4
    }).replace(/\.?0+$/, '');
}

/**
 * Formats a USD value with appropriate decimal places and suffixes
 * @param value The USD value to format
 * @returns Formatted USD string
 */
export function formatUsdValue(value: number | string): string {
    if (!value) return "$0.00";
    const valueNumber = typeof value === 'string' ? Number(value.replace(/,/g, '')) : value;

    // For very small values, show up to 8 decimals
    if (valueNumber < 0.00001) {
        return `$${formatToNonZeroDecimal(valueNumber).replace(/\.?0+$/, '')}`;
    }
    
    // For small values (under 1), show up to 6 decimals
    if (valueNumber < 1) {
        return `$${formatToNonZeroDecimal(valueNumber).replace(/\.?0+$/, '')}`;
    }
    
    if (valueNumber >= 1000000) {
        return `$${(valueNumber / 1000000).toLocaleString(undefined, { maximumFractionDigits: 2 })}M`;
    }
    if (valueNumber >= 1000) {
        return `$${(valueNumber / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })}K`;
    }
    return `$${valueNumber.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Calculates and formats the USD value of a token amount
 * @param rawBalance The raw balance as a string (big integer format)
 * @param price The token price in USD
 * @param decimals The number of decimals for the token
 * @returns Formatted USD value string
 */
export function formatTokenValue(rawBalance: string, price: number | undefined, decimals: number = 8): string {
    if (!rawBalance || !price) return "$0.00";
    const actualBalance = Number(rawBalance) / Math.pow(10, decimals);
    const value = actualBalance * (price ?? 0);
    return formatUsdValue(value);
}

/**
 * Converts a human-readable amount to raw token amount (considering decimals)
 * @param amount The amount in human-readable format
 * @param decimals The number of decimals for the token
 * @returns Raw amount as a string (big integer format)
 */
export function toRawAmount(amount: string | number, decimals: number = 8): string {
    if (!amount) return "0";
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    return (value * Math.pow(10, decimals)).toFixed(0);
}

/**
 * Converts a raw token amount to human-readable format
 * @param rawAmount The raw amount as a string (big integer format)
 * @param decimals The number of decimals for the token
 * @returns Human-readable amount as a number
 */
export function fromRawAmount(rawAmount: string, decimals: number = 8): number {
    if (!rawAmount) return 0;
    return Number(rawAmount) / Math.pow(10, decimals);
}

/**
 * Formats a gas/fee amount for display
 * @param fee The fee amount in raw format
 * @param token The token information
 * @returns Formatted fee string
 */
export function formatGasFee(fee: string | number | undefined, decimals: number = 8): string {
    if (!fee) return "0";
    const value = typeof fee === 'string' ? Number(fee) : fee;
    const actualFee = value / Math.pow(10, decimals);
    
    // Always show at least 8 decimals for fees to be precise
    return actualFee.toFixed(8).replace(/\.?0+$/, '');
}

/**
 * Formats a number as a percentage with appropriate decimal places
 * @param value The value to format as a percentage
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number): string {
    if (!value && value !== 0) return '0%';
    
    // For very small values, show more decimals
    if (Math.abs(value) < 0.01) {
        return `${value.toFixed(4)}%`;
    }
    
    // For normal values, show 2 decimal places
    return `${value.toFixed(2)}%`;
}
