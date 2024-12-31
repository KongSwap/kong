import { writable } from 'svelte/store';

function createAddLiquidityStore() {
  const { subscribe, set, update } = writable({
    initialPrice: '',
    error: null as string | null,
  });

  return {
    subscribe,
    setInitialPrice: (price: string) => update(state => ({ ...state, initialPrice: price })),
    setError: (error: string | null) => update(state => ({ ...state, error })),
    reset: () => set({ initialPrice: '', error: null }),
  };
}

export const addLiquidityStore = createAddLiquidityStore();