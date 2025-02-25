import { writable, derived, get } from 'svelte/store';
import { fetchTokensByCanisterId } from "$lib/api/tokens";
import { createAnonymousActorHelper } from "$lib/utils/actorUtils";
import { KONG_BACKEND_CANISTER_ID } from "$lib/constants/canisterConstants";
import { canisterIDLs, auth } from "$lib/services/auth";

interface PoolListState {
  processedPools: ProcessedPool[];
  filteredPools: ProcessedPool[];
  loading: boolean;
  error: string | null;
  isSearching: boolean;
  searchResultsReady: boolean;
  searchQuery: string;
  sortDirection: 'asc' | 'desc';
  initialFilterApplied: boolean;
}

interface ProcessedPool {
  id: string;
  symbol_0: string;
  symbol_1: string;
  balance: string;
  usd_balance: string;
  amount_0: string;
  amount_1: string;
  name?: string;
  address_0: string;
  address_1: string;
  searchableText: string;
  token0?: FE.Token;
  token1?: FE.Token;
  rolling_24h_apy?: number;
  rolling_24h_volume?: string;
}

const initialState: PoolListState = {
  processedPools: [],
  filteredPools: [],
  loading: true,
  error: null,
  isSearching: false,
  searchResultsReady: false,
  searchQuery: '',
  sortDirection: 'desc',
  initialFilterApplied: false
};

function createUserPoolListStore() {
  const { subscribe, update, set } = writable<PoolListState>(initialState);
  let searchDebounceTimer: ReturnType<typeof setTimeout>;
  const SEARCH_DEBOUNCE = 150;
  
  return {
    subscribe,
    
    // Actions
    reset: () => {
      set(initialState);
    },

    initialize: async () => {
      // Reset state first
      set(initialState);
      update(s => ({ ...s, loading: true }));
      try {
        const currentAuth = get(auth);
        const actor = createAnonymousActorHelper(
          KONG_BACKEND_CANISTER_ID, 
          canisterIDLs.kong_backend
        );
        
        const response = await actor.user_balances(
          currentAuth?.account?.owner?.toString() || ''
        );
        
        if (response.Ok) {
          // Match UserPoolList's processing
          const rawPools = response.Ok.map(pool => pool.LP);
          const poolsWithIds = rawPools.map(pool => ({
            ...pool,
            id: `${pool.address_0}-${pool.address_1}`
          }));
          
          // Initial processing without tokens
          update(s => ({
            ...s,
            processedPools: poolsWithIds.map(p => ({
              ...p,
              searchableText: '',
              token0: undefined,
              token1: undefined
            }))
          }));
          
          // Fetch tokens and update again
          await fetchTokensForPools(poolsWithIds);
          
          // Make sure filteredPools is updated
          userPoolListStore.updateFilteredPools();
        }
      } catch (error) {
        handleError("Failed to load user pools", error);
      } finally {
        update(s => ({ ...s, loading: false }));
      }
    },

    setSearchQuery: (query: string) => {
      update(s => {
        const newState = { ...s, searchQuery: query };
        if (!s.initialFilterApplied) {
          newState.isSearching = true;
          newState.searchResultsReady = false;
          clearTimeout(searchDebounceTimer);

          searchDebounceTimer = setTimeout(() => {
            update(s => ({ 
              ...s, 
              searchResultsReady: true, 
              isSearching: false 
            }));
          }, SEARCH_DEBOUNCE);
        }
        return newState;
      });
    },

    toggleSort: () => {
      update(s => ({
        ...s,
        sortDirection: s.sortDirection === 'desc' ? 'asc' : 'desc'
      }));
      userPoolListStore.updateFilteredPools();
    },

    // Add filtered pools updater
    updateFilteredPools: () => {
      update(s => {
        const filtered = filterPools(s.processedPools, s.searchQuery.toLowerCase());
        return { ...s, filteredPools: sortPools(filtered, s.sortDirection) };
      });
    }
  };

  // Private methods
  async function fetchTokensForPools(pools: any[]): Promise<void> {
    if (pools.length === 0) return;
    
    const tokenIds = [...new Set(pools.flatMap(pool => 
      [pool.address_0, pool.address_1]
    ))];
    
    try {
      const fetchedTokens = await fetchTokensByCanisterId(tokenIds);
      const tokenMap = fetchedTokens.reduce((acc, token) => {
        acc[token.canister_id] = token;
        return acc;
      }, {} as Record<string, FE.Token>);
      
      update(s => ({
        ...s,
        processedPools: processPoolsWithTokens(pools, tokenMap),
        filteredPools: sortPools(filterPools(processPoolsWithTokens(pools, tokenMap), s.searchQuery), s.sortDirection)
      }));
    } catch (error) {
      handleError("Failed to load token information", error);
    }
  }

  function processPoolsWithTokens(pools: any[], tokens: Record<string, FE.Token>): ProcessedPool[] {
    return pools.map(pool => ({
      ...pool,
      searchableText: getPoolSearchData(pool, tokens),
      token0: tokens[pool.address_0],
      token1: tokens[pool.address_1],
      usd_balance: pool.usd_balance || "0" // Add fallback value
    }));
  }

  function handleError(message: string, error: unknown): void {
    console.error(message, error);
    update(s => ({ ...s, error: message }));
  }
}

function getPoolSearchData(pool: any, tokens: Record<string, FE.Token>): string {
  const searchTerms = [
    pool.symbol_0,
    pool.symbol_1,
    `${pool.symbol_0}/${pool.symbol_1}`,
    pool.name,
    tokens[pool.address_0]?.name,
    tokens[pool.address_1]?.name,
    getTokenAliases(pool.symbol_0),
    getTokenAliases(pool.symbol_1)
  ];
  
  return searchTerms.filter(Boolean).join(" ").toLowerCase();
}

function getTokenAliases(symbol: string): string {
  const aliases: Record<string, string> = {
    ICP: "internet computer protocol dfinity",
    USDT: "tether usdt",
    BTC: "bitcoin btc",
    ETH: "ethereum eth"
  };
  return aliases[symbol] || "";
}

function filterPools(pools: ProcessedPool[], query: string): ProcessedPool[] {
  return pools.filter(poolItem => {
    const matchesSearch = poolItem.searchableText.includes(query.toLowerCase());
    const hasBalance = Number(poolItem.usd_balance) > 0;
    return matchesSearch && hasBalance;
  });
}

function sortPools(pools: ProcessedPool[], direction: 'asc' | 'desc'): ProcessedPool[] {
  return [...pools].sort((a, b) => 
    direction === 'desc' 
      ? Number(b.usd_balance) - Number(a.usd_balance)
      : Number(a.usd_balance) - Number(b.usd_balance)
  );
}

export const userPoolListStore = createUserPoolListStore(); 