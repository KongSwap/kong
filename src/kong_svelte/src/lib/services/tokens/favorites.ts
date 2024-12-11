import { tokenStore } from '$lib/stores/tokenStore';
import { get } from 'svelte/store';
import { auth } from '$lib/services/auth';

export function toggleFavoriteToken(canisterId: string) {
  const owner = get(auth).account?.owner?.toString();
  if (!owner) return;

  const currentFavorites = get(tokenStore).favoriteTokens[owner] || [];
  const isFavorite = currentFavorites.includes(canisterId);

  const updatedFavorites = isFavorite
    ? currentFavorites.filter(id => id !== canisterId)
    : [...currentFavorites, canisterId];

  tokenStore.setFavoriteTokens(owner, updatedFavorites);
}
