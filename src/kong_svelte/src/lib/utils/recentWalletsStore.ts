import { writable } from "svelte/store";
import { browser } from "$app/environment";

export interface RecentWallet {
  id: string;
  timestamp: number;
}

const RECENT_WALLETS_KEY = "auth:recentWallets";
const MAX_RECENT_WALLETS = 5;

function createRecentWalletsStore() {
  const { subscribe, set, update } = writable<RecentWallet[]>([]);
  let isInitialized = false;

  async function saveToStorage(wallets: RecentWallet[]) {
    if (!browser) return;
    try {
      // Create a plain JS copy to remove Svelte proxies before saving
      const plainWallets = JSON.parse(JSON.stringify(wallets));
      localStorage.setItem(RECENT_WALLETS_KEY, JSON.stringify(plainWallets));
    } catch (err) {
      console.error("Could not save recent wallets to localStorage:", err);
    }
  }

  async function loadFromStorage() {
    if (!browser) return;
    try {
      const storedData = localStorage.getItem(RECENT_WALLETS_KEY);
      const stored = storedData ? JSON.parse(storedData) as RecentWallet[] : null;
      if (stored && Array.isArray(stored)) {
        set(stored);
      } else {
        set([]); // Ensure it's an empty array if nothing is stored
      }
    } catch (err) {
      console.warn("Could not load recent wallets from localStorage:", err);
      set([]); // Set to empty on error
    }
  }

  return {
    subscribe,
    async initialize() {
      if (isInitialized || !browser) return;
      isInitialized = true;
      await loadFromStorage();
    },

    async add(walletId: string) {
      const now = Date.now();
      update((currentWallets) => {
        const updatedWallets = [
          { id: walletId, timestamp: now },
          ...currentWallets.filter((w) => w.id !== walletId),
        ].slice(0, MAX_RECENT_WALLETS);

        saveToStorage(updatedWallets); // Save in the background
        return updatedWallets;
      });
    },

    async remove(walletId: string) {
      update((currentWallets) => {
        const updatedWallets = currentWallets.filter((w) => w.id !== walletId);
        saveToStorage(updatedWallets); // Save in the background
        return updatedWallets;
      });
    },

    async clearAll() {
      set([]);
      if (!browser) return;
      try {
        localStorage.removeItem(RECENT_WALLETS_KEY);
      } catch (err) {
        console.warn("Could not clear recent wallets from localStorage:", err);
      }
    },
  };
}

export const recentWalletsStore = createRecentWalletsStore(); 