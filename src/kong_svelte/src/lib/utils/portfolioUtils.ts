/**
 * Utility functions for calculating portfolio values consistently across the application
 */

/**
 * Calculate total portfolio value from token balances and liquidity pools
 * @param balances Object containing token balances with USD values
 * @param pools Array of liquidity pool positions
 * @returns Total portfolio value in USD
 */
export function calculatePortfolioValue(
  balances: Record<string, any> = {},
  pools: any[] = []
): number {
  // Calculate value from token balances
  const tokensValue = Object.values(balances || {})
    .reduce((acc: number, balance: any) => {
      if (balance && balance.in_usd) {
        // Safely convert to number, handling non-numeric strings
        const numValue = parseFloat(balance.in_usd);
        return acc + (isNaN(numValue) ? 0 : numValue);
      }
      return acc;
    }, 0);
  
  // Calculate value from liquidity pools
  const poolsValue = (pools || []).reduce((acc, pool: any) => {
    // Safely convert usd_balance to number, handling all edge cases
    let usdBalance = 0;
    if (pool && pool.usd_balance) {
      usdBalance = parseFloat(pool.usd_balance);
      if (isNaN(usdBalance)) usdBalance = 0;
    }
    return acc + usdBalance;
  }, 0);
  
  // Return combined value
  return tokensValue + poolsValue;
}

/**
 * Format currency for display
 * @param value Number to format as currency
 * @param minimumFractionDigits Minimum fraction digits (default: 2)
 * @param maximumFractionDigits Maximum fraction digits (default: 2)
 * @returns Formatted currency string
 */
export function formatCurrency(
  value: number,
  minimumFractionDigits = 2,
  maximumFractionDigits = 2
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits,
    maximumFractionDigits
  }).format(value);
} 