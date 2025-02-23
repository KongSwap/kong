import { writable, type Writable } from 'svelte/store';

export interface TokenInfo {
  name: string;
  ticker: string;
}

function createTokenInfoStore() {
  const { subscribe, set }: Writable<TokenInfo> = writable<TokenInfo>({
    name: 'Loading...',
    ticker: 'KONG'
  });

  return {
    subscribe,
    setInfo: (name: string, ticker: string) => {
      set({ name, ticker });
    }
  };
}

export const tokenInfo = createTokenInfoStore(); 
