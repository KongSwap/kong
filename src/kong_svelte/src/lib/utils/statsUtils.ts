import { derived, type Readable } from 'svelte/store';
import { KONG_CANISTER_ID, CKUSDT_CANISTER_ID, ICP_CANISTER_ID } from '$lib/constants/canisterConstants';
import { tokenStore } from '$lib/services/tokens/tokenStore';
import { formatToNonZeroDecimal } from '$lib/utils/numberFormatUtils';
import { get } from 'svelte/store';

type FilterResult = 
  | { type: 'tokens'; tokens: FE.Token[] }
  | { type: 'error'; showFavoritesPrompt?: boolean; noFavorites?: boolean };

export type EnhancedToken = FE.Token & {
  marketCapRank?: number;
  volumeRank?: number;
  isHot?: boolean;
};

type FilteredTokensResult = {
  tokens: EnhancedToken[];
  loading: boolean;
  volumeRankMap?: Map<string, number>;
  showFavoritesPrompt?: boolean;
  noFavorites?: boolean;
};

export function getPriceChangeClass(token: FE.Token): string {
  if (!token?.metrics?.price_change_24h) return '';
  const change = Number(token?.metrics?.price_change_24h);
  if (change > 0) return 'text-kong-accent-green';
  if (change < 0) return 'text-kong-accent-red';
  return '';
}

export function createFilteredTokens(
  liveTokens: Readable<FE.Token[]>,
  searchQuery: Readable<string>,
  sortColumn: Readable<string>,
  sortDirection: Readable<'asc' | 'desc'>,
  showFavoritesOnly: Readable<boolean>,
  currentWalletFavorites: Readable<string[]>,
  auth: { isConnected: boolean }
): Readable<FilteredTokensResult> {
  return derived(
    [liveTokens, searchQuery, sortColumn, sortDirection, showFavoritesOnly, currentWalletFavorites],
    ([$liveTokens, $searchQuery, $sortColumn, $sortDirection, $showFavoritesOnly, $currentWalletFavorites]): FilteredTokensResult => {
      if (!$liveTokens) return { tokens: [], loading: true };
      
      let tokens = [...$liveTokens];
      
      // Create rank maps first, before any filtering
      const volumeRankMap = createVolumeRankMap(tokens);
      const marketCapRankMap = createMarketCapRankMap(tokens);

      // Add ranks to all tokens before filtering
      tokens = tokens.map(token => ({
        ...token,
        marketCapRank: marketCapRankMap.get(token.canister_id),
        volumeRank: volumeRankMap.get(token.canister_id),
        isHot: volumeRankMap.get(token.canister_id) !== undefined && volumeRankMap.get(token.canister_id)! <= 5
      }));

      // Apply filters
      const filterResult = applyFilters(tokens, {
        showFavoritesOnly: $showFavoritesOnly,
        currentWalletFavorites: $currentWalletFavorites,
        searchQuery: $searchQuery,
        isConnected: auth.isConnected
      });

      if (filterResult.type === 'error') {
        return {
          tokens: [],
          loading: false,
          ...(filterResult.showFavoritesPrompt && { showFavoritesPrompt: true }),
          ...(filterResult.noFavorites && { noFavorites: true })
        };
      }

      tokens = filterResult.tokens;
      
      // Apply sorting
      tokens = applySorting(tokens, {
        sortColumn: $sortColumn,
        sortDirection: $sortDirection,
        marketCapRankMap
      });

      return { 
        tokens, 
        loading: false,
        volumeRankMap
      };
    }
  );
}

function createVolumeRankMap(tokens: FE.Token[]) {
  return new Map(
    [...tokens]
      .filter(token => 
        token.canister_id !== CKUSDT_CANISTER_ID && 
        token.canister_id !== ICP_CANISTER_ID
      )
      .sort((a, b) => {
        const aVolume = Number(a?.metrics?.volume_24h?.replace(/[^0-9.-]+/g, "")) || 0;
        const bVolume = Number(b?.metrics?.volume_24h?.replace(/[^0-9.-]+/g, "")) || 0;
        return bVolume - aVolume;
      })
      .map((token, index) => [token.canister_id, index + 1])
  );
}

function createMarketCapRankMap(tokens: FE.Token[]) {
  return new Map(
    [...tokens]
      .sort((a, b) => {
        const aMarketCap = Number(a?.metrics?.market_cap?.toString().replace(/[^0-9.-]+/g, "")) || 0;
        const bMarketCap = Number(b?.metrics?.market_cap?.toString().replace(/[^0-9.-]+/g, "")) || 0;
        return bMarketCap - aMarketCap;
      })
      .map((token, index) => [token.canister_id, index + 1])
  );
}

function applyFilters(tokens: FE.Token[], options: {
  showFavoritesOnly: boolean,
  currentWalletFavorites: string[],
  searchQuery: string,
  isConnected: boolean
}): FilterResult {
  const { showFavoritesOnly, currentWalletFavorites, searchQuery, isConnected } = options;

  if (showFavoritesOnly) {
    if (!isConnected) {
      return { type: 'error', showFavoritesPrompt: true };
    }
    tokens = tokens.filter(token => currentWalletFavorites.includes(token.canister_id));
    if (tokens.length === 0) {
      return { type: 'error', noFavorites: true };
    }
  } else if (searchQuery) {
    const query = searchQuery.toLowerCase();
    tokens = tokens.filter(token => 
      token.name.toLowerCase().includes(query) ||
      token.symbol.toLowerCase().includes(query) || 
      token.address.toLowerCase().includes(query)
    );
  }

  return { type: 'tokens', tokens };
}

function applySorting(tokens: FE.Token[], options: {
  sortColumn: string,
  sortDirection: 'asc' | 'desc',
  marketCapRankMap: Map<string, number>
}) {
  const { sortColumn, sortDirection, marketCapRankMap } = options;

  return tokens.sort((a, b) => {
    if (a.canister_id === KONG_CANISTER_ID) return -1;
    if (b.canister_id === KONG_CANISTER_ID) return 1;

    const getValue = (token: FE.Token) => {
      switch (sortColumn) {
        case "marketCapRank": return marketCapRankMap.get(token.canister_id) || Infinity;
        case "price": return Number(token?.metrics?.price) || 0;
        case "price_change_24h": return Number(token?.metrics?.price_change_24h) || 0;
        case "volume_24h": return Number(token?.metrics?.volume_24h?.replace(/[^0-9.-]+/g, "")) || 0;
        case "marketCap": return Number(token?.metrics?.market_cap?.toString().replace(/[^0-9.-]+/g, "")) || 0;
        case "name": return token.name;
        case "token_name": return token.name;
        case "tvl": {
          const tvlA = Number(a.metrics?.tvl || 0);
          const tvlB = Number(b.metrics?.tvl || 0);
          return sortDirection === "asc" ? tvlA - tvlB : tvlB - tvlA;
        }
        default: return token[sortColumn] || 0;
      }
    };

    const aValue = getValue(a);
    const bValue = getValue(b);

    if (typeof aValue === 'string') {
      return sortDirection === "asc" 
        ? aValue.localeCompare(bValue) 
        : bValue.localeCompare(aValue);
    }
    return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
  });
}

function addTokenMetadata(tokens: FE.Token[], options: {
  volumeRankMap: Map<string, number>,
  marketCapRankMap: Map<string, number>
}) {
  const { volumeRankMap, marketCapRankMap } = options;

  return tokens.map(token => {
    const volumeRank = volumeRankMap.get(token.canister_id);
    return {
      ...token,
      marketCapRank: marketCapRankMap.get(token.canister_id),
      volumeRank,
      isHot: volumeRank !== undefined && volumeRank <= 5
    };
  });
}

export function formatPoolData(pools: BE.Pool[]): BE.Pool[] {
  if (pools.length === 0) return pools;
  const store = get(tokenStore);

  const poolsMap =  pools.map((pool, index) => {
    const apy = formatToNonZeroDecimal(pool.rolling_24h_apy);
    const baseToken = store.tokens.find(token => token.canister_id === pool.address_1);
    return {
      ...pool,
      price_usd: (Number(pool.price) * Number(baseToken?.metrics.price)).toString(),
      id: `${pool.symbol_0}-${pool.symbol_1}-${index}`,
      apy,
    };
  });
  return poolsMap;
}

export function filterPools(pools: BE.Pool[], query: string): BE.Pool[] {
  if (!query) return pools;
  const lowerQuery = query.toLowerCase();
  return pools.filter(pool =>
    `${pool.symbol_0}/${pool.symbol_1}`.toLowerCase().includes(lowerQuery),
  );
}

export function filterTokens(tokens: FE.Token[], searchQuery: string): FE.Token[] {
  if (!searchQuery) return tokens;
  const lowerCaseQuery = searchQuery.toLowerCase();
  return tokens.filter(token =>
    token.symbol.toLowerCase().includes(lowerCaseQuery) ||
    token.name.toLowerCase().includes(lowerCaseQuery)
  );
}

export function getPoolPriceUsd(pool: BE.Pool): string {
  if (!pool?.price) return '0';
  return formatToNonZeroDecimal(pool.price);
}