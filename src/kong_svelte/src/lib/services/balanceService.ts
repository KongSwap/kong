import { loadBalances as apiLoadBalances } from "$lib/stores/balancesStore";
import { userTokens } from "$lib/stores/userTokens";
import { get } from "svelte/store";

/**
 * Loads user balances with retry and refresh options
 * @param walletId - The wallet ID to load balances for
 * @param forceRefresh - Whether to force a refresh of balances
 * @returns Promise resolving to true if balances were loaded successfully
 */
export async function loadUserBalances(
  walletId: string,
  forceRefresh = false
): Promise<boolean> {
  const userTokensList = get(userTokens.tokens);
  
  if (!walletId || userTokensList.length === 0) {
    return false;
  }
  
  try {
    if (forceRefresh) {
      // Force token data refresh BEFORE balances are loaded to use latest prices
      await userTokens.refreshTokenData();

      // Request balance refresh for all tokens, not just enabled ones
      // This helps discover tokens that have balances but aren't enabled
      const allTokens = get(userTokens.tokens);
      await apiLoadBalances(allTokens, walletId, true);
      
      return true;
    } else {
      // For normal updates, check if we need to refresh - reduced to 30 seconds for more frequent updates
      const shouldRefresh = Date.now() - getLastRefreshed() > 30000;
      
      if (shouldRefresh) {
        // Also refresh token data during periodic updates
        await userTokens.refreshTokenData();

        // OPTIMIZATION: Only load balances for ENABLED tokens during normal refresh
        const enabledTokenIds = get(userTokens.enabledTokens);
        const enabledTokens = get(userTokens.tokens).filter(token =>
          token.address && enabledTokenIds.has(token.address)
        );
        
        if (enabledTokens.length > 0) {
          await apiLoadBalances(enabledTokens, walletId, true);
          return true;
        }
      } 
      
      return false;
    }
  } catch (err) {
    console.error("❌ balanceService: Error loading balances:", err);
    throw err;
  }
}

// Store the last refreshed timestamp (could be moved to a store for persistence)
let lastRefreshed = Date.now();

/**
 * Gets the timestamp when balances were last refreshed
 * @returns Timestamp when balances were last refreshed
 */
export function getLastRefreshed(): number {
  return lastRefreshed;
}

/**
 * Sets the timestamp when balances were last refreshed
 * @param timestamp - New timestamp
 */
export function setLastRefreshed(timestamp: number): void {
  lastRefreshed = timestamp;
} 