import { writable } from 'svelte/store';

interface SearchStore {
  isOpen: boolean;
}

function createSearchStore() {
  const { subscribe, set, update } = writable<SearchStore>({
    isOpen: false
  });

  return {
    subscribe,
    open: () => update(state => ({ ...state, isOpen: true })),
    close: () => update(state => ({ ...state, isOpen: false })),
    toggle: () => update(state => ({ ...state, isOpen: !state.isOpen }))
  };
}

export const searchStore = createSearchStore(); 