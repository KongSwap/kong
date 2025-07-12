import { writable, get } from "svelte/store";
import { Principal } from "@dfinity/principal";
import { auth } from "$lib/stores/auth";
import { userTokens } from "$lib/stores/userTokens";

// Create a store for balances
export const currentUserBalancesStore = writable<Record<string, TokenBalance>>({});

// Define a new implementation of loadBalances to avoid circular dependencies
export const loadBalances = async (
  tokens: Kong.Token[],
  principalId: string,
  forceRefresh = false
): Promise<Record<string, TokenBalance>> => {
  // For empty or invalid input, return empty results
  if (!tokens || tokens.length === 0 || !principalId || principalId === "anonymous") {
    return {};
  }

  try {
    const results: Record<string, TokenBalance> = {};
    const balancesToUpdate: Array<{
      address: string;
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
          address: canisterId,
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
): Promise<TokenBalance> => {
  // Helper function for default/empty balance
  const emptyBalance = (): TokenBalance => ({
    in_tokens: BigInt(0),
    in_usd: "0",
  });

  const authStore = get(auth);
  const owner = authStore.account?.owner || "anonymous";
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
  const token = userTokensStore.tokens.find(t => t.address === canisterId);
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
  tokens: Kong.Token[],
  principalId: string,
  forceRefresh = false
): Promise<Record<string, TokenBalance>> => {
  return loadBalances(tokens, principalId, forceRefresh);
};

// Validation function for tokens
export const isValidToken = (token: any): boolean => {
  return (
    token && 
    typeof token === 'object' && 
    typeof token.address === 'string' && 
    token.address.includes('-') &&  // Must have a subnet delimiter
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
      {} as Record<string, TokenBalance>,
    );
  } catch (error) {
    console.error("Error getting stored balances:", error);
    return {};
  }
};

// Helper function to update balances in the store
export const updateBalancesInStore = (entries: Array<{
  address: string;
  in_tokens: bigint;
  in_usd: string;
}>) => {
  if (entries.length > 0) {
    const newBalances = { ...get(currentUserBalancesStore) };
    entries.forEach(entry => {
      newBalances[entry.address] = {
        in_tokens: entry.in_tokens,
        in_usd: entry.in_usd,
      };
    });
    
    currentUserBalancesStore.set(newBalances);
  }
};

// Helper function to ensure balances are loaded after authentication
export const ensureBalancesLoaded = async (forceRefresh = false): Promise<void> => {
  const authStore = get(auth);
  const userTokensStore = get(userTokens);
  
  if (!authStore.isConnected || !authStore.account?.owner) {
    return;
  }
  
  const owner = authStore.account.owner;
  const tokens = Array.from(userTokensStore.tokenData.values());
  
  // If we have tokens, load balances
  if (tokens.length > 0) {
    await loadBalances(tokens, owner, forceRefresh);
  } else {
    // If no tokens yet, wait a bit and try again
    await new Promise(resolve => setTimeout(resolve, 500));
    const updatedTokens = Array.from(get(userTokens).tokenData.values());
    if (updatedTokens.length > 0) {
      await loadBalances(updatedTokens, owner, forceRefresh);
    }
  }
};

// Helper function to convert Principal to string
function convertPrincipalToString(principalId: string | Principal): string {
  return typeof principalId === 'string' ? principalId : principalId.toString();
}

// Function to refresh a single token's balance
export const refreshSingleBalance = async (
  token: Kong.Token,
  principalId: string | Principal,
  forceRefresh = true
): Promise<TokenBalance | null> => {
  if (!isValidToken(token) || !principalId) {
    console.warn('Cannot refresh balance - invalid token or missing principal');
    return null;
  }

  try {
    const principalIdString = convertPrincipalToString(principalId);
    // Use loadBalances for a single token to leverage its retry logic
    const balances = await refreshBalances([token], principalIdString, forceRefresh);
    
    if (balances && balances[token.address]) {
      return balances[token.address];
    }
    return null;
  } catch (error) {
    console.error(`Error refreshing balance for ${token.symbol}:`, error);
    return null;
  }
};

// Helper function to check if a user has sufficient balance for a transaction
export const hasSufficientBalance = (
  token: Kong.Token,
  amount: string
): boolean => {
  if (!isValidToken(token) || !amount) return false;
  
  const store = get(currentUserBalancesStore);
  const balance = store[token.address];
  
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