// src/lib/stores/tokenStore.ts
import { writable } from 'svelte/store';
import { TokenService } from '$lib/services/TokenService';
import { browser } from '$app/environment';
import { formatTokenBalance } from '$lib/utils/formatNumberCustom';

export interface TokenBalance {
  balance: string;
  valueUsd: string;
}

interface TokenState {
  tokens: FE.Token[];
  balances: Record<string, string>;
  isLoading: boolean;
  error: string | null;
  totalValueUsd: string;
  lastTokensFetch: number | null;
}

const CACHE_DURATION = 1000* 60 * 1; // 1 minute in milliseconds

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

function createTokenStore() {
  const { subscribe, set, update } = writable<TokenState>({
    tokens: [],
    balances: {},
    isLoading: false,
    error: null,
    totalValueUsd: '0.00',
    lastTokensFetch: null
  });

  if (browser) {
    // Try to load cached data from localStorage
    try {
      const cached = localStorage.getItem('tokenStore');
      if (cached) {
        const cachedData = deserializeState(cached);
        set(cachedData);
      }
    } catch (error) {
      console.error('Error loading cached token data:', error);
    }
  }

  const saveToCache = (state: TokenState) => {
    if (browser) {
      try {
        localStorage.setItem('tokenStore', serializeState(state));
      } catch (error) {
        console.error('Error saving token data to cache:', error);
      }
    }
  };

  const shouldRefetch = (lastFetch: number | null): boolean => {
    if (!lastFetch) return true;
    return Date.now() - lastFetch > CACHE_DURATION;
  };

  const getCurrentState = (): TokenState => {
    let currentState: TokenState;
    const unsubscribe = subscribe(value => {
      currentState = value;
    });
    unsubscribe();
    return currentState;
  };

  const enrichTokens = async (tokens: FE.Token[]): Promise<FE.Token[]> => {
    return Promise.all(
      tokens.map(token => TokenService.enrichTokenWithMetadata(token))
    );
  };

  const calculateTotalValue = (
    balances: Record<string, bigint>,
    prices: Record<string, number>
  ): number => {
    return Object.entries(balances).reduce((total, [canisterId, balance]) => {
      const price = prices[canisterId] || 0;
      return total + (Number(balance) * price);
    }, 0);
  };

  return {
    subscribe,
    loadTokens: async (forceRefresh = false) => {
      const currentState = getCurrentState();

      if (!forceRefresh && !shouldRefetch(currentState.lastTokensFetch)) {
        return currentState.tokens;
      }

      update(s => ({ ...s, isLoading: true }));
      
      try {
        const baseTokens = await TokenService.fetchTokens();
        const enrichedTokens = await enrichTokens(baseTokens);

        const newState = {
          ...currentState,
          tokens: enrichedTokens,
          isLoading: false,
          lastTokensFetch: Date.now()
        };

        set(newState);
        saveToCache(newState);
        return enrichedTokens;
      } catch (error) {
        console.error('Error loading tokens:', error);
        update(s => ({
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
      update(s => ({ ...s, isLoading: true }));

      try {
        const [balances, prices] = await Promise.all([
          TokenService.fetchBalances(currentState.tokens),
          TokenService.fetchPrices(currentState.tokens)
        ]);

        const totalValueUsd = calculateTotalValue(balances, prices);
        const formattedBalances = Object.entries(balances).reduce(
          (acc, [key, value]) => ({
            ...acc,
            [key]: value.toString()
          }), 
          {}
        );

        const newState = {
          ...currentState,
          balances: formattedBalances,
          totalValueUsd: formatTokenBalance(totalValueUsd.toString(), 2),
          isLoading: false
        };

        set(newState);
        return formattedBalances;
      } catch (error) {
        console.error('Error loading balances:', error);
        update(s => ({ 
          ...s, 
          error: error.message, 
          isLoading: false 
        }));
      }
    },
    clearCache: () => {
      localStorage.removeItem('tokenStore');
      set({
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
