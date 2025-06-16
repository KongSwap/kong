import { writable } from 'svelte/store';

interface WalletSidebarState {
  isOpen: boolean;
  activeTab: 'notifications' | 'chat' | 'wallet';
}

function createWalletSidebarStore() {
  const { subscribe, set, update } = writable<WalletSidebarState>({
    isOpen: false,
    activeTab: 'wallet'
  });

  return {
    subscribe,
    open: (tab: 'notifications' | 'chat' | 'wallet' = 'wallet') => {
      update(state => ({ ...state, isOpen: true, activeTab: tab }));
    },
    close: () => {
      update(state => ({ ...state, isOpen: false }));
    },
    toggle: () => {
      update(state => ({ ...state, isOpen: !state.isOpen }));
    },
    setActiveTab: (tab: 'notifications' | 'chat' | 'wallet') => {
      update(state => ({ ...state, activeTab: tab }));
    }
  };
}

export const walletSidebarStore = createWalletSidebarStore();