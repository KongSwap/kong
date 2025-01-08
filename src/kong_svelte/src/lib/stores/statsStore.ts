import { writable, derived } from "svelte/store";
import type { Writable } from "svelte/store";
import { KONG_CANISTER_ID } from "$lib/constants/canisterConstants";
import { liveTokens } from "$lib/services/tokens/tokenStore";
import type { FE } from "$lib/types";

// UI State
export const searchTerm: Writable<string> = writable("");
export const showFavoritesOnly: Writable<boolean> = writable(false);
export const activeStatsSection: Writable<"tokens" | "marketStats"> = writable("tokens");
export const sortColumnStore: Writable<string> = writable("marketCap");
export const sortDirectionStore: Writable<"asc" | "desc"> = writable("desc");
export const isUpdating: Writable<boolean> = writable(false);
export const updateError: Writable<string | null> = writable(null);
export const scrollY: Writable<number> = writable(0);

// Favorites State
export const favoriteCount: Writable<number> = writable(0);
export const favoriteTokenIds: Writable<string[]> = writable([]);

// Filtered and Sorted Tokens
export const filteredTokens = derived(
  [liveTokens, searchTerm, sortColumnStore, sortDirectionStore, showFavoritesOnly, favoriteTokenIds],
  ([$liveTokens, $search, $sortColumn, $sortDirection, $showFavoritesOnly, $favoriteTokenIds]) => {
    const s = $search.trim().toLowerCase();
    let filtered = [...$liveTokens];

    // First sort by volume to determine volume ranks
    const volumeRankedTokens = filtered
      .sort((a, b) => {
        const aVolume = Number(a.metrics?.volume_24h || 0);
        const bVolume = Number(b.metrics?.volume_24h || 0);
        return bVolume - aVolume;
      })
      .map((token, index) => ({
        ...token,
        volumeRank: index + 1,
      }));

    // Filter by favorites if enabled
    if ($showFavoritesOnly) {
      filtered = volumeRankedTokens.filter((token) =>
        $favoriteTokenIds.includes(token.canister_id)
      );
    } else {
      filtered = volumeRankedTokens;
    }

    // Filter by search term
    if (s) {
      filtered = filtered.filter((token) => {
        const symbol = token.symbol?.toLowerCase() || "";
        const name = token.name?.toLowerCase() || "";
        const canisterID = token.canister_id.toLowerCase();
        return symbol.includes(s) || name.includes(s) || canisterID.includes(s);
      });
    }

    // Sort by market cap to determine ranks
    const rankedTokens = filtered
      .sort((a, b) => {
        const aMarketCap = Number(a.metrics?.market_cap || 0);
        const bMarketCap = Number(b.metrics?.market_cap || 0);
        return bMarketCap - aMarketCap;
      })
      .map((token, index) => ({
        ...token,
        marketCapRank: index + 1,
      }));

    // Sort the filtered tokens
    const sortedTokens = rankedTokens.sort((a, b) => {
      let aValue, bValue;
      switch ($sortColumn) {
        case "marketCapRank":
          aValue = a.marketCapRank || 0;
          bValue = b.marketCapRank || 0;
          break;
        case "marketCap":
          aValue = Number(a.metrics?.market_cap || 0);
          bValue = Number(b.metrics?.market_cap || 0);
          break;
        case "volume_24h":
          aValue = Number(a.metrics?.volume_24h || 0);
          bValue = Number(b.metrics?.volume_24h || 0);
          break;
        case "tvl":
          aValue = Number(a.metrics?.tvl || 0);
          bValue = Number(b.metrics?.tvl || 0);
          break;
        case "price_change_24h":
          aValue = Number(a.metrics?.price_change_24h || 0);
          bValue = Number(b.metrics?.price_change_24h || 0);
          break;
        default:
          aValue = Number(a.metrics?.market_cap || 0);
          bValue = Number(b.metrics?.market_cap || 0);
      }
      return $sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    });

    // Always ensure KONG is at the top regardless of sort
    return sortedTokens.sort((a, b) => {
      if (a.canister_id === KONG_CANISTER_ID) return -1;
      if (b.canister_id === KONG_CANISTER_ID) return 1;
      return 0;
    });
  }
);

// Utility functions
export function toggleSort(column: string): void {
  if (get(sortColumnStore) === column) {
    sortDirectionStore.update((d) => (d === "asc" ? "desc" : "asc"));
  } else {
    sortColumnStore.set(column);
    sortDirectionStore.set("desc");
  }
}

export function getTrendClass(token: FE.Token): string {
  return token?.metrics?.price_change_24h
    ? Number(token.metrics.price_change_24h) > 0
      ? "positive"
      : Number(token.metrics.price_change_24h) < 0
        ? "negative"
        : ""
    : "";
} 