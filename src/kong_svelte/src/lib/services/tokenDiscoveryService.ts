import { loadBalances } from "$lib/stores/balancesStore";

// Constants for token discovery
const BATCH_SIZE = 25;
const ESSENTIAL_TOKEN_IDS = [
  "ryjl3-tyaaa-aaaaa-aaaba-cai", // ICP
  "o7oak-iyaaa-aaaaq-aadzq-cai", // KONG
  "mxzaz-hqaaa-aaaar-qaada-cai", // CKBTC
  "ss2fx-dyaaa-aaaar-qacoq-cai", // CKETH
  "djua2-fiaaa-aaaar-qaazq-cai", // CKUSDC
  "aanaa-xaaaa-aaaah-aaeiq-cai", // CKUSDT
];

/**
 * Discovers tokens with balance for a given wallet
 * @param walletId - The ID of the wallet to check
 * @param allAvailableTokens - List of all available tokens to check
 * @param enabledTokenIds - Set of currently enabled token IDs
 * @param currentEnabledTokens - List of currently enabled tokens with full data
 * @returns Object containing tokens to add, remove, and sync status
 */
export async function discoverTokens(
  walletId: string,
  allAvailableTokens: FE.Token[],
  enabledTokenIds: Set<string>,
  currentEnabledTokens: FE.Token[]
): Promise<{
  tokensToAdd: FE.Token[];
  tokensToRemove: FE.Token[];
  syncStatus: { added: number; removed: number } | null;
}> {
  if (!walletId || !allAvailableTokens.length) {
    return { tokensToAdd: [], tokensToRemove: [], syncStatus: null };
  }
  
  try {
    // Split tokens into manageable batches to avoid overwhelming the network
    const batches = [];
    for (let i = 0; i < allAvailableTokens.length; i += BATCH_SIZE) {
      batches.push(allAvailableTokens.slice(i, i + BATCH_SIZE));
    }
    
    // Go through each batch and check balances
    let tokensWithBalance = [];
    const allFetchedBalances = new Map<string, { in_tokens: bigint; in_usd: string }>();

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchBalances = await loadBalances(batch, walletId, true);

      // Store balances in our combined map
      Object.entries(batchBalances).forEach(([canisterId, balanceData]) => {
        allFetchedBalances.set(canisterId, balanceData);
      });

      // Find tokens with non-zero balances in this batch
      const batchTokensWithBalance = batch.filter(token => {
        if (!token.canister_id) return false;
        const balance = batchBalances[token.canister_id];
        return balance && balance.in_tokens > 0n;
      });
      
      if (batchTokensWithBalance.length > 0) {
        tokensWithBalance.push(...batchTokensWithBalance);
      }
      
      // Pause between batches to avoid rate limiting
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Find which tokens should be added (have balance but aren't enabled)
    const tokensToAdd = tokensWithBalance.filter(token => 
      token.canister_id && !enabledTokenIds.has(token.canister_id)
    );
    
    // Find tokens with zero balance (potential removal candidates)
    const tokensToRemove = currentEnabledTokens.filter(token => {
      // Skip essential tokens that should never be removed
      if (!token.canister_id) return false;
      if (ESSENTIAL_TOKEN_IDS.includes(token.canister_id)) return false;

      // Check if it has zero balance using the combined fetched balance data
      const balance = allFetchedBalances.get(token.canister_id);
      
      // Check if balance exists AND is explicitly zero
      const isExplicitlyZero = balance && (
        (typeof balance.in_tokens === 'bigint' && BigInt(balance.in_tokens) === 0n) || 
        (typeof balance.in_tokens === 'string' && String(balance.in_tokens) === '0')
      );

      // Check if the balance entry is missing entirely (treat as zero)
      const isMissing = !balance; 
      
      // Mark for removal if explicitly zero OR missing
      return isExplicitlyZero || isMissing;
    });
    
    return {
      tokensToAdd,
      tokensToRemove,
      syncStatus: {
        added: tokensToAdd.length,
        removed: tokensToRemove.length
      }
    };
  } catch (error) {
    console.error("Error during token discovery:", error);
    return { tokensToAdd: [], tokensToRemove: [], syncStatus: null };
  }
}

/**
 * Check if an available token list needs refreshing
 * @param cacheTimestamp - When the cache was last updated
 * @param cacheData - The cached data 
 * @param cacheDuration - How long cache should be valid (ms)
 * @returns Boolean indicating if cache needs refresh
 */
export function shouldRefreshTokenCache(
  cacheTimestamp: number,
  cacheData: any[],
  cacheDuration: number = 30000
): boolean {
  const now = Date.now();
  return now - cacheTimestamp > cacheDuration || !cacheData.length;
} 