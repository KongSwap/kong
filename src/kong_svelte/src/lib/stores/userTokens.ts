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
    update(state => ({
      ...state,
      tokens
    }));
  };

  return {
    subscribe,
    enableToken: (token: FE.Token) => {
      update(state => {
        const newState = {
          enabledTokens: {
            ...state.enabledTokens,
            [token.canister_id]: true
          },
          tokens: state.tokens
        };
        updateStorage(newState);
        return newState;
      });
    },
    enableTokens: (tokens: FE.Token[]) => {
      update(state => {
        const newEnabledTokens = { ...state.enabledTokens };
        tokens.forEach(token => {
          newEnabledTokens[token.canister_id] = true;
        });
        const newState = {
          enabledTokens: newEnabledTokens,
          tokens: state.tokens
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
          tokens: state.tokens
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