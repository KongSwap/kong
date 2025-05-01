import { writable, get, derived } from "svelte/store";
import { auth } from "$lib/stores/auth";
import { STORAGE_KEYS, createNamespacedStore } from '$lib/config/localForage.config';

// Internal store for favorites state
interface FavoriteState {
  favorites: Set<string>;
  walletId: string;
  ready: boolean;
}

function createFavoriteStore() {
  // Create the storage namespace for favorite tokens
  const FAVORITE_TOKENS_KEY = STORAGE_KEYS.FAVORITE_TOKENS;
  const storage = createNamespacedStore(STORAGE_KEYS.FAVORITE_TOKENS);
  
  // Create a writable store with initial state
  const initialState: FavoriteState = {
    favorites: new Set<string>(),
    walletId: "anonymous",
    ready: false
  };
  
  const store = writable<FavoriteState>(initialState);
  
  /**
   * Get the current wallet ID
   */
  const getCurrentWalletId = (): string => {
    const wallet = get(auth);
    return wallet?.account?.owner || "anonymous";
  };
  
  /**
   * Key for storing favorites for a specific wallet
   */
  const getStorageKey = (walletId: string): string => {
    return `${FAVORITE_TOKENS_KEY}_${walletId}`;
  };
  
  /**
   * Load favorites from storage into the store
   */
  const loadFavorites = async (): Promise<string[]> => {
    const currentWalletId = getCurrentWalletId();
    
    // Check if we're already using the correct wallet
    const { walletId: storedWalletId, favorites, ready } = get(store);
    
    if (currentWalletId === storedWalletId && ready && favorites.size > 0) {
      return Array.from(favorites);
    }
    
    // If anonymous, just return empty and update store
    if (currentWalletId === "anonymous") {
      store.update(state => ({
        ...state,
        walletId: currentWalletId,
        favorites: new Set<string>(),
        ready: true
      }));
      return [];
    }
    
    try {
      const key = getStorageKey(currentWalletId);
      const storedFavorites = await storage.getItem<{address: string, timestamp: number}[]>(key) || [];
      const ids = storedFavorites.map(fav => fav.address);
      
      // Update the store with loaded data
      store.update(state => ({
        ...state,
        favorites: new Set(ids),
        walletId: currentWalletId,
        ready: true
      }));
      
      return ids;
    } catch (error) {
      console.error("Error loading favorites:", error);
      store.update(state => ({
        ...state,
        walletId: currentWalletId,
        ready: true
      }));
      return [];
    }
  };
  
  /**
   * Add a token to favorites
   */
  const addFavorite = async (canisterId: string): Promise<boolean> => {
    const currentWalletId = getCurrentWalletId();
    
    if (currentWalletId === "anonymous") {
      return false;
    }
    
    try {
      const key = getStorageKey(currentWalletId);
      const storedFavorites = await storage.getItem<{address: string, timestamp: number}[]>(key) || [];
      
      // Check if already exists
      const existing = storedFavorites.find(fav => fav.address === canisterId);
      if (existing) {
        return true; // Already favorited
      }
      
      // Add new favorite
      storedFavorites.push({
        address: canisterId,
        timestamp: Date.now(),
      });
      
      // Save back to storage
      await storage.setItem(key, storedFavorites);
      
      // Update the store
      store.update(state => {
        const newFavorites = new Set(state.favorites);
        newFavorites.add(canisterId);
        return {
          ...state,
          favorites: newFavorites,
          walletId: currentWalletId
        };
      });
      
      return true;
    } catch (error) {
      console.error("Error adding favorite:", error);
      return false;
    }
  };
  
  /**
   * Remove a token from favorites
   */
  const removeFavorite = async (canisterId: string): Promise<boolean> => {
    const currentWalletId = getCurrentWalletId();
    
    if (currentWalletId === "anonymous") {
      return false;
    }
    
    try {
      const key = getStorageKey(currentWalletId);
      const storedFavorites = await storage.getItem<{address: string, timestamp: number}[]>(key) || [];
      
      // Find if exists
      const index = storedFavorites.findIndex(fav => fav.address === canisterId);
      if (index === -1) {
        return false; // Not found
      }
      
      // Remove from array
      storedFavorites.splice(index, 1);
      
      // Save back to storage
      await storage.setItem(key, storedFavorites);
      
      // Update the store
      store.update(state => {
        const newFavorites = new Set(state.favorites);
        newFavorites.delete(canisterId);
        return {
          ...state,
          favorites: newFavorites
        };
      });
      
      return true;
    } catch (error) {
      console.error("Error removing favorite:", error);
      return false;
    }
  };
  
  /**
   * Toggle favorite status for a token
   */
  const toggleFavorite = async (canisterId: string): Promise<boolean> => {
    const { favorites } = get(store);
    if (favorites.has(canisterId)) {
      const success = await removeFavorite(canisterId);
      return !success;
    } else {
      return addFavorite(canisterId);
    }
  };
  
  /**
   * Check if a token is favorited
   */
  const isFavorite = async (canisterId: string): Promise<boolean> => {
    const { ready, favorites, walletId } = get(store);
    const currentWalletId = getCurrentWalletId();
    
    if (currentWalletId === "anonymous") {
      return false;
    }
    
    // If we have loaded favorites for the current wallet, use those
    if (ready && walletId === currentWalletId) {
      return favorites.has(canisterId);
    }
    
    // Otherwise, load favorites first
    await loadFavorites();
    return get(store).favorites.has(canisterId);
  };
  
  // Create a derived store for the count
  const favoriteCount = derived(store, ($store) => $store.favorites.size);
  
  // Automatically load favorites when auth changes
  auth.subscribe(() => {
    const currentWalletId = getCurrentWalletId();
    const { walletId } = get(store);
    
    if (currentWalletId !== walletId) {
      loadFavorites();
    }
  });
  
  return {
    subscribe: store.subscribe,
    loadFavorites,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
    favoriteCount,
    // Convenient accessors to get the current state without async
    getFavorites: () => Array.from(get(store).favorites),
    hasFavorite: (canisterId: string) => get(store).favorites.has(canisterId),
    getCount: () => get(store).favorites.size,
    isReady: () => get(store).ready
  };
}

export const favoriteStore = createFavoriteStore(); 