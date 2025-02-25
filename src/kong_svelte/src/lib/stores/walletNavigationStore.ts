import { writable } from 'svelte/store';
import { goto } from '$app/navigation';
import type { ComponentType } from 'svelte';

export interface WalletTab {
  id: string;
  label: string;
  icon: ComponentType;
  path: string;
}

function createWalletNavigationStore() {
  const { subscribe, set } = writable<string>("overview");

  return {
    subscribe,
    navigateTo: (tabId: string, principal: string) => {
      const tab = tabs.find(t => t.id === tabId);
      if (tab) {
        set(tabId);
        goto(`/wallets/${principal}/${tab.path}`);
      }
    },
    setTab: (tabId: string) => set(tabId)
  };
}

export const activeTabStore = createWalletNavigationStore(); 