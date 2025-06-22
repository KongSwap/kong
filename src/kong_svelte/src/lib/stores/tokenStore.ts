// src/kong_svelte/src/lib/stores/tokenStore.ts
import { derived, writable, get } from "svelte/store";
import BigNumber from "bignumber.js";
import { userTokens } from "$lib/stores/userTokens";
import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
import { 
  currentUserBalancesStore, 
  loadBalance, 
  loadBalances, 
} from "$lib/stores/balancesStore";
import { fetchTokensByCanisterId } from "$lib/api/tokens";

export interface TokenState {
  activeSwaps: Record<string, any>;
  pendingBalanceRequests: Set<string>;
}


// Create a writable store for tracking portfolio update status
export const isUpdatingPortfolio = writable<boolean>(false);

// Re-export important functions for backward compatibility
export { 
  loadBalance,
  loadBalances,
  currentUserBalancesStore
};

// Create a fallback empty store for balances in case the imported one is not available
const fallbackBalancesStore = writable<Record<string, TokenBalance>>({});
const fallbackUserTokensStore = writable({ enabledTokens: {}, tokens: [], isAuthenticated: false });
const fallbackUserPoolsStore = writable({ processedPools: [] });

// Make sure we have valid stores, especially important for SSR
const safeBalancesStore = currentUserBalancesStore || fallbackBalancesStore;
const safeUserTokensStore = userTokens || fallbackUserTokensStore;
const safeUserPoolsStore = currentUserPoolsStore || fallbackUserPoolsStore;

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

// Update the portfolioValue derived store with safe stores
export const portfolioValue = derived(
  [safeUserTokensStore, safeUserPoolsStore, safeBalancesStore],
  ([$userTokens, $currentUserPoolsStore, $storedBalances]) => {
    // Make sure all stores are initialized before accessing properties
    if (!$userTokens || !$storedBalances) {
      return "0.00";
    }

    // Calculate token values with proper null checking
    const tokenValue = ($userTokens.tokens || []).reduce((acc, token) => {
      if (!token || !token.address) return acc;
      const balance = $storedBalances[token.address]?.in_usd;
      if (balance && balance !== "0") {
        return acc + Number(balance);
      }
      return acc;
    }, 0);

    // Calculate pool values using processedPools, ensuring the array exists
    const poolValue = ($currentUserPoolsStore?.processedPools || []).reduce((acc, pool) => {
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
