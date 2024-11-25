import { writable } from 'svelte/store';

interface SidebarState {
  isExpanded: boolean;
  filterText: string;
  sortBy: 'value' | 'balance' | 'name' | 'price';
  sortDirection: 'asc' | 'desc';
}

const initialState: SidebarState = {
  isExpanded: false,
  filterText: '',
  sortBy: 'value',
  sortDirection: 'desc'
};

function createSidebarStore() {
  const { subscribe, set, update } = writable<SidebarState>(initialState);

  return {
    subscribe,
    toggle: () => update(state => ({ ...state, isExpanded: !state.isExpanded })),
    toggleExpand: () => update(state => ({ ...state, isExpanded: true })),
    collapse: () => update(state => ({ ...state, isExpanded: false })),
    setFilterText: (text: string) => update(state => ({ ...state, filterText: text })),
    setSortBy: (sortBy: SidebarState['sortBy']) => update(state => ({ ...state, sortBy })),
    setSortDirection: (sortDirection: SidebarState['sortDirection']) => update(state => ({ ...state, sortDirection })),
    reset: () => set(initialState)
  };
}

export const sidebarStore = createSidebarStore();
