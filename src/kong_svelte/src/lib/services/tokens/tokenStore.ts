// src/kong_svelte/src/lib/services/tokens/tokenStore.ts
import { readable, derived, writable } from "svelte/store";
import { liveQuery } from "dexie";
import { kongDB } from "$lib/services/db";
import { browser } from "$app/environment";
import { TokenService } from "./TokenService";
import BigNumber from "bignumber.js";
import { get } from "svelte/store";
import { auth } from "$lib/services/auth";
import { type TokenState } from "./types";

function createTokenStore() {
  const initialState: TokenState = {
    balances: {},
    isLoading: false,
    error: null,
    lastTokensFetch: null,
    activeSwaps: {},
    pendingBalanceRequests: new Set<string>()
  };
  const store = writable<TokenState>(initialState);

  return {
    subscribe: store.subscribe,
    update: store.update,
    isPendingBalanceRequest: (canisterId: string) => {
      return get(store).pendingBalanceRequests.has(canisterId);
    },
    addPendingRequest: (canisterId: string) => {
      store.update(s => {
        const pendingBalanceRequests = new Set(s.pendingBalanceRequests);
        pendingBalanceRequests.add(canisterId);
        return { ...s, pendingBalanceRequests };
      });
    },
    removePendingRequest: (canisterId: string) => {
      store.update(s => {
        const pendingBalanceRequests = new Set(s.pendingBalanceRequests);
        pendingBalanceRequests.delete(canisterId);
        return { ...s, pendingBalanceRequests };
      });
    }
  };
}

export const tokenStore = createTokenStore();

export const liveTokens = readable<FE.Token[]>([], (set) => {
  if (!browser) {
    return;
  }
  const subscription = liveQuery(() => kongDB.tokens.toArray()).subscribe({
    next: (tokens) => {
      set(tokens || []);
    },
    error: (error) => {
      console.error("Error loading tokens from Dexie liveQuery:", error);
      set([]); 
    },
  });
  return () => subscription?.unsubscribe();
});

export const formattedTokens = derived(liveTokens, ($liveTokens) => {
  return $liveTokens.map((t) => ({
    ...t,
    // Example: ensuring price is displayed with 2 decimal places
    formattedPrice: Number(t.metrics?.price || 0).toFixed(2),
  }));
});

const getCurrentWalletId = (): string => {
  const wallet = get(auth);
  return wallet?.account?.owner?.toString() || "anonymous";
};

// Create a temporary store for user pools that we'll sync later
const userPoolsStore = writable<FE.UserPoolBalance[]>([]);

export const portfolioValue = derived(
  [tokenStore, liveTokens, userPoolsStore],
  ([$tokenStore, $liveTokens, $userPools]: [TokenState, FE.Token[], FE.UserPoolBalance[]]) => {
    // Calculate token values
    const tokenValue = ($liveTokens || []).reduce((acc, token) => {
      const balance = $tokenStore?.balances[token.canister_id]?.in_usd;
      // Only add if balance exists and is not '0'
      if (balance && balance !== '0') {
        return acc + Number(balance);
      }
      return acc;
    }, 0);

    // Calculate pool values
    const poolValue = ($userPools || []).reduce((acc, pool) => {
      const balance = pool.usd_balance;
      if (balance && Number(balance) > 0) {
        return acc + Number(balance);
      }
      return acc;
    }, 0);

    // Combine values and format
    const totalValue = tokenValue + poolValue;
    return totalValue.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  }
);

export const loadTokens = async (forceRefresh = false) => {
  try {
    const baseTokens = await TokenService.fetchTokens();
    if (!baseTokens || baseTokens.length === 0) {
      throw new Error("No tokens fetched from service");
    }

    if (browser) {
      await kongDB.tokens.bulkPut(baseTokens);
    }

    return baseTokens;
  } catch (error: any) {
    console.error("Error loading tokens:", error);
    throw error;
  }
};
  

export const loadBalances = async (owner: string, opts?: { tokens?: FE.Token[], forceRefresh?: boolean }) => {
  // Get owner ID once and store it
  let { tokens, forceRefresh } = opts || { tokens: await kongDB.tokens.toArray(), forceRefresh: false };
  const currentWalletId = getCurrentWalletId();
  
  if(!currentWalletId || currentWalletId === "anonymous") {
    return {};
  }

  try {
    const balances = await TokenService.fetchBalances(tokens, owner, forceRefresh);
    
    tokenStore.update(state => ({
      ...state,
      balances: {
        ...state.balances,
        ...balances
      }
    }));
    
    return balances;
  } catch (error) {
    console.error("Error loading balances:", error);
    return {};
  }
};

export const loadBalance = async (canisterId: string, forceRefresh = false) => {
  // Add defensive check for canisterId
  if (!canisterId) {
    console.warn('Invalid canister ID provided to loadBalance');
    return {};
  }

  try {
    // Early return if we're already loading this balance
    if (get(tokenStore).pendingBalanceRequests.has(canisterId)) {
      return {};
    }

    const owner = getCurrentWalletId();
    if (owner === "anonymous") {
      return {};
    }

    // Mark this request as pending
    tokenStore.addPendingRequest(canisterId);

    const token = await kongDB.tokens.get(canisterId);
    if (!token) {
      console.warn(`Token not found for canister ID: ${canisterId}`);
      tokenStore.removePendingRequest(canisterId);
      return {};
    }

    const currentBalance = get(tokenStore).balances[canisterId];
    if (!forceRefresh && currentBalance !== undefined) {
      tokenStore.removePendingRequest(canisterId);
      return { [canisterId]: currentBalance };
    }

    const balances = await TokenService.fetchBalances([token], owner, forceRefresh);
    
    tokenStore.update(state => ({
      ...state,
      balances: {
        ...state.balances,
        [canisterId]: balances[canisterId]
      }
    }));

    // Remove from pending requests after completion
    tokenStore.removePendingRequest(canisterId);
    
    return balances;
  } catch (error) {
    console.error('Error loading balance:', error);
    // Make sure to remove from pending even on error
    tokenStore.removePendingRequest(canisterId);
    return {};
  }
};

export const getTokenDecimals = async (canisterId: string) => {
  const token = await kongDB.tokens.get(canisterId);
  return token?.decimals || 0;
};


export const toTokenDecimals = (amount: bigint | string, decimals: number): BigNumber => {
  if (typeof amount === 'string') {
    // Handle empty string or invalid number
    if (!amount || isNaN(Number(amount))) {
      return new BigNumber(0);
    }
    return new BigNumber(amount).div(Math.pow(10, decimals));
  }
  return new BigNumber(amount.toString()).div(Math.pow(10, decimals));
};

export const fromTokenDecimals = (amount: BigNumber | string, decimals: number): bigint => {
  try {
    const amountBN = typeof amount === 'string' ? new BigNumber(amount || '0') : amount;
    if (amountBN.isNaN()) {
      return BigInt(0);
    }
    const multiplier = new BigNumber(10).pow(decimals);
    const result = amountBN.times(multiplier);
    // Remove any decimal places and convert to string for BigInt
    const wholePart = result.integerValue(BigNumber.ROUND_DOWN).toString();
    return BigInt(wholePart);
  } catch (error) {
    console.error('Error converting to token decimals:', error);
    return BigInt(0);
  }
};

// Export a function to sync the userPoolsStore with liveUserPools
export const syncUserPools = (pools: FE.UserPoolBalance[]) => {
  userPoolsStore.set(pools);
};
