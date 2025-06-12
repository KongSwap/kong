import { writable, get } from 'svelte/store';
import { fetchTokensByCanisterId } from "$lib/api/tokens";
import { auth } from "$lib/stores/auth";
import { canisters } from '$lib/config/auth.config';
import type { CanisterType } from '$lib/config/auth.config';
import { UserPool, type UserPoolData } from '$lib/models/UserPool';
import { fetchPools } from '$lib/api/pools';

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

interface ProcessedPool extends UserPoolData {
  searchableText: string;
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

function createCurrentUserPoolsStore() {
  const { subscribe, update, set } = writable<PoolListState>(initialState);
  let searchDebounceTimer: ReturnType<typeof setTimeout>;
  const SEARCH_DEBOUNCE = 150;
  let initializationPromise: Promise<void> | null = null;
  let lastInitializationPrincipal: string | null = null;
  
  return {
    subscribe,
    
    // Actions
    reset: () => {
      set(initialState);
    },

    initialize: async () => {
      const currentAuth = get(auth);
      const currentPrincipal = currentAuth?.account?.owner || '';
      
      // If we're already initializing for this principal, return the existing promise
      if (initializationPromise && lastInitializationPrincipal === currentPrincipal) {
        const currentState = get({ subscribe });
        // Only return existing promise if we're still loading
        if (currentState.loading) {
          return initializationPromise;
        }
      }
      
      // Create new initialization promise
      lastInitializationPrincipal = currentPrincipal;
      initializationPromise = (async () => {
        // Set loading state, but don't reset the pools data yet
        update(s => ({ ...s, loading: true, error: null }));
        
        try {
          const actor = auth.pnp.getActor<CanisterType['KONG_BACKEND']>({
            canisterId: canisters.kongBackend.canisterId,
            idl: canisters.kongBackend.idl,
            anon: true,
          });
          
          const response = await actor.user_balances(currentPrincipal);
                  
          if ('Ok' in response) {
            // Process the new raw data
            const rawPools = response.Ok.map(pool => pool.LP);
            
            // Fetch tokens for the new pools
            await fetchTokensForPools(rawPools); 
          } else {
            // Handle potential errors from the backend response structure if needed
            handleError("Failed to load user pools: Backend returned an error structure", response);
          }
        } catch (error) {
          handleError("Failed to load user pools", error);
        } finally {
          // Set loading to false regardless of success or error
          update(s => ({ ...s, loading: false }));
          // Clear promise after completion
          if (lastInitializationPrincipal === currentPrincipal) {
            initializationPromise = null;
          }
        }
      })();
      
      return initializationPromise;
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
      currentUserPoolsStore.updateFilteredPools();
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
    // Store the current search query and sort direction before updating
    const currentState = get({ subscribe });
    const currentSearchQuery = currentState.searchQuery;
    const currentSortDirection = currentState.sortDirection;

    if (pools.length === 0) {
      // If the new fetch results in zero pools, update the state accordingly
      update(s => ({
        ...s,
        processedPools: [],
        filteredPools: []
      }));
      return;
    }
    
    const tokenIds = [...new Set(pools.flatMap(pool => 
      [pool.address_0, pool.address_1]
    ))];
    
    try {
      const fetchedTokens = await fetchTokensByCanisterId(tokenIds);
      const tokenMap = fetchedTokens.reduce((acc, token) => {
        acc[token.address] = token;
        return acc;
      }, {} as Record<string, Kong.Token>);
      
      // Process the new pools with the fetched tokens
      const newProcessedPools = await processPoolsWithTokens(pools, tokenMap);
      
      // Update the state with the new processed pools and apply current filter/sort
      update(s => ({
        ...s,
        processedPools: newProcessedPools,
        // Re-apply filter and sort based on the *new* data and *current* settings
        filteredPools: sortPools(filterPools(newProcessedPools, currentSearchQuery), currentSortDirection)
      }));
    } catch (error) {
      handleError("Failed to load token information", error);
    }
  }

  async function processPoolsWithTokens(pools: any[], tokens: Record<string, Kong.Token>): Promise<ProcessedPool[]> {
    // Fetch all pool data to get current balances and LP supply
    try {
      const poolsResponse = await fetchPools({ limit: 1000 }); // Get all pools
      const allPools = poolsResponse.pools;
      
      return pools.map(pool => {
        const parsed = UserPool.parse(pool, tokens, allPools);
        return {
          ...parsed,
          searchableText: getPoolSearchData(parsed, tokens)
        };
      });
    } catch (error) {
      console.error("Failed to fetch pool data for calculations:", error);
      // Fallback: process without pool data
      return pools.map(pool => {
        const parsed = UserPool.parse(pool, tokens);
        return {
          ...parsed,
          searchableText: getPoolSearchData(parsed, tokens)
        };
      });
    }
  }

  function handleError(message: string, error: unknown): void {
    console.error(message, error);
    update(s => ({ ...s, error: message }));
  }
}

function getPoolSearchData(pool: any, tokens: Record<string, Kong.Token>): string {
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
    // If there's no search query, include all pools with any balance
    if (!query) {
      return Number(poolItem.usd_balance) > 0;
    }
    // Otherwise filter by both search and balance
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

export const currentUserPoolsStore = createCurrentUserPoolsStore(); 