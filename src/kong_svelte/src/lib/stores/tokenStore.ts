import { writable } from 'svelte/store';
import type { Principal } from '@dfinity/principal';

interface TokenBalance {
  balance: string;
  in_usd: string;
}

interface TokenStore {
  balances: Record<string, TokenBalance>;
  favoriteTokens: Record<string, string[]>;
}

const initialState: TokenStore = {
  balances: {},
  favoriteTokens: {}
};

function createTokenStore() {
  const { subscribe, set, update } = writable<TokenStore>(initialState);

  return {
    subscribe,
    setBalance: (canisterId: string, balance: TokenBalance) =>
      update(state => ({
        ...state,
        balances: { ...state.balances, [canisterId]: balance }
      })),
    loadBalance: async (token: any, owner: string | undefined, forceRefresh = false) => {
      if (!owner) return;
      // Implement balance loading logic here
    },
    setFavoriteTokens: (owner: string, tokens: string[]) =>
      update(state => ({
        ...state,
        favoriteTokens: { ...state.favoriteTokens, [owner]: tokens }
      })),
    reset: () => set(initialState)
  };
}

export const tokenStore = createTokenStore();
