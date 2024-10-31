// src/kong_svelte/src/lib/stores/tokenStore.ts
import { writable, derived, get } from 'svelte/store';
import { TokenService } from '$lib/services/TokenService';
import { browser } from '$app/environment';
import { debounce } from 'lodash-es';
import { formatUSD, formatTokenAmount } from '$lib/utils/formatNumberCustom';


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

// Debounced save to cache
const saveToCache = debounce((state: TokenState) => {
  if (browser) {
    try {
      localStorage.setItem('tokenStore', serializeState(state));
    } catch (error) {
      console.error('Error saving token data to cache:', error);
    }
  }
}, 1000);

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
    }
  };
}

export const tokenStore = createTokenStore();

// Derived stores for better separation
const balancesStore = derived(tokenStore, $tokenStore => $tokenStore.balances);
const tokensStore = derived(tokenStore, $tokenStore => $tokenStore.tokens);

export const portfolioValue = derived(
  [balancesStore, tokensStore],
  ([$balances, $tokens], set) => {
    let total = 0;
    TokenService.fetchPrices($tokens)
      .then(prices => {
        for (const [canisterId, balance] of Object.entries($balances)) {
          const token = $tokens.find(t => t.canister_id === canisterId);
          if (token && prices[canisterId]) {
            const actualBalance = formatTokenAmount(balance.in_tokens, token.decimals);
            total += actualBalance * prices[canisterId];
          }
        }
        set(formatUSD(total));
      })
      .catch(error => {
        console.error('Error calculating portfolio value:', error);
        set(formatUSD(0));
      });
  }
);
