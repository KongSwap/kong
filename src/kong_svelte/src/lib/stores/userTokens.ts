import { browser } from '$app/environment';
import { fetchTokensByCanisterId } from '$lib/api/tokens';
import { DEFAULT_TOKENS } from '$lib/constants/tokenConstants';
import { writable, get } from 'svelte/store';

interface UserTokensState {
  enabledTokens: { [canisterId: string]: boolean };
  tokens: FE.Token[];
}

const STORAGE_KEY = 'kong_user_tokens';

function createUserTokensStore() {
  // Initialize from localStorage if available
  const initialState: UserTokensState = browser
    ? JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"enabledTokens": {}, "tokens": []}')
    : { enabledTokens: {}, tokens: [] };

  const state = writable<UserTokensState>(initialState);
  const { subscribe, set, update } = state;

  // Helper function to update localStorage
  const updateStorage = (newState: UserTokensState) => {
    if (browser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    }
  };

  const refreshTokenData = async () => {
    const currentState = get(state);
    const canisterIds = Object.keys(currentState.enabledTokens);
    const tokens = await fetchTokensByCanisterId(canisterIds);
    update(state => {
      const newState = {
        ...state,
        tokens
      };
      updateStorage(newState);
      return newState;
    });
  };

  return {
    subscribe,
    enableToken: (token: FE.Token) => {
      update(state => {
        // First check if token already exists in the tokens array
        const tokenExists = state.tokens.some(t => t.canister_id === token.canister_id);
        
        // Create new tokens array with the token added if it doesn't exist
        const newTokens = tokenExists 
          ? state.tokens 
          : [...state.tokens, token];
        
        const newState = {
          enabledTokens: {
            ...state.enabledTokens,
            [token.canister_id]: true
          },
          tokens: newTokens
        };
        updateStorage(newState);
        return newState;
      });
    },
    enableTokens: (tokens: FE.Token[]) => {
      update(state => {
        const newEnabledTokens = { ...state.enabledTokens };
        const existingTokenIds = new Set(state.tokens.map(t => t.canister_id));
        let newTokens = [...state.tokens];
        
        tokens.forEach(token => {
          // Mark as enabled
          newEnabledTokens[token.canister_id] = true;
          
          // Add to tokens array if not already there
          if (!existingTokenIds.has(token.canister_id)) {
            newTokens.push(token);
          }
        });
        
        const newState = {
          enabledTokens: newEnabledTokens,
          tokens: newTokens
        };
        updateStorage(newState);
        return newState;
      });
    },
    disableToken: (canisterId: string) => {
      update(state => {
        const newEnabledTokens = { ...state.enabledTokens };
        delete newEnabledTokens[canisterId];
        
        // Also remove from the tokens array
        const newTokens = state.tokens.filter(token => token.canister_id !== canisterId);
        
        const newState = {
          enabledTokens: newEnabledTokens,
          tokens: newTokens
        };
        updateStorage(newState);
        return newState;
      });
    },
    isTokenEnabled: (canisterId: string) => {
      if (!browser) return true; // Default to enabled if not in browser
      const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"enabledTokens": {}, "tokens": []}');
      return !!state.enabledTokens[canisterId];
    },
    refreshTokenData,
    isDefaultToken: (canisterId: string) => {
      return Object.values(DEFAULT_TOKENS).includes(canisterId);
    }
  };
}

export const userTokens = createUserTokensStore();