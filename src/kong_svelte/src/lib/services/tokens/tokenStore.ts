// src/kong_svelte/src/lib/features/tokens/tokenStore.ts
import { writable, derived, get, type Readable } from 'svelte/store';
import { TokenService } from './TokenService';
import { formatToNonZeroDecimal } from '$lib/utils/numberFormatUtils';
import { toastStore } from '$lib/stores/toastStore';
import BigNumber from 'bignumber.js';
import { walletStore } from '$lib/services/wallet/walletStore';
import { kongDB } from '$lib/services/db/db';
import { Principal } from '@dfinity/principal';

interface TokenState {
  tokens: FE.Token[];
  balances: Record<string, FE.TokenBalance>;
  prices: Record<string, number>;
  isLoading: boolean;
  error: string | null;
  totalValueUsd: string;
  lastTokensFetch: number | null;
  activeSwaps: Record<string, any>;
  favoriteTokens: Record<string, string[]>;
}

BigNumber.config({
  DECIMAL_PLACES: 36,
  ROUNDING_MODE: BigNumber.ROUND_DOWN,
  EXPONENTIAL_AT: [-50, 50]
});

// Helper functions to handle token-specific decimal precision
const toTokenDecimals = (amount: BigNumber | string | number, decimals: number): BigNumber => {
  return new BigNumber(amount).dividedBy(new BigNumber(10 ** decimals));
};

export const fromTokenDecimals = (amount: BigNumber | string | number, decimals: number): BigNumber => {
  return new BigNumber(amount).multipliedBy(new BigNumber(10 ** decimals));
};

// Modify the debounce utility to preserve the return type
const debounce = <T extends (...args: any[]) => any>(fn: T, ms = 300): T => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return ((...args: Parameters<T>): ReturnType<T> => {
        clearTimeout(timeoutId);
        return new Promise((resolve) => {
            timeoutId = setTimeout(() => resolve(fn(...args)), ms);
        }) as ReturnType<T>;
    }) as T;
};

function createTokenStore() {
  const initialState: TokenState = {
    tokens: [],
    balances: {},
    prices: {},
    isLoading: false,
    error: null,
    totalValueUsd: '0.00',
    lastTokensFetch: null,
    activeSwaps: {},
    favoriteTokens: {},
  };

  const store = writable<TokenState>(initialState);
  const getCurrentWalletId = (): string => {
    const wallet = get(walletStore);
    return wallet?.account?.owner?.toString();
  };

  return {
    subscribe: store.subscribe,
    loadTokens: async (forceRefresh = true) => {
      const walletId = getCurrentWalletId();
      
      store.update(s => ({ ...s, isLoading: true }));

      try {
        // Load favorites from DB first
        const favorites = await loadFavoriteTokens(walletId);
        store.update(s => ({
          ...s,
          favoriteTokens: {
            ...s.favoriteTokens,
            [walletId]: favorites
          }
        }));

        // Fetch tokens using TokenService
        const baseTokens = await TokenService.fetchTokens();        
        // Update UI with basic data first
        store.update(s => ({
          ...s,
          tokens: baseTokens,
          lastTokensFetch: Date.now()
        }));

        // Enrich tokens with metadata
        const enrichedTokens = await TokenService.enrichTokenWithMetadata(baseTokens);
        const validTokens = enrichedTokens
          .filter(result => result.status === 'fulfilled')
          .map(result => (result as PromiseFulfilledResult<FE.Token>).value);

        store.update(s => ({
          ...s,
          tokens: validTokens,
          isLoading: false
        }));

        const balances = await tokenStore.loadBalances();
        store.update(s => ({
          ...s,
          balances
        }));

        return validTokens;
      } catch (error: any) {
        console.error('Error loading tokens:', error);
        store.update(s => ({
          ...s,
          error: error.message,
          isLoading: false,
          tokens: []
        }));
        toastStore.error('Failed to load tokens');
        return [];
      }
    },

    loadBalances: async () => {
      const tokenStore = get(store);
      const wallet = get(walletStore);
      if (!wallet?.account?.owner) return {};
      console.log('Loading balances for', wallet.account?.owner?.toString());
      try {
        const balances = await TokenService.fetchBalances(tokenStore.tokens, wallet.account?.owner?.toString());
        
        store.update(s => ({
          ...s,
          balances
        }));
        return balances;
      } catch (error) {
        console.error('Error loading balances:', error);
        toastStore.error('Failed to load balances');
        return {};
      }
    },
    loadBalance: debounce(async (token: FE.Token, principalId?: string, forceRefresh = false): Promise<FE.TokenBalance> => {
      let balance;
      if(!token?.canister_id) {
        return balance = {
          in_tokens: BigInt(0),
          in_usd: formatToNonZeroDecimal(0),
        };
      } else {
        balance = await TokenService.fetchBalance(token, principalId, forceRefresh);
      }
      store.update(s => ({
        ...s,
        balances: {
          ...s.balances,
          [token.canister_id]: balance
        }
      }));
      return {
        in_tokens: balance.in_tokens || BigInt(0),
        in_usd: balance.in_usd || '0'
      };
    }),
    getToken: (canister_id: string): FE.Token | null => {
      return get(store).tokens.find(token => token.canister_id === canister_id) || null;
    },
    refetchPrice: async (token: FE.Token): Promise<number> => {
      const price = await TokenService.fetchPrice(token);
      store.update(s => ({
        ...s,
        prices: { ...s.prices, [token.canister_id]: price }
      }));
      return price;
    },
    clearUserData: async () => {
      const walletId = getCurrentWalletId();
      
      // Clear favorites from DB
      await kongDB.favorite_tokens
        .where('wallet_id')
        .equals(walletId)
        .delete();
      
      store.update(s => ({
        ...s,
        balances: {},
        isLoading: false,
        error: null,
        totalValueUsd: '0.00',
        activeSwaps: {},
        favoriteTokens: {
          ...s.favoriteTokens,
          [walletId]: []
        }
      }));
    },

    clearCache: async () => {
      await TokenService.clearTokenCache();
      store.set(initialState);
    },
    toggleFavorite: async (canister_id: string) => {
      const currentState = get(store);
      const walletId = getCurrentWalletId();
      
      const currentFavorites = currentState.favoriteTokens[walletId] || [];
      const isFavorite = currentFavorites.includes(canister_id);
      
      if (isFavorite) {
        await removeFavoriteToken(canister_id, walletId);
        store.update(s => ({
          ...s,
          favoriteTokens: {
            ...s.favoriteTokens,
            [walletId]: currentFavorites.filter(id => id !== canister_id)
          }
        }));
      } else {
        await saveFavoriteToken(canister_id, walletId);
        store.update(s => ({
          ...s,
          favoriteTokens: {
            ...s.favoriteTokens,
            [walletId]: [...currentFavorites, canister_id]
          }
        }));
      }
    },
    isFavorite: (canister_id: string) => {
      const currentState = get(store);
      const walletId = getCurrentWalletId();
      return currentState.favoriteTokens[walletId]?.includes(canister_id) ?? false;
    },
    getFavorites: (walletId: string = getCurrentWalletId()) => {
      const currentState = get(store);
      return currentState.favoriteTokens[walletId] || [];
    },
    claimFaucetTokens: async () => {
      const result = await TokenService.claimFaucetTokens();
      const store = get(tokenStore);
      await tokenStore.loadBalances();
    }
  };
}

export const tokenStore: {
  subscribe: (run: (value: TokenState) => void) => () => void;
  loadTokens: (forceRefresh?: boolean) => Promise<FE.Token[]>;
  loadBalances: () => Promise<Record<string, FE.TokenBalance>>;
  loadBalance: (token: FE.Token, principalId?: string, forceRefresh?: boolean) => Promise<FE.TokenBalance>;
  refetchPrice: (token: FE.Token) => Promise<number>;
  clearUserData: () => void;
  clearCache: () => Promise<void>;
  toggleFavorite: (canister_id: string) => void;
  isFavorite: (canister_id: string) => boolean;
  getFavorites: (walletId?: string) => string[];
  getToken: (canister_id: string) => FE.Token | null;
  claimFaucetTokens: () => Promise<void>;
} = createTokenStore();

// Derived stores
export const favoriteTokens = derived(
  tokenStore,
  ($store) => {
    const wallet = get(walletStore);
    const walletId = wallet?.account?.owner?.toString() || 'anonymous';
    return $store?.tokens?.filter(token => 
      $store.favoriteTokens[walletId]?.includes(token.canister_id)
    ) ?? [];
  }
);

export const portfolioValue = derived(
  tokenStore,
  ($store) => {
    if (!$store?.tokens) return '0.00';
    let totalValue = 0;

    for (const token of $store.tokens) {
      const usdValue = parseFloat($store.balances[token.canister_id]?.in_usd || '0');
      totalValue += usdValue;
    }

    return formatToNonZeroDecimal(totalValue);
  }
);

export const getTokenDecimals = (canister_id: string): number => {
  const token = get(tokenStore).tokens?.find((t) => t.canister_id === canister_id);
  return token?.decimals || 8;
};

export const clearUserData = () => {
  tokenStore.clearUserData();
};

export const getTokenPrice = (canister_id: string): number => {
  return get(tokenStore).prices[canister_id] || 0;
};

// Add these derived stores
// Derived store to prepare tokens with formatted values
export const formattedTokens: Readable<FE.Token[]> = derived(
  tokenStore,
  ($tokenStore) => {
    if (!$tokenStore?.tokens) return [];
    
    const wallet = get(walletStore);
    const walletId = wallet?.account?.owner?.toString() || 'anonymous';
    
    return $tokenStore.tokens
      .map((token) => {
        const balance = $tokenStore.balances[token.canister_id]?.in_tokens || BigInt(0);
        const amount = toTokenDecimals(balance.toString(), token.decimals);
        
        // Format with token-specific decimal places
        const formattedBalance = amount.toFormat(token.decimals);
        const usdValue = amount.times(token.price);

        return {
          ...token,
          formattedBalance,
          formattedUsdValue: usdValue.toFormat(2),
        };
      })
      .sort((a, b) => {
        // First sort by favorite status
        const aFavorite = $tokenStore.favoriteTokens[walletId]?.includes(a.canister_id) ?? false;
        const bFavorite = $tokenStore.favoriteTokens[walletId]?.includes(b.canister_id) ?? false;
        
        if (aFavorite && !bFavorite) return -1;
        if (!aFavorite && bFavorite) return 1;

        // Then sort by USD value
        const aValue = parseFloat(a.formattedUsdValue.replace(/[^0-9.-]+/g, ''));
        const bValue = parseFloat(b.formattedUsdValue.replace(/[^0-9.-]+/g, ''));
        return bValue - aValue;
      });
  }
);

export const tokenPrices = derived(
  tokenStore,
  ($store) => $store?.prices ?? {}
);


export const toggleFavoriteToken = (canister_id: string): void => {
  tokenStore.toggleFavorite(canister_id);
};

export const isTokenFavorite = (canister_id: string): boolean => {
  const state = get(tokenStore);
  const wallet = get(walletStore);
  const walletId = wallet?.account?.owner?.toString() || 'anonymous';
  return state.favoriteTokens[walletId]?.includes(canister_id) ?? false;
};

export const getFavoritesForWallet = derived(
  tokenStore,
  ($store) => {
    const wallet = get(walletStore);
    const walletId = wallet?.account?.owner?.toString() || 'anonymous';
    return $store?.favoriteTokens[walletId] || [];
  }
);

async function loadFavoriteTokens(walletId: string) {
  try {
    const favorites = await kongDB.favorite_tokens
      .where('wallet_id')
      .equals(walletId)
      .toArray();
    
    return favorites.map(f => f.canister_id);
  } catch (error) {
    console.error('Error loading favorite tokens:', error);
    return [];
  }
}

async function saveFavoriteToken(canister_id: string, walletId: string) {
  try {
    // First check if the entry already exists
    const existing = await kongDB.favorite_tokens
      .where(['canister_id', 'wallet_id'])
      .equals([canister_id, walletId])
      .first();

    if (!existing) {
      // Only add if it doesn't exist
      await kongDB.favorite_tokens.add({
        canister_id: canister_id,
        wallet_id: walletId,
        timestamp: Date.now()
      });
    } else {
      // Optionally update the timestamp if it exists
      await kongDB.favorite_tokens
        .where(['canister_id', 'wallet_id'])
        .equals([canister_id, walletId])
        .modify({ timestamp: Date.now() });
    }
  } catch (error) {
    console.error('Error saving favorite token:', error);
  }
}

async function removeFavoriteToken(canister_id: string, walletId: string) {
  try {
    await kongDB.favorite_tokens
      .where(['canister_id', 'wallet_id'])
      .equals([canister_id, walletId])
      .delete();
  } catch (error) {
    console.error('Error removing favorite token:', error);
  }
}
