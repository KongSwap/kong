import { formatTokenBalance, formatUsdValue } from "$lib/utils/tokenFormatters";

export class TokenFilterService {
  static filterBySearchQuery(token: FE.Token, query: string): boolean {
    if (!query) return true;
    
    const searchLower = query.toLowerCase();
    return token.symbol.toLowerCase().includes(searchLower) ||
           token.name.toLowerCase().includes(searchLower) ||
           token.canister_id.toLowerCase().includes(searchLower);
  }

  static filterByStandardFilter(token: FE.Token, filter: "all" | "ck" | "favorites", favorites: Map<string, boolean>): boolean {
    switch (filter) {
      case "ck":
        return token.symbol.toLowerCase().startsWith("ck");
      case "favorites":
        return favorites.get(token.canister_id) || false;
      case "all":
      default:
        return true;
    }
  }

  static filterByBalance(token: FE.Token, hideZeroBalances: boolean, balances: Record<string, { in_tokens: bigint }>): boolean {
    if (!hideZeroBalances) return true;
    
    const balance = balances[token.canister_id]?.in_tokens;
    return balance ? balance > BigInt(0) : false;
  }

  static sortTokens(a: FE.Token, b: FE.Token, sortColumn: string, sortDirection: string, favorites: Map<string, boolean>, balances: Record<string, { in_usd: string }>): number {
    // Sort by favorites first
    const aFavorite = favorites.get(a.canister_id) || false;
    const bFavorite = favorites.get(b.canister_id) || false;
    if (aFavorite !== bFavorite) return bFavorite ? 1 : -1;

    // Then sort by value if that's selected
    if (sortColumn === 'value') {
      const aBalance = balances[a.canister_id]?.in_usd || "0";
      const bBalance = balances[b.canister_id]?.in_usd || "0";
      const aValue = Number(aBalance);
      const bValue = Number(bBalance);
      return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
    }

    return 0;
  }

  static getFilteredAndSortedTokens(
    allTokens: FE.Token[],
    searchQuery: string,
    standardFilter: "all" | "ck" | "favorites",
    hideZeroBalances: boolean,
    favoriteTokens: Map<string, boolean>,
    sortColumn: string,
    sortDirection: string,
    apiTokens: FE.Token[],
    balances: Record<string, { in_tokens: bigint; in_usd: string }>
  ): FE.Token[] {
    return Array.from(new Map(
      // Combine both sources and map by canister_id to deduplicate
      [...allTokens, ...apiTokens].map(token => [token.canister_id, token])
    ).values())
      .filter((token) => {
        if (!token?.canister_id || !token?.symbol || !token?.name) {
          console.warn("Incomplete token data:", token);
          return false;
        }
        
        // Apply all filters
        return this.filterBySearchQuery(token, searchQuery) && 
               this.filterByStandardFilter(token, standardFilter, favoriteTokens) &&
               this.filterByBalance(token, hideZeroBalances, balances);
      })
      .sort((a, b) => this.sortTokens(a, b, sortColumn, sortDirection, favoriteTokens, balances));
  }
} 