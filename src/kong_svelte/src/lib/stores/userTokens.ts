import { writable } from 'svelte/store';
import { browser } from '$app/environment';

interface UserTokensState {
  enabledTokens: { [canisterId: string]: FE.Token };
}

const STORAGE_KEY = 'kong_user_tokens';

function createUserTokensStore() {
  // Initialize from localStorage if available
  const initialState: UserTokensState = typeof window !== 'undefined' 
    ? JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"enabledTokens": {}}')
    : { enabledTokens: {} };

  const { subscribe, set, update } = writable<UserTokensState>(initialState);

  return {
    subscribe,
    enableToken: (token: FE.Token) => {
      update(state => {
        const newState = {
          ...state,
          enabledTokens: {
            ...state.enabledTokens,
            [token.canister_id]: token
          }
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        }
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
          ...state,
          enabledTokens: newEnabledTokens
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        }
        return newState;
      });
    },
    disableToken: (canisterId: string) => {
      update(state => {
        const newEnabledTokens = { ...state.enabledTokens };
        delete newEnabledTokens[canisterId];
        const newState = {
          ...state,
          enabledTokens: newEnabledTokens
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        }
        return newState;
      });
    },
    isTokenEnabled: (canisterId: string) => {
      if (typeof window !== 'undefined') return true; // Default to enabled if not in browser
      const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"enabledTokens": {}}');
      // If the token has never been seen before, consider it enabled
      return !!state.enabledTokens[canisterId];
    }
  };
}

export const userTokens = createUserTokensStore(); 
