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
    console.warn('⚠️ balanceService: Exiting early - wallet ID missing or no tokens', {
      walletId: !!walletId,
      tokensLength: userTokensList.length
    });
    return false;
  }
  
  try {
    if (forceRefresh) {
      console.log('🔄 balanceService: Force refreshing token data and balances');
      // Force token data refresh BEFORE balances are loaded to use latest prices
      await userTokens.refreshTokenData();
      console.log('📊 balanceService: Token data refreshed, now loading all balances');

      // Request balance refresh for all tokens, not just enabled ones
      // This helps discover tokens that have balances but aren't enabled
      const allTokens = get(userTokens.tokens);
      console.log(`📋 balanceService: Loading balances for ${allTokens.length} tokens`);
      await apiLoadBalances(allTokens, walletId, true);
      
      console.log('✅ balanceService: Successfully loaded balances with force refresh');
      return true;
    } else {
      // For normal updates, check if we need to refresh - reduced to 30 seconds for more frequent updates
      const shouldRefresh = Date.now() - getLastRefreshed() > 30000;
      console.log('⏱️ balanceService: Should refresh based on time?', shouldRefresh, 'Last refreshed:', new Date(getLastRefreshed()).toISOString());
      
      if (shouldRefresh) {
        console.log('🔄 balanceService: Time-based refresh needed, refreshing token data');
        // Also refresh token data during periodic updates
        await userTokens.refreshTokenData();

        // OPTIMIZATION: Only load balances for ENABLED tokens during normal refresh
        const enabledTokenIds = get(userTokens.enabledTokens);
        const enabledTokens = get(userTokens.tokens).filter(token =>
          token.address && enabledTokenIds.has(token.address)
        );
        
        if (enabledTokens.length > 0) {
          await apiLoadBalances(enabledTokens, walletId, true);
          console.log('✅ balanceService: Successfully loaded balances for enabled tokens');
          return true;
        } else {
          console.log('⚠️ balanceService: No enabled tokens found to refresh');
        }
      } else {
        console.log('🔍 balanceService: No refresh needed based on time');
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
  console.log('🕒 balanceService: Setting lastRefreshed to', new Date(timestamp).toISOString());
  lastRefreshed = timestamp;
} 