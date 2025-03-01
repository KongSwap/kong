// src/kong_svelte/src/lib/services/tokens/tokenStore.ts
import { derived, writable, get } from "svelte/store";
import { TokenService } from "./TokenService";
import BigNumber from "bignumber.js";
import { auth } from "$lib/services/auth";
import type { TokenState } from "./types";
import { userTokens } from "$lib/stores/userTokens";
import { userPoolListStore } from "$lib/stores/userPoolListStore";
import { fetchTokensByCanisterId } from "$lib/api/tokens";

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

const getCurrentWalletId = (): string => {
  const wallet = get(auth);
  return wallet?.account?.owner?.toString() || "anonymous";
};

export const getStoredBalances = async (walletId: string) => {
  if (!walletId || walletId === "anonymous") {
    return {};
  }

  try {
    const storedBalances = get(currentUserBalancesStore);

    return Object.entries(storedBalances).reduce(
      (acc, [canisterId, balance]: [string, TokenBalance]) => {
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

// Create a store for balances
export const currentUserBalancesStore = writable({});

// Update it whenever needed
export const updateStoredBalances = async (walletId: string) => {
  const balances = await getStoredBalances(walletId);
  currentUserBalancesStore.set(balances);
};

// Create a store to track when updates are in progress
export const isUpdatingPortfolio = writable(false);

// Update the portfolioValue derived store
export const portfolioValue = derived(
  [userTokens, userPoolListStore, currentUserBalancesStore, isUpdatingPortfolio],
  ([$userTokens, $userPoolListStore, $storedBalances, $isUpdating], set) => {
    // If we're in the middle of updating, don't update the value
    if ($isUpdating) {
      return; // Keep the previous value
    }
    
    // Calculate token values
    const tokenValue = ($userTokens.tokens || []).reduce((acc, token) => {
      const balance = $storedBalances[token.canister_id]?.in_usd;
      if (balance && balance !== "0") {
        return acc + Number(balance);
      }
      return acc;
    }, 0);

    // Calculate pool values using processedPools, ensuring the array exists
    const poolValue = ($userPoolListStore.processedPools || []).reduce((acc, pool) => {
      const value = pool && pool.usd_balance ? Number(pool.usd_balance) : 0;
      return acc + value;
    }, 0);

    // Combine values and format
    const totalValue = tokenValue + poolValue;
    set(totalValue.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }));
  },
  "0.00" // Default value
);

export const loadBalances = async (
  owner: string,
  opts?: { tokens?: FE.Token[]; forceRefresh?: boolean },
) => {
  const userTokensStore = get(userTokens);
  let { tokens, forceRefresh } = opts || {
    tokens: userTokensStore.tokens,
    forceRefresh: false,
  };
  const currentWalletId = getCurrentWalletId();

  if (!currentWalletId || currentWalletId === "anonymous") {
    console.log('No wallet ID or anonymous user');
    return {};
  }

  if (!tokens || tokens.length === 0) {
    tokens = userTokensStore.tokens;
  }

  try {
    // Get fresh balances
    const balances = await TokenService.fetchBalances(
      tokens,
      owner,
      forceRefresh,
    );
    
    // Validate that we received actual balances
    if (!balances || Object.keys(balances).length === 0) {
      console.log('No balances received from TokenService');
      return {};
    }

    // Batch update the database
    const entries = Object.entries(balances)
      .filter(([_, balance]) => balance.in_tokens !== undefined && balance.in_usd !== undefined)
      .map(([canisterId, balance]) => ({
        wallet_id: currentWalletId,
        canister_id: canisterId,
        in_tokens: balance.in_tokens,
        in_usd: balance.in_usd,
        timestamp: Date.now(),
      }));

    if (entries.length > 0) {
      // Update the store only if we have valid balances
      const newBalances = { ...get(currentUserBalancesStore) };
      entries.forEach(entry => {
        newBalances[entry.canister_id] = {
          in_tokens: entry.in_tokens,
          in_usd: entry.in_usd,
        };
      });
      
      currentUserBalancesStore.set(newBalances);
    }

    return balances;
  } catch (error) {
    console.error("Error loading balances:", error);
    return {};
  }
};

export const loadBalance = async (canisterId: string, forceRefresh = false) => {
  const authStore = get(auth);
  if(!authStore.isConnected) {
    return {};
  }

  try {
    if (get(tokenStore).pendingBalanceRequests.has(canisterId)) {
      return {};
    }

    const owner = getCurrentWalletId();
    const userTokensStore = get(userTokens);
    tokenStore.addPendingRequest(canisterId);

    const token = userTokensStore.tokens.find(t => t.canister_id === canisterId);
    if (!token) {
      console.warn(`Token not found for canister ID: ${canisterId}`);
      tokenStore.removePendingRequest(canisterId);
      return {};
    }

    // Check database first if not forcing refresh
    if (!forceRefresh) {
      const existingBalance = get(currentUserBalancesStore)[canisterId];

      if (existingBalance) {
        const balance = {
          [canisterId]: {
            in_tokens: existingBalance.in_tokens,
            in_usd: existingBalance.in_usd,
          },
        };

        // Update currentUserBalancesStore
        await updateStoredBalances(owner);

        tokenStore.removePendingRequest(canisterId);
        return balance;
      }
    }

    const balances = await TokenService.fetchBalances(
      [token],
      owner,
      forceRefresh,
    );

    if (balances[canisterId]) {
      // Update currentUserBalancesStore
      await updateStoredBalances(owner);
    }

    tokenStore.removePendingRequest(canisterId);
    return balances;
  } catch (error) {
    console.error("Error loading balance:", error);
    tokenStore.removePendingRequest(canisterId);
    return {};
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
