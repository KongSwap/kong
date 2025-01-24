/**
 * Formats a USD value with appropriate decimal places and suffixes
 * @param value The USD value to format
 * @returns Formatted USD string
 */
export function formatUsdValue(value: number | string): string {
    if (!value) return "$0.00";
    const valueNumber = typeof value === 'string' ? Number(value.replace(/,/g, '')) : value;

    // For extremely small values (< 0.00001), show scientific notation
    if (valueNumber < 0.01 && valueNumber > 0) {
        return `< $0.01`;
    }
    
    // For very small values (< 0.01), show up to 6 decimals
    if (valueNumber < 0.01 && valueNumber > 0) {
        return `$${valueNumber.toFixed(6).replace(/\.?0+$/, '')}`;
    }

    // For small values (0.01 to 1), show up to 4 decimals
    if (valueNumber < 1 && valueNumber >= 0.01) {
        return `$${valueNumber.toFixed(4).replace(/\.?0+$/, '')}`;
    }

    if (valueNumber >= 1_000_000_000) {
        return `$${(valueNumber / 1000000000).toLocaleString(undefined, { maximumFractionDigits: 2 })}B`;
    }
    if (valueNumber >= 1000000) {
        return `$${(valueNumber / 1000000).toLocaleString(undefined, { maximumFractionDigits: 2 })}M`;
    }
    if (valueNumber >= 1000) {
        return `$${(valueNumber / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })}K`;
    }
    
    // For normal values (>= 1), show 2 decimals
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

export function formatTokenBalance(amount: string | bigint, decimals: number): string {
    if (!amount) return '0';
    
    const value = typeof amount === 'string' ? BigInt(amount) : amount;
    const divisor = BigInt(10 ** decimals);
    const integerPart = value / divisor;
    const fractionalPart = value % divisor;
    
    let result = integerPart.toString();
    
    if (fractionalPart > 0) {
        let fraction = fractionalPart.toString().padStart(decimals, '0');
        // Remove trailing zeros
        fraction = fraction.replace(/0+$/, '');
        if (fraction.length > 0) {
            result += '.' + fraction;
        }
    }
    
    return result;
}