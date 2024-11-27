import { writable } from 'svelte/store';

export interface FormattedToken {
  canister_id: string;
  name: string;
  symbol: string;
  decimals: number;
  formattedBalance: string;
  price?: number;
  isFavorite?: boolean;
}

function createFormattedTokensStore() {
  const { subscribe, set, update } = writable<FormattedToken[]>([]);

  return {
    subscribe,
    set,
    update,
    addToken: (token: FormattedToken) =>
      update(tokens => {
        const index = tokens.findIndex(t => t.canister_id === token.canister_id);
        if (index >= 0) {
          tokens[index] = token;
          return [...tokens];
        }
        return [...tokens, token];
      }),
    removeToken: (canisterId: string) =>
      update(tokens => tokens.filter(t => t.canister_id !== canisterId)),
    reset: () => set([])
  };
}

export const formattedTokens = createFormattedTokensStore();
