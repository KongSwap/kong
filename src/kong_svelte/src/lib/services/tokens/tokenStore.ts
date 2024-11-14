// src/kong_svelte/src/lib/features/tokens/tokenStore.ts
import { writable, derived, get, type Readable } from 'svelte/store';
import { TokenService } from '$lib/services/tokens/TokenService';
import { browser } from '$app/environment';
import { formatToNonZeroDecimal } from '$lib/utils/numberFormatUtils';
import { toastStore } from '$lib/stores/toastStore';
import BigNumber from 'bignumber.js';
import { walletStore } from '$lib/services/wallet/walletStore';

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

const CACHE_DURATION = 1000 * 60 * 3; // 3 minutes in milliseconds

// Base BigNumber configuration for internal calculations
// Set this high enough to handle intermediate calculations without loss of precision
BigNumber.config({
  DECIMAL_PLACES: 36, // High enough for internal calculations
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

// Add BigInt serialization handler
const serializeState = (state: TokenState): string => {
  return JSON.stringify(state, (key, value) => {
    // Convert BigInt to string during serialization
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  });
};

// Add BigInt deserialization handler
const deserializeState = (cachedData: string): TokenState => {
  return JSON.parse(cachedData, (key, value) => {
    // Handle potential BigInt values
    if (typeof value === 'string' && /^\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1));
    }
    return value;
  });
};

// Debounced save to cache with a longer delay to reduce frequency
const saveToCache = (state: TokenState) => {
  if (browser) {
    try {
      localStorage.setItem('tokenStore', serializeState(state));
    } catch (error) {
      console.error('Error saving token data to cache:', error);
    }
  }
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
    favoriteTokens: {} as Record<string, string[]>,
  };

  const store = writable<TokenState>(initialState);

  // Load cached state on initialization
  if (browser) {
    try {
      const cached = localStorage.getItem('tokenStore');
      const wallet = get(walletStore);
      if (cached) {
        const cachedData = deserializeState(cached);
        if (!cachedData.favoriteTokens[wallet?.account?.owner?.toString() || 'anonymous']) {
          cachedData.favoriteTokens[wallet?.account?.owner?.toString() || 'anonymous'] = [];
        }
        console.log('Loaded cached token data:', cachedData);
        store.set(cachedData);
      }
    } catch (error) {
      console.error('Error loading cached token data:', error);
    }
  }

  const shouldRefetch = (lastFetch: number | null): boolean => {
    if (!lastFetch) return true;
    return Date.now() - lastFetch > CACHE_DURATION;
  };

  const getCurrentState = (): TokenState => get(store);

  const getCurrentWalletId = (): string => {
    const wallet = get(walletStore);
    return wallet?.account?.owner?.toString() || 'anonymous';
  };

  const getFavoritesForCurrentWallet = (): string[] => {
    const currentState = getCurrentState();
    const walletId = getCurrentWalletId();
    return currentState.favoriteTokens[walletId] || [];
  };

  const updateState = (newState: TokenState) => {
    store.set(newState);
    saveToCache(newState);
  };

  return {
    subscribe: store.subscribe,
    loadTokens: async (forceRefresh = false) => {
      const currentState = getCurrentState();

      if (!forceRefresh && !shouldRefetch(currentState.lastTokensFetch)) {
        return currentState.tokens;
      }

      store.update((s) => ({ ...s, isLoading: true, tokens: [] }));

      try {
        const baseTokens = await TokenService.fetchTokens();
        console.log(baseTokens);

        // Extract IC tokens and map them to FE.Token[]
        const icTokens: FE.Token[] = baseTokens
            .filter((token): token is { IC: BE.ICToken } => token.IC !== undefined)
            .map((token) => {
                const icToken = token.IC;
                return {
                    canister_id: icToken.canister_id,
                    name: icToken.name,
                    symbol: icToken.symbol,
                    fee: icToken.fee,
                    decimals: icToken.decimals,
                    token: icToken.token,
                    token_id: icToken.token_id,
                    chain: icToken.chain,
                    icrc1: icToken.icrc1,
                    icrc2: icToken.icrc2,
                    icrc3: icToken.icrc3,
                    on_kong: icToken.on_kong,
                    pool_symbol: icToken.pool_symbol ?? "Pool not found",
                    // Optional fields
                    logo: "/tokens/not_verified.webp",
                    total_24h_volume: undefined,
                    price: undefined,
                    tvl: undefined,
                    balance: undefined,
                } as FE.Token;
            });

        const enrichedTokens = await TokenService.enrichTokenWithMetadata(icTokens);

        updateState({
            ...currentState,  // Preserve existing state
            tokens: enrichedTokens.map(result => result.status === 'fulfilled' ? result.value : null).filter(Boolean) as FE.Token[],
            isLoading: false,
            lastTokensFetch: Date.now(),
            error: null,
        });

        return enrichedTokens;
      } catch (error: any) {
        console.error('Error loading tokens:', error);
        updateState({
            ...currentState,  // Preserve existing state
            error: error.message,
            isLoading: false,
            tokens: []
        });
        toastStore.error('Failed to load tokens');
      }
    },
    getBalance: (canisterId: string) => {
      const currentState = getCurrentState();
      return currentState.balances[canisterId] || { in_tokens: BigInt(0), in_usd: '0' };
    },
    refreshBalance: async (token: FE.Token) => {
      const currentState = getCurrentState();
      const balance = await TokenService.fetchBalance(token);
      updateState({ ...currentState, balances: { ...currentState.balances, [token.canister_id]: { in_tokens: BigInt(balance), in_usd: '0' } } });
    },
    loadBalance: async (token: FE.Token) => {
      const currentState = getCurrentState();
      const balance = await TokenService.fetchBalance(token);
      updateState({ ...currentState, balances: { ...currentState.balances, [token.canister_id]: { in_tokens: BigInt(balance), in_usd: '0' } } });
    },
    loadBalances: async () => {
      const currentState = getCurrentState();
      store.update(s => ({ ...s, isLoading: true }));

      try {
        const [balances, prices] = await Promise.allSettled([
          TokenService.fetchBalances(currentState.tokens),
          TokenService.fetchPrices(currentState.tokens) // Fetch prices
        ]);

        const formattedBalances = Object.entries(balances.status === 'fulfilled' ? balances.value : {}).reduce<Record<string, FE.TokenBalance>>(
          (acc, [key, value]) => ({
            ...acc,
            [key]: value
          }), 
          {}
        );

        const newState: TokenState = {
          ...currentState,
          balances: formattedBalances,
          prices: prices.status === 'fulfilled' ? prices.value : {},
          isLoading: false
        };

        updateState(newState);
        return formattedBalances;
      } catch (error) {
        console.error('Error loading balances:', error);
        this.clearCache();
        store.update(s => ({ 
          ...s, 
          error: error.message, 
          isLoading: false 
        }));
      }
    },
    clearUserData: () => {
      const currentState = getCurrentState();
      const walletId = getCurrentWalletId();
      
      // Only clear favorites for current wallet
      const newFavorites = { ...currentState.favoriteTokens };
      delete newFavorites[walletId];

      const newState = {
        ...currentState,
        balances: {},
        isLoading: false,
        error: null,
        totalValueUsd: '0.00',
        activeSwaps: {},
        favoriteTokens: newFavorites,
      };
      store.set(newState);
      saveToCache(newState);
    },
    clearCache: () => {
      if (browser) localStorage.removeItem('tokenStore');
      store.set({
        tokens: [],
        balances: {},
        prices: {},
        isLoading: false,
        error: null,
        totalValueUsd: '0.00',
        lastTokensFetch: null,
        activeSwaps: {},
        favoriteTokens: {},
      });
    },
    getTokenPrices: () => {
      const currentState = getCurrentState();
      return currentState.prices;
    },
    claimFaucetTokens: async () => {
      return await TokenService.claimFaucetTokens();
    },
    toggleFavorite: (canisterId: string) => {
      const currentState = getCurrentState();
      const walletId = getCurrentWalletId();
      
      // Initialize favorites for the current wallet if they don't exist
      const currentFavorites = currentState.favoriteTokens[walletId] || [];
      
      // Toggle the favorite status
      const newFavorites = currentFavorites.includes(canisterId)
        ? currentFavorites.filter(id => id !== canisterId)
        : [...currentFavorites, canisterId];

      // Update the state with the new favorites for the current wallet
      const newState = {
        ...currentState,
        favoriteTokens: {
          ...currentState.favoriteTokens,
          [walletId]: newFavorites
        }
      };
      
      console.log(`Saving favorites for wallet ${walletId}:`, newFavorites);
      updateState(newState);
    },

    isFavorite: (canisterId: string) => {
      const currentState = getCurrentState();
      const walletId = getCurrentWalletId();
      return currentState.favoriteTokens[walletId]?.includes(canisterId) ?? false;
    }
  };
}

export const tokenStore = createTokenStore();

// Export convenience functions
export const toggleFavoriteToken = (canisterId: string) => tokenStore.toggleFavorite(canisterId);
export const isTokenFavorite = (canisterId: string) => tokenStore.isFavorite(canisterId);

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

// Other derived stores
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
        const price = $tokenStore.prices[token.canister_id] || new BigNumber(0);
        const amount = toTokenDecimals(balance.toString(), token.decimals);
        
        // Format with token-specific decimal places
        const formattedBalance = amount.toFormat(token.decimals);
        const usdValue = amount.times(price);

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

export const getTokenByCanisterId = (canisterId: string): FE.Token | undefined => {
  return get(tokenStore).tokens.find((token) => token.canister_id === canisterId);
};

export const getTokenDecimals = (symbol: string): number => {
  const token = get(tokenStore).tokens?.find((t) => t.symbol === symbol);
  return token?.decimals || 8;
};

export const getTokenBalance = (canisterId: string): FE.TokenBalance => {
  const balance = get(tokenStore).balances[canisterId] || { in_tokens: BigInt(0), in_usd: '0' };
  return balance;
};

export const clearUserData = () => {
  tokenStore.clearUserData();
};

export const getTokenPrice = (canisterId: string): number => {
  const price = get(tokenStore).prices[canisterId] || 0;
  const tokens = get(tokenStore).tokens;
  // update the token store tokens with the price
  tokens.forEach((token) => {
    if (token.canister_id === canisterId) {
      token.price = price;
    }
  });
  return price;
};

export const activeSwaps = derived(
  tokenStore,
  ($store) => {
    if (!$store?.activeSwaps) return [];
    
    return Object.entries($store.activeSwaps)
      .map(([id, swap]) => {
        const payTokenInfo = $store.tokens?.find(t => t.symbol === swap.payToken);
        if (!payTokenInfo) return null;

        const price = $store.prices[swap.payToken] || new BigNumber(0);
        const formattedAmount = toTokenDecimals(swap.amount, payTokenInfo.decimals);
        const valueUsd = formattedAmount.times(price);

        return {
          id,
          ...swap,
          age: Date.now() - swap.timestamp,
          formattedAmount: formattedAmount.toNumber(),
          valueUsd: valueUsd.toFormat(2)
        };
      })
      .filter(Boolean);
  }
);

export const getFavoritesForWallet = derived(
  tokenStore,
  ($store) => {
    const wallet = get(walletStore);
    const walletId = wallet?.account?.owner?.toString() || 'anonymous';
    return $store?.favoriteTokens[walletId] || [];
  }
);

export const tokenLogos = writable<Record<string, string>>({});