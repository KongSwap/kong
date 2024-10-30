// src/lib/stores/tokenStore.ts
import { writable } from 'svelte/store';
import type { Token } from '$lib/types/backend';
import { backendService } from '$lib/services/backendService';
import type { Principal } from '@dfinity/principal';

interface TokenBalance {
  balance: string;
  valueUsd: string;
}

interface TokenState {
  tokens: Token[];
  balances: Record<string, TokenBalance>;
  isLoading: boolean;
  error: string | null;
  totalValueUsd: string;
  lastTokensFetch: number | null;
}

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

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

  const saveToCache = (state: TokenState) => {
    try {
      localStorage.setItem('tokenStore', serializeState(state));
    } catch (error) {
      console.error('Error saving token data to cache:', error);
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

  return {
    subscribe,
    getBalance: (symbol: string) => {
      const currentState = getCurrentState();
      return currentState.balances[symbol]?.balance || '0';
    },
    loadTokens: async (forceRefresh = false) => {
      const currentState = getCurrentState();

      // Check if we should use cached data
      if (!forceRefresh && 
          currentState.tokens.length > 0 && 
          currentState.lastTokensFetch && 
          !shouldRefetch(currentState.lastTokensFetch)) {
        console.log('Using cached token data');
        return currentState.tokens;
      }

      update(s => ({ ...s, isLoading: true }));
      
      try {
        const tokens = await backendService.getTokens();
        
        if (!Array.isArray(tokens)) {
          throw new Error('Invalid tokens response');
        }

        // Fetch all logos in parallel
        const tokensWithLogos = await Promise.all(
          tokens.map(async (token) => {
            try {
              const logo = await backendService.getIcrcLogFromMetadata(token.canisterId);
              return { ...token, logo };
            } catch (error) {
              console.error(`Error fetching logo for token ${token.canisterId}:`, error);
              return { ...token, logo: null };
            }
          })
        );

        const newState = {
          ...currentState,
          tokens: tokensWithLogos,
          isLoading: false,
          lastTokensFetch: Date.now()
        };

        set(newState);
        saveToCache(newState);

        return tokensWithLogos;
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
    loadBalances: async (principal: Principal) => {
      const currentState = getCurrentState();
      update(s => ({ ...s, isLoading: true }));

      try {
        const [balances, prices] = await Promise.all([
          backendService.getUserBalances(principal),
          backendService.getTokenPrices()
        ]);
        
        let totalValueUsd = 0;
        const formattedBalances = {};

        Object.entries(balances).forEach(([token, balance]) => {
          const price = prices[token] || 0;
          const valueUsd = Number(balance) * price;
          totalValueUsd += valueUsd;
          formattedBalances[token] = {
            balance: balance.toString(),
            valueUsd: valueUsd.toFixed(2)
          };
        });

        const newState = {
          ...currentState,
          balances: formattedBalances,
          totalValueUsd: totalValueUsd.toFixed(2),
          isLoading: false
        };

        set(newState);
        saveToCache(newState);
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
