// src/kong_svelte/src/lib/stores/tokenStore.ts
import { derived, writable, get } from "svelte/store";
import { TokenService } from "$lib/services/tokens/TokenService";
import BigNumber from "bignumber.js";
// Import from auth.ts but only for types
import type { AuthStore } from "$lib/services/auth";
import type { TokenState } from "$lib/services/tokens/types";
import { userTokens } from "$lib/stores/userTokens";
import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
import { fetchTokensByCanisterId } from "$lib/api/tokens";
import { fetchBalance, fetchBalances } from "$lib/api/balances";
import { currentUserBalancesStore, getStoredBalances, updateStoredBalances } from "$lib/stores/balancesStore";

// Re-export the balances store
export { currentUserBalancesStore } from "$lib/stores/balancesStore";

function createTokenStore() {
  const initialState: TokenState = {
    activeSwaps: {},
    pendingBalanceRequests: new Set<string>(),
  };
  const store = writable<TokenState>(initialState);

  return {
    subscribe: store.subscribe,
    update: store.update,
    isPendingBalanceRequest: (canisterId: string) => {
      return get(store).pendingBalanceRequests.has(canisterId);
    },
    addPendingRequest: (canisterId: string) => {
      store.update((s) => {
        const pendingBalanceRequests = new Set(s.pendingBalanceRequests);
        pendingBalanceRequests.add(canisterId);
        return { ...s, pendingBalanceRequests };
      });
    },
    removePendingRequest: (canisterId: string) => {
      store.update((s) => {
        const pendingBalanceRequests = new Set(s.pendingBalanceRequests);
        pendingBalanceRequests.delete(canisterId);
        return { ...s, pendingBalanceRequests };
      });
    },
  };
}

export const tokenStore = createTokenStore();

// Function to get wallet ID safely without circular dependency
const getCurrentWalletId = (auth: AuthStore): string => {
  try {
    const wallet = get(auth);
    return wallet?.account?.owner?.toString() || "anonymous";
  } catch (error) {
    console.warn("Error getting wallet ID:", error);
    return "anonymous";
  }
};

// Update the portfolioValue derived store
export const portfolioValue = derived(
  [userTokens, currentUserPoolsStore, currentUserBalancesStore],
  ([$userTokens, $currentUserPoolsStore, $storedBalances]) => {
    // Calculate token values
    const tokenValue = ($userTokens.tokens || []).reduce((acc, token) => {
      const balance = $storedBalances[token.canister_id]?.in_usd;
      if (balance && balance !== "0") {
        return acc + Number(balance);
      }
      return acc;
    }, 0);

    // Calculate pool values using processedPools, ensuring the array exists
    const poolValue = ($currentUserPoolsStore.processedPools || []).reduce((acc, pool) => {
      const value = pool && pool.usd_balance ? Number(pool.usd_balance) : 0;
      return acc + value;
    }, 0);

    // Combine values and format
    const totalValue = tokenValue + poolValue;
    return totalValue.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  },
);

// Wrapper for loadBalance that uses the API client
export const loadBalance = async (
  canisterId: string, 
  auth: AuthStore,
  forceRefresh = false
): Promise<FE.TokenBalance> => {
  // Helper function for default/empty balance
  const emptyBalance = (): FE.TokenBalance => ({
    in_tokens: BigInt(0),
    in_usd: "0",
  });

  const authStore = get(auth);
  if(!authStore.isConnected) {
    return emptyBalance();
  }

  const owner = getCurrentWalletId(auth);
  const userTokensStore = get(userTokens);

  // Check database first if not forcing refresh
  if (!forceRefresh) {
    const existingBalance = get(currentUserBalancesStore)[canisterId];

    if (existingBalance) {
      // Update currentUserBalancesStore
      await updateStoredBalances(owner);
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

  // Use the balances API to load the balance
  try {
    tokenStore.addPendingRequest(canisterId);
    const balance = await fetchBalance(token, owner, forceRefresh);
    tokenStore.removePendingRequest(canisterId);
    return balance;
  } catch (error) {
    console.error("Error loading balance:", error);
    tokenStore.removePendingRequest(canisterId);
    return emptyBalance();
  }
};

export const getTokenDecimals = async (canisterId: string) => {
  const token = get(userTokens).tokens.find(t => t.canister_id === canisterId) || await fetchTokensByCanisterId([canisterId])[0];
  return token?.decimals || 0;
};

export const fromTokenDecimals = (
  amount: BigNumber | string,
  decimals: number,
): bigint => {
  try {
    const amountBN =
      typeof amount === "string" ? new BigNumber(amount || "0") : amount;
    if (amountBN.isNaN()) {
      return BigInt(0);
    }
    const multiplier = new BigNumber(10).pow(decimals);
    const result = amountBN.times(multiplier);
    // Remove any decimal places and convert to string for BigInt
    const wholePart = result.integerValue(BigNumber.ROUND_DOWN).toString();
    return BigInt(wholePart);
  } catch (error) {
    console.error("Error converting to token decimals:", error);
    return BigInt(0);
  }
};

// Re-export loadBalances for backward compatibility
export { fetchBalances as loadBalances } from "$lib/api/balances";
