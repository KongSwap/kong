import { writable, derived, get } from "svelte/store";
import { kongDB } from "$lib/services/db";
import { auth } from "$lib/services/auth";
import { toastStore } from "$lib/stores/toastStore";
import { eventBus } from './eventBus';

interface FavoriteState {
  favorites: Record<string, string[]>;  // wallet_id -> canister_ids[]
  isLoading: boolean;
}

function createFavoriteStore() {
  const store = writable<FavoriteState>({
    favorites: {},
    isLoading: false
  });

  const getCurrentWalletId = (): string => {
    const wallet = get(auth);
    return wallet?.account?.owner?.toString() || "anonymous";
  };

  const loadFavorites = async () => {
    const walletId = getCurrentWalletId();
    store.update(s => ({ ...s, isLoading: true }));
    
    try {
      const favorites = await kongDB.favorite_tokens
        .where("wallet_id")
        .equals(walletId)
        .toArray();
      
      store.update(s => ({
        ...s,
        favorites: {
          ...s.favorites,
          [walletId]: favorites.map(f => f.canister_id)
        },
        isLoading: false
      }));
    } catch (error) {
      console.error("Error loading favorites:", error);
      store.update(s => ({ ...s, isLoading: false }));
    }
  };

  const toggleFavorite = async (canister_id: string) => {
    const walletId = getCurrentWalletId();
    const state = get(store);
    const currentFavorites = state.favorites[walletId] || [];
    const isFavorite = currentFavorites.includes(canister_id);

    eventBus.emit("favorite-token-update", {
      canister_id,
      currentFavorites,
      isFavorite,
    });

    try {
      if (isFavorite) {
        await kongDB.favorite_tokens
          .where(["canister_id", "wallet_id"])
          .equals([canister_id, walletId])
          .delete();
        
        store.update(s => ({
          ...s,
          favorites: {
            ...s.favorites,
            [walletId]: currentFavorites.filter(id => id !== canister_id)
          }
        }));
      } else {
        // First check if the record already exists
        const existing = await kongDB.favorite_tokens
          .where(["canister_id", "wallet_id"])
          .equals([canister_id, walletId])
          .first();
        
        if (!existing) {
          await kongDB.favorite_tokens.add({
            canister_id,
            wallet_id: walletId,
            timestamp: Date.now()
          });
        }

        store.update(s => ({
          ...s,
          favorites: {
            ...s.favorites,
            [walletId]: [...currentFavorites, canister_id]
          }
        }));
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toastStore.error("Failed to update favorite token");
    }
  };

  // Subscribe to the auth store to reload favorites on wallet change
  auth.subscribe(($auth) => {
    loadFavorites();
  });

  return {
    subscribe: store.subscribe,
    loadFavorites,
    toggleFavorite
  };
}

export const favoriteStore = createFavoriteStore();

// Derived store for current wallet's favorites
export const currentWalletFavorites = derived(
  [favoriteStore, auth],
  ([$store, $auth]) => {
    const walletId = $auth?.account?.owner?.toString() || "anonymous";
    return $store.favorites[walletId] || [];
  }
);
