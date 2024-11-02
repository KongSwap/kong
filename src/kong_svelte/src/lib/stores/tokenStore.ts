// src/kong_svelte/src/lib/stores/tokenStore.ts
import { writable, derived, get, type Readable } from 'svelte/store';
import { TokenService } from '$lib/services/TokenService';
import { browser } from '$app/environment';
import { debounce } from 'lodash-es';
import { formatUSD, formatTokenAmount } from '$lib/utils/numberFormatUtils';

interface TokenState {
  readonly tokens: FE.Token[];
  readonly balances: Record<string, FE.TokenBalance>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly totalValueUsd: string;
  readonly lastTokensFetch: number | null;
}

const CACHE_DURATION = 1000 * 60 * 1; // 1 minute in milliseconds

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
const saveToCache = debounce((state: TokenState) => {
  if (browser) {
    try {
      localStorage.setItem('tokenStore', serializeState(state));
    } catch (error) {
      console.error('Error saving token data to cache:', error);
    }
  }
}, 3500); // Increased debounce delay

function createTokenStore() {
  const store = writable<TokenState>({
    tokens: [],
    balances: {},
    isLoading: false,
    error: null,
    totalValueUsd: '0.00',
    lastTokensFetch: null
  });

  // Load cached state on initialization
  if (browser) {
    try {
      const cached = localStorage.getItem('tokenStore');
      if (cached) {
        const cachedData = deserializeState(cached);
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

  const enrichTokens = async (tokens: FE.Token[]): Promise<FE.Token[]> => {
    return Promise.all(tokens.map(token => TokenService.enrichTokenWithMetadata(token)));
  };

  const updateState = (newState: TokenState) => {
    const currentState = get(store);
    if (serializeState(currentState) !== serializeState(newState)) {
      store.set(newState);
      saveToCache(newState);
    }
  };

  const reloadTokensAndBalances = async () => {
    try {
      await tokenStore.loadTokens(true); // Force refresh
      await tokenStore.loadBalances();
    } catch (error) {
      console.error("Failed to reload tokens and balances:", error);
    }
  };

  return {
    subscribe: store.subscribe,
    loadTokens: async (forceRefresh = false) => {
      const currentState = getCurrentState();

      if (!forceRefresh && !shouldRefetch(currentState.lastTokensFetch)) {
        return currentState.tokens;
      }

      store.update(s => ({ ...s, isLoading: true }));
      
      try {
        const baseTokens = await TokenService.fetchTokens();
        const enrichedTokens = await enrichTokens(baseTokens);

        const newState: TokenState = {
          ...currentState,
          tokens: enrichedTokens,
          isLoading: false,
          lastTokensFetch: Date.now()
        };

        updateState(newState);
        return enrichedTokens;
      } catch (error) {
        console.error('Error loading tokens:', error);
        this.clearCache();
        store.update(s => ({
          ...s,
          error: error.message,
          isLoading: false
        }));
        return [];
      }
    },
    getBalance: (canisterId: string) => {
      const currentState = getCurrentState();
      return currentState.balances[canisterId] || '0';
    },
    loadBalances: async () => {
      const currentState = getCurrentState();
      store.update(s => ({ ...s, isLoading: true }));

      try {
        const [balances, prices] = await Promise.all([
          TokenService.fetchBalances(currentState.tokens),
          TokenService.fetchPrices(currentState.tokens) // Batch fetch prices
        ]);

        const formattedBalances = Object.entries(balances).reduce<Record<string, FE.TokenBalance>>(
          (acc, [key, value]) => ({
            ...acc,
            [key]: value
          }), 
          {}
        );

        const newState: TokenState = {
          ...currentState,
          balances: formattedBalances,
          isLoading: false
          // Optionally update totalValueUsd here if needed
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
    clearCache: () => {
      if (browser) localStorage.removeItem('tokenStore');
      store.set({
        tokens: [],
        balances: {},
        isLoading: false,
        error: null,
        totalValueUsd: '0.00',
        lastTokensFetch: null
      });
    },
    reloadTokensAndBalances
  };
}

export const tokenStore = createTokenStore();

// Memoize the portfolio value calculation
const calculatePortfolioValue = (balances: Record<string, FE.TokenBalance>, tokens: FE.Token[]) => {
  let total = 0;
  // Assuming TokenService.fetchPrices is optimized for batch processing
  return TokenService.fetchPrices(tokens)
    .then(prices => {
      for (const [canisterId, balance] of Object.entries(balances)) {
        const token = tokens.find(t => t.canister_id === canisterId);
        if (token && prices[canisterId]) {
          const actualBalance = formatTokenAmount(balance.in_tokens, token.decimals);
          total += actualBalance * prices[canisterId];
        }
      }
      return formatUSD(total);
    })
    .catch(error => {
      console.error('Error calculating portfolio value:', error);
      return formatUSD(0);
    });
};

// Derived stores for better separation
const balancesStore = derived(tokenStore, $tokenStore => $tokenStore.balances);
const tokensStore = derived(tokenStore, $tokenStore => $tokenStore.tokens);

export const portfolioValue: Readable<string> = derived(
  [balancesStore, tokensStore],
  ([$balances, $tokens], set) => {
    calculatePortfolioValue($balances, $tokens).then(set);
  }
);

// Derived store to prepare tokens with formatted values
export const formattedTokens = derived(
  [tokenStore, portfolioValue],
  ([tokenStore, portfolioValue]) => {
    return {
      tokens: tokenStore.tokens.map(token => {
        const balance = tokenStore.balances[token.canister_id]?.in_tokens || 0;
        const usdValue = tokenStore.balances[token.canister_id]?.in_usd || 0;
        return {
          ...token,
          logo: token.logo || '/tokens/not_verified.webp', // Ensure logo is always defined
          formattedBalance: formatTokenAmount(balance, token.decimals),
          formattedUsdValue: formatUSD(Number(usdValue)) || '0',
        };
      }),
      portfolioValue: formatUSD(portfolioValue) || '0',
    };
  }
);
