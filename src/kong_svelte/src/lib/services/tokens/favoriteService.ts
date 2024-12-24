import { kongDB } from "$lib/services/db";
import { get } from "svelte/store";
import { auth } from "$lib/services/auth";

export class FavoriteService {
  /**
   * Get the current wallet ID
   */
  private static getCurrentWalletId(): string {
    const wallet = get(auth);
    return wallet?.account?.owner?.toString() || "anonymous";
  }

  /**
   * Load favorites for the current wallet
   */
  static async loadFavorites(): Promise<string[]> {
    const currentWalletId = this.getCurrentWalletId();
    if (currentWalletId === "anonymous") {
      return [];
    }

    try {
      const favorites = await kongDB.favorite_tokens
        .where('wallet_id')
        .equals(currentWalletId)
        .toArray();
      
      return favorites.map(fav => fav.canister_id);
    } catch (error) {
      console.error("Error loading favorites:", error);
      return [];
    }
  }

  /**
   * Add a token to favorites
   */
  static async addFavorite(canisterId: string): Promise<boolean> {
    const currentWalletId = this.getCurrentWalletId();
    if (currentWalletId === "anonymous") {
      return false;
    }

    try {
      // Check if already exists
      const existing = await kongDB.favorite_tokens
        .where(['wallet_id', 'canister_id'])
        .equals([currentWalletId, canisterId])
        .first();

      if (existing) {
        return true; // Already favorited
      }

      await kongDB.favorite_tokens.add({
        wallet_id: currentWalletId,
        canister_id: canisterId,
        timestamp: Date.now()
      });
      
      return true;
    } catch (error) {
      console.error("Error adding favorite:", error);
      return false;
    }
  }

  /**
   * Remove a token from favorites
   */
  static async removeFavorite(canisterId: string): Promise<boolean> {
    const currentWalletId = this.getCurrentWalletId();
    if (currentWalletId === "anonymous") {
      return false;
    }

    try {
      // Use compound index for lookup
      const existing = await kongDB.favorite_tokens
        .where(['wallet_id', 'canister_id'])
        .equals([currentWalletId, canisterId])
        .first();

      if (existing?.id) {
        await kongDB.favorite_tokens.delete(existing.id);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error removing favorite:", error);
      return false;
    }
  }

  /**
   * Toggle favorite status for a token
   */
  static async toggleFavorite(canisterId: string): Promise<boolean> {
    const currentWalletId = this.getCurrentWalletId();
    if (currentWalletId === "anonymous") {
      return false;
    }

    try {
      // Use compound index for lookup
      const existing = await kongDB.favorite_tokens
        .where(['wallet_id', 'canister_id'])
        .equals([currentWalletId, canisterId])
        .first();

      if (existing?.id) {
        return await this.removeFavorite(canisterId);
      } else {
        return await this.addFavorite(canisterId);
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      return false;
    }
  }

  /**
   * Check if a token is favorited
   */
  static async isFavorite(canisterId: string): Promise<boolean> {
    const currentWalletId = this.getCurrentWalletId();
    if (currentWalletId === "anonymous") {
      return false;
    }

    try {
      // Use compound index for lookup
      const existing = await kongDB.favorite_tokens
        .where(['wallet_id', 'canister_id'])
        .equals([currentWalletId, canisterId])
        .first();

      return !!existing;
    } catch (error) {
      console.error("Error checking favorite status:", error);
      return false;
    }
  }

  /**
   * Get count of favorite tokens
   */
  static async getFavoriteCount(): Promise<number> {
    const currentWalletId = this.getCurrentWalletId();
    if (currentWalletId === "anonymous") {
      return 0;
    }

    try {
      return await kongDB.favorite_tokens
        .where('wallet_id')
        .equals(currentWalletId)
        .count();
    } catch (error) {
      console.error("Error getting favorite count:", error);
      return 0;
    }
  }
} 