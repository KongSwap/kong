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
}

function createTokenStore() {
  const { subscribe, set, update } = writable<TokenState>({
    tokens: [],
    balances: {},
    isLoading: false,
    error: null,
    totalValueUsd: '0.00'
  });

  return {
    subscribe,
    getBalance: (symbol: string) => {
      // Get the current store value
      let storeValue: TokenState;
      const unsubscribe = subscribe(value => {
        storeValue = value;
      });
      unsubscribe();

      // Return the balance for the given symbol, or 0 if not found
      return storeValue.balances[symbol]?.balance || '0';
    },
    loadTokens: async () => {
      update(s => ({ ...s, isLoading: true }));
      try {
          const tokens = await backendService.getTokens();
          console.log('Loaded tokens:', tokens); // Add this debug log
          if (!Array.isArray(tokens)) {
              throw new Error('Invalid tokens response');
          }
          update(s => ({
              ...s,
              tokens,
              isLoading: false
          }));
      } catch (error) {
          console.error('Error loading tokens:', error);
          update(s => ({
              ...s,
              error: error.message,
              isLoading: false
          }));
      }
    },
    loadBalances: async (principal: Principal) => {
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

        update(s => ({
          ...s,
          balances: formattedBalances,
          totalValueUsd: totalValueUsd.toFixed(2),
          isLoading: false
        }));
      } catch (error) {
        update(s => ({ ...s, error: error.message, isLoading: false }));
      }
    }
  };
}

export const tokenStore = createTokenStore();
