import { kongDB } from "$lib/services/db";
import { get } from "svelte/store";
import { auth } from "$lib/services/auth";

export class FavoriteService {
  /**
   * In-memory cache for the currently-authenticated wallet’s favorites.
   * Also store the wallet ID we used to build this cache.
   */
  private static favoritesCache = new Set<string>();
  private static lastWalletId = "anonymous";

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

    // Otherwise, fetch from IndexedDB
    try {
      const favorites = await kongDB.favorite_tokens
        .where("wallet_id")
        .equals(currentWalletId)
        .toArray();

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
      // Check if already exists in DB
      const existing = await kongDB.favorite_tokens
        .where(["wallet_id", "canister_id"])
        .equals([currentWalletId, canisterId])
        .first();

      if (existing) {
        return true; // Already favorited
      }

      await kongDB.favorite_tokens.add({
        wallet_id: currentWalletId,
        canister_id: canisterId,
        timestamp: Date.now(),
      });

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
      // Use compound index for lookup
      const existing = await kongDB.favorite_tokens
        .where(["wallet_id", "canister_id"])
        .equals([currentWalletId, canisterId])
        .first();

      if (existing?.id) {
        await kongDB.favorite_tokens.delete(existing.id);
        // Update cache
        this.favoritesCache.delete(canisterId);
        return true;
      }
      return false;
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
      // Use compound index for lookup
      const existing = await kongDB.favorite_tokens
        .where(["wallet_id", "canister_id"])
        .equals([currentWalletId, canisterId])
        .first();

      if (existing?.id) {
        // Remove from DB + cache
        await this.removeFavorite(canisterId);
        return false;
      } else {
        // Add to DB + cache
        await this.addFavorite(canisterId);
        return true;
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      return false;
    }
  }

  /**
   * Check if a token is favorited by looking up the in-memory cache
   * (or hitting the DB if needed).
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

    // Otherwise, we need to load from DB
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

    // Otherwise, load from DB and return
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