import { get } from "svelte/store";
import { auth } from "$lib/stores/auth";
import { favoriteStore } from "$lib/stores/favoriteStore";

/**
 * Synchronizes the favorite store with auth changes.
 * This module exists to avoid circular dependencies between auth and favoriteStore.
 */
export function initializeAuthFavoriteSync() {
  // Subscribe to auth changes and update favoriteStore
  auth.subscribe((authState) => {
    const walletId = authState?.account?.owner || null;
    favoriteStore.setWalletId(walletId);
  });
  
  // Initialize with current auth state
  const currentAuth = get(auth);
  const walletId = currentAuth?.account?.owner || null;
  favoriteStore.setWalletId(walletId);
}