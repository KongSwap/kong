import { writable, get } from "svelte/store";
import { Principal } from "@dfinity/principal";
import { auth } from "$lib/services/auth";
import type { AuthStore } from "$lib/services/auth"; // Import the AuthStore type
import { BigNumber } from "bignumber.js";
import { userTokens } from "$lib/stores/userTokens";

// Create a store for balances
export const currentUserBalancesStore = writable<Record<string, FE.TokenBalance>>({});

// Define a new implementation of loadBalances to avoid circular dependencies
export const loadBalances = async (
  tokens: FE.Token[],
  principalId: string,
  forceRefresh = false
): Promise<Record<string, FE.TokenBalance>> => {
  // For empty or invalid input, return empty results
  if (!tokens || tokens.length === 0 || !principalId || principalId === "anonymous") {
    return {};
  }

  try {
    const results: Record<string, FE.TokenBalance> = {};
    const balancesToUpdate: Array<{
      canister_id: string;
      in_tokens: bigint;
      in_usd: string;
    }> = [];

    // Use existing balances if not forcing refresh
    if (!forceRefresh) {
      const existingBalances = get(currentUserBalancesStore);
      if (Object.keys(existingBalances).length > 0) {
        return existingBalances;
      }
    }

    // Import here to avoid circular dependency
    // This is a dynamic import that will only be called when needed
    const balancesApi = await import("$lib/api/balances");
    
    // Call the API to fetch balances
    const balances = await balancesApi.fetchBalances(tokens, principalId, forceRefresh);
    
    if (balances && Object.keys(balances).length > 0) {
      // Update our local results map and prepare updates for the store
      for (const [canisterId, balance] of Object.entries(balances)) {
        results[canisterId] = {
          in_tokens: balance.in_tokens,
          in_usd: balance.in_usd
        };

        balancesToUpdate.push({
          canister_id: canisterId,
          in_tokens: balance.in_tokens,
          in_usd: balance.in_usd
        });
      }

      // Update the store with new balances
      updateBalancesInStore(balancesToUpdate);
    }

    return results;
  } catch (error) {
    console.error("Error loading balances:", error);
    return {};
  }
};

// Wrapper for loadBalance that uses the API client
export const loadBalance = async (
  canisterId: string, 
  forceRefresh = false
): Promise<FE.TokenBalance> => {
  // Helper function for default/empty balance
  const emptyBalance = (): FE.TokenBalance => ({
    in_tokens: BigInt(0),
    in_usd: "0",
  });

  const authStore = get(auth);
  const owner = authStore.account?.owner?.toString() || "anonymous";
  const userTokensStore = get(userTokens);

  // Check database first if not forcing refresh
  if (!forceRefresh) {
    const existingBalance = get(currentUserBalancesStore)[canisterId];

    if (existingBalance) {
      // Use stored balances
      return {
        in_tokens: existingBalance.in_tokens,
        in_usd: existingBalance.in_usd,
      };
    }
  }

  // Find the token
  const token = userTokensStore.tokens.find(t => t.canister_id === canisterId);
  if (!token) {
    console.warn(`Token not found for canister ID: ${canisterId}`);
    return emptyBalance();
  }

  // Use loadBalances to load the balance
  try {
    const balances = await loadBalances([token], owner, forceRefresh);
    return balances[canisterId] || emptyBalance();
  } catch (error) {
    console.error("Error loading balance:", error);
    return emptyBalance();
  }
};

// Wrapper for fetchBalances
export const refreshBalances = async (
  tokens: FE.Token[],
  principalId: string,
  forceRefresh = false
): Promise<Record<string, FE.TokenBalance>> => {
  return loadBalances(tokens, principalId, forceRefresh);
};

// Validation function for tokens
export const isValidToken = (token: any): boolean => {
  return (
    token && 
    typeof token === 'object' && 
    typeof token.canister_id === 'string' && 
    token.canister_id.includes('-') &&  // Must have a subnet delimiter
    typeof token.symbol === 'string' && 
    (typeof token.decimals === 'number' || typeof token.decimals === 'string')
  );
};

// Helper function to get stored balances
export const getStoredBalances = async (walletId: string) => {
  if (!walletId || walletId === "anonymous") {
    return {};
  }

  try {
    const storedBalances = get(currentUserBalancesStore);

    return Object.entries(storedBalances).reduce(
      (acc, [canisterId, balance]) => {
        acc[canisterId] = {
          in_tokens: balance.in_tokens,
          in_usd: balance.in_usd,
        };
        return acc;
      },
      {} as Record<string, FE.TokenBalance>,
    );
  } catch (error) {
    console.error("Error getting stored balances:", error);
    return {};
  }
};

// Helper function to update balances in the store
export const updateBalancesInStore = (entries: Array<{
  canister_id: string;
  in_tokens: bigint;
  in_usd: string;
}>) => {
  if (entries.length > 0) {
    const newBalances = { ...get(currentUserBalancesStore) };
    entries.forEach(entry => {
      newBalances[entry.canister_id] = {
        in_tokens: entry.in_tokens,
        in_usd: entry.in_usd,
      };
    });
    
    currentUserBalancesStore.set(newBalances);
  }
};

// Helper function to convert Principal to string
function convertPrincipalToString(principalId: string | Principal): string {
  return typeof principalId === 'string' ? principalId : principalId.toString();
}

// Function to refresh a single token's balance
export const refreshSingleBalance = async (
  token: FE.Token,
  principalId: string | Principal,
  forceRefresh = true
): Promise<FE.TokenBalance | null> => {
  if (!isValidToken(token) || !principalId) {
    console.warn('Cannot refresh balance - invalid token or missing principal');
    return null;
  }

  try {
    const principalIdString = convertPrincipalToString(principalId);
    // Use loadBalances for a single token to leverage its retry logic
    const balances = await refreshBalances([token], principalIdString, forceRefresh);
    
    if (balances && balances[token.canister_id]) {
      return balances[token.canister_id];
    }
    return null;
  } catch (error) {
    console.error(`Error refreshing balance for ${token.symbol}:`, error);
    return null;
  }
};

// Helper function to check if a user has sufficient balance for a transaction
export const hasSufficientBalance = (
  token: FE.Token,
  amount: string
): boolean => {
  if (!isValidToken(token) || !amount) return false;
  
  const store = get(currentUserBalancesStore);
  const balance = store[token.canister_id];
  
  if (!balance) return false;
  
  try {
    const amountValue = Number(amount);
    const decimals = Number(token.decimals);
    const rawBalance = balance.in_tokens.toString();
    const adjustedBalance = Number(rawBalance) / Math.pow(10, decimals);
    
    return amountValue <= adjustedBalance;
  } catch (error) {
    console.error('Error checking balance sufficiency:', error);
    return false;
  }
}; 