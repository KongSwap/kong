// src/kong_svelte/src/lib/services/tokens/tokenStore.ts
import { readable, derived, writable } from "svelte/store";
import { liveQuery } from "dexie";
import { kongDB } from "$lib/services/db";
import { browser } from "$app/environment";
import { TokenService } from "./TokenService";
import BigNumber from "bignumber.js";
import { get } from "svelte/store";
import { auth } from "$lib/services/auth";
import type { TokenState, TokenBalance } from "./types";

function createTokenStore() {
  const initialState: TokenState = {
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
      set([]); 
    },
  });
  
  return () => {
    subscription?.unsubscribe();
  }
});

export const formattedTokens = derived(liveTokens, ($liveTokens) => {
  return $liveTokens.map((t) => ({
    ...t,
    formattedPrice: Number(t.metrics?.price || 0).toFixed(2),
  }));
});

const getCurrentWalletId = (): string => {
  const wallet = get(auth);
  return wallet?.account?.owner?.toString() || "anonymous";
};

// Create a temporary store for user pools that we'll sync later
const userPoolsStore = writable<UserPoolBalance[]>([]);

export const getStoredBalances = async (walletId: string) => {
  if (!walletId || walletId === "anonymous") {
    return {};
  }

  try {
    const storedBalances = await kongDB.token_balances
      .where('wallet_id')
      .equals(walletId)
      .toArray();

    return storedBalances.reduce((acc, balance) => {
      acc[balance.canister_id] = {
        in_tokens: balance.in_tokens,
        in_usd: balance.in_usd
      };
      return acc;
    }, {} as Record<string, FE.TokenBalance>);
  } catch (error) {
    console.error('Error getting stored balances:', error);
    return {};
  }
};

// Create a store for balances
export const storedBalancesStore = writable({});

// Update it whenever needed
export const updateStoredBalances = async (walletId: string) => {
  const balances = await getStoredBalances(walletId);
  storedBalancesStore.set(balances);
};

// Make portfolioValue sync by using the stored balances
export const portfolioValue = derived(
  [tokenStore, liveTokens, userPoolsStore, storedBalancesStore],
  ([$tokenStore, $liveTokens, $userPools, $storedBalances]) => {
    const tokenValue = ($liveTokens || []).reduce((acc, token) => {
      const balance = $storedBalances[token.canister_id]?.in_usd;
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

export const loadBalances = async (owner: string, opts?: { tokens?: FE.Token[], forceRefresh?: boolean }) => {
  let { tokens, forceRefresh } = opts || { tokens: await kongDB.tokens.toArray(), forceRefresh: false };
  const currentWalletId = getCurrentWalletId();
  
  if(!currentWalletId || currentWalletId === "anonymous") {
    return {};
  }

  try {
    const balances = await TokenService.fetchBalances(tokens, owner, forceRefresh);
    
    // Store balances in the database
    const balanceEntries = Object.entries(balances).map(([canisterId, balance]) => ({
      wallet_id: currentWalletId,
      canister_id: canisterId,
      in_tokens: balance.in_tokens,
      in_usd: balance.in_usd,
      timestamp: Date.now()
    }));

    await kongDB.token_balances.bulkPut(balanceEntries);
    
    // Update both stores
    tokenStore.update(state => ({
      ...state,
      balances
    }));
    
    // Update the storedBalancesStore
    await updateStoredBalances(currentWalletId);
    
    return balances;
  } catch (error) {
    console.error("Error loading balances:", error);
    return {};
  }
};

export const loadBalance = async (canisterId: string, forceRefresh = false) => {
  try {
    if (get(tokenStore).pendingBalanceRequests.has(canisterId)) {
      return {};
    }

    const owner = getCurrentWalletId();
    tokenStore.addPendingRequest(canisterId);

    const token = await kongDB.tokens.get(canisterId);
    if (!token) {
      console.warn(`Token not found for canister ID: ${canisterId}`);
      tokenStore.removePendingRequest(canisterId);
      return {};
    }

    // Check database first if not forcing refresh
    if (!forceRefresh) {
      const existingBalance = await kongDB.token_balances
        .where(['wallet_id', 'canister_id'])
        .equals([owner, canisterId])
        .first();

      if (existingBalance) {
        const balance = {
          [canisterId]: {
            in_tokens: existingBalance.in_tokens,
            in_usd: existingBalance.in_usd
          }
        };
        
        // Update storedBalancesStore
        await updateStoredBalances(owner);
        
        tokenStore.removePendingRequest(canisterId);
        return balance;
      }
    }

    const balances = await TokenService.fetchBalances([token], owner, forceRefresh);
    
    if (balances[canisterId]) {
      await kongDB.token_balances.put({
        wallet_id: owner,
        canister_id: canisterId,
        in_tokens: balances[canisterId].in_tokens,
        in_usd: balances[canisterId].in_usd,
        timestamp: Date.now()
      });
      
      // Update storedBalancesStore
      await updateStoredBalances(owner);
    }

    tokenStore.removePendingRequest(canisterId);
    return balances;
  } catch (error) {
    console.error('Error loading balance:', error);
    tokenStore.removePendingRequest(canisterId);
    return {};
  }
};

export const getTokenDecimals = async (canisterId: string) => {
  const token = await kongDB.tokens.get(canisterId);
  return token?.decimals || 0;
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
