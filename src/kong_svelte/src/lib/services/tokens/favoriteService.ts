import { get } from "svelte/store";
import { auth } from "$lib/services/auth";

// Add import for storage constants
import { STORAGE_KEYS, createNamespacedStore } from '$lib/config/localForage.config';

export class FavoriteService {
  /**
   * In-memory cache for the currently-authenticated wallet's favorites.
   * Also store the wallet ID we used to build this cache.
   */
  private static favoritesCache = new Set<string>();
  private static lastWalletId = "anonymous";

  /**
   * LocalForage namespace for favorite tokens
   */
  private static FAVORITE_TOKENS_KEY = STORAGE_KEYS.FAVORITE_TOKENS;
  
  /**
   * Dedicated store instance for favorites
   */
  private static store = createNamespacedStore(STORAGE_KEYS.FAVORITE_TOKENS);

  /**
   * Get the current wallet ID
   */
  private static getCurrentWalletId(): string {
    const wallet = get(auth);
    return wallet?.account?.owner?.toString() || "anonymous";
  }

  /**
   * Internally ensure that if the wallet changes, we reset the cache
   */
  private static maybeResetCache() {
    const currentWalletId = this.getCurrentWalletId();
    if (currentWalletId !== this.lastWalletId) {
      this.favoritesCache.clear();
      this.lastWalletId = currentWalletId;
    }
  }

  /**
   * Key for storing favorites for a specific wallet
   */
  private static getStorageKey(walletId: string): string {
    return `${this.FAVORITE_TOKENS_KEY}_${walletId}`;
  }

  /**
   * Load favorites for the current wallet, using the in-memory cache
   * if we already loaded them for the same wallet.
   */
  static async loadFavorites(): Promise<string[]> {
    this.maybeResetCache(); // Clear if the wallet changed
    const currentWalletId = this.lastWalletId; // after maybeReset

    // If anonymous, just return empty
    if (currentWalletId === "anonymous") {
      return [];
    }

    // If cache has data, return it directly
    if (this.favoritesCache.size > 0) {
      return Array.from(this.favoritesCache);
    }

    // Otherwise, fetch from localForage
    try {
      const key = this.getStorageKey(currentWalletId);
      const favorites = await this.store.getItem<{canister_id: string, timestamp: number}[]>(key) || [];

      const ids = favorites.map((fav) => fav.canister_id);
      // Populate our in-memory cache
      this.favoritesCache = new Set(ids);

      return ids;
    } catch (error) {
      console.error("Error loading favorites:", error);
      return [];
    }
  }

  /**
   * Add a token to favorites (also update the in-memory cache).
   */
  static async addFavorite(canisterId: string): Promise<boolean> {
    this.maybeResetCache();
    const currentWalletId = this.lastWalletId;

    if (currentWalletId === "anonymous") {
      return false;
    }

    try {
      const key = this.getStorageKey(currentWalletId);
      const favorites = await this.store.getItem<{canister_id: string, timestamp: number}[]>(key) || [];
      
      // Check if already exists
      const existing = favorites.find(fav => fav.canister_id === canisterId);
      if (existing) {
        return true; // Already favorited
      }
      
      // Add new favorite
      favorites.push({
        canister_id: canisterId,
        timestamp: Date.now(),
      });
      
      // Save back to localForage
      await this.store.setItem(key, favorites);

      // Update cache
      this.favoritesCache.add(canisterId);
      return true;
    } catch (error) {
      console.error("Error adding favorite:", error);
      return false;
    }
  }

  /**
   * Remove a token from favorites (also update the in-memory cache).
   */
  static async removeFavorite(canisterId: string): Promise<boolean> {
    this.maybeResetCache();
    const currentWalletId = this.lastWalletId;

    if (currentWalletId === "anonymous") {
      return false;
    }

    try {
      const key = this.getStorageKey(currentWalletId);
      const favorites = await this.store.getItem<{canister_id: string, timestamp: number}[]>(key) || [];
      
      // Find if exists
      const index = favorites.findIndex(fav => fav.canister_id === canisterId);
      if (index === -1) {
        return false; // Not found
      }
      
      // Remove from array
      favorites.splice(index, 1);
      
      // Save back to localForage
      await this.store.setItem(key, favorites);
      
      // Update cache
      this.favoritesCache.delete(canisterId);
      return true;
    } catch (error) {
      console.error("Error removing favorite:", error);
      return false;
    }
  }

  /**
   * Toggle favorite status for a token (also update the in-memory cache).
   */
  static async toggleFavorite(canisterId: string): Promise<boolean> {
    this.maybeResetCache();
    const currentWalletId = this.lastWalletId;

    if (currentWalletId === "anonymous") {
      return false;
    }

    try {
      const key = this.getStorageKey(currentWalletId);
      const favorites = await this.store.getItem<{canister_id: string, timestamp: number}[]>(key) || [];
      
      // Check if already exists
      const index = favorites.findIndex(fav => fav.canister_id === canisterId);
      
      if (index !== -1) {
        // Remove from array and cache
        favorites.splice(index, 1);
        this.favoritesCache.delete(canisterId);
        await this.store.setItem(key, favorites);
        return false;
      } else {
        // Add to array and cache
        favorites.push({
          canister_id: canisterId,
          timestamp: Date.now(),
        });
        this.favoritesCache.add(canisterId);
        await this.store.setItem(key, favorites);
        return true;
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      return false;
    }
  }

  /**
   * Check if a token is favorited by looking up the in-memory cache
   * (or hitting the storage if needed).
   */
  static async isFavorite(canisterId: string): Promise<boolean> {
    this.maybeResetCache();
    const currentWalletId = this.lastWalletId;

    if (currentWalletId === "anonymous") {
      return false;
    }

    // If we have items in our cache, just check that
    if (this.favoritesCache.size > 0) {
      return this.favoritesCache.has(canisterId);
    }

    // Otherwise, we need to load from storage
    const favorites = await this.loadFavorites();
    return favorites.includes(canisterId);
  }

  /**
   * Get count of favorite tokens (check from in-memory cache if present).
   */
  static async getFavoriteCount(): Promise<number> {
    this.maybeResetCache();
    const currentWalletId = this.lastWalletId;

    if (currentWalletId === "anonymous") {
      return 0;
    }

    // If cache is populated, just return the size
    if (this.favoritesCache.size > 0) {
      return this.favoritesCache.size;
    }

    // Otherwise, load from storage and return
    try {
      // loadFavorites() will fill the cache, so we can just reuse it
      const favorites = await this.loadFavorites();
      return favorites.length;
    } catch (error) {
      console.error("Error getting favorite count:", error);
      return 0;
    }
  }
} 