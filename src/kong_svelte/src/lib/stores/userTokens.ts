import { DEFAULT_TOKENS } from '$lib/constants/tokenConstants';
import { writable } from 'svelte/store';

interface UserTokensState {
  enabledTokens: { [canisterId: string]: FE.Token };
  tokens: FE.Token[];
}

const STORAGE_KEY = 'kong_user_tokens';

function createUserTokensStore() {
  // Initialize from localStorage if available
  const initialState: UserTokensState = typeof window !== 'undefined' 
    ? JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"enabledTokens": {}, "tokens": []}')
    : { enabledTokens: {}, tokens: [] };

  const state = writable<UserTokensState>(initialState);
  const { subscribe, set, update } = state;

  // Helper function to update localStorage
  const updateStorage = (newState: UserTokensState) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    }
  };

  return {
    subscribe,
    enableToken: (token: FE.Token) => {
      update(state => {
        const newState = {
          enabledTokens: {
            ...state.enabledTokens,
            [token.canister_id]: token
          },
          tokens: Object.values({
            ...state.enabledTokens,
            [token.canister_id]: token
          })
        };
        updateStorage(newState);
        return newState;
      });
    },
    enableTokens: (tokens: FE.Token[]) => {
      update(state => {
        const newEnabledTokens = { ...state.enabledTokens };
        tokens.forEach(token => {
          newEnabledTokens[token.canister_id] = token;
        });
        const newState = {
          enabledTokens: newEnabledTokens,
          tokens: Object.values(newEnabledTokens)
        };
        updateStorage(newState);
        return newState;
      });
    },
    disableToken: (canisterId: string) => {
      update(state => {
        const newEnabledTokens = { ...state.enabledTokens };
        delete newEnabledTokens[canisterId];
        const newState = {
          enabledTokens: newEnabledTokens,
          tokens: Object.values(newEnabledTokens)
        };
        updateStorage(newState);
        return newState;
      });
    },
    isTokenEnabled: (canisterId: string) => {
      if (typeof window === 'undefined') return true; // Default to enabled if not in browser
      const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"enabledTokens": {}, "tokens": []}');
      // If the token has never been seen before, consider it enabled
      return !!state.enabledTokens[canisterId];
    },
    isDefaultToken: (canisterId: string) => {
      return Object.values(DEFAULT_TOKENS).includes(canisterId);
    }
  };
}

export const userTokens = createUserTokensStore();

userTokens.subscribe(state => {
  state.tokens = Object.values(state.enabledTokens);
});