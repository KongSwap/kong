import { writable, derived } from 'svelte/store';
import type { Market } from '../../declarations/prediction_markets_backend_legacy/prediction_markets_backend.did';
import { getAllMarkets, getAllCategories, getMarketsByCreator } from '$lib/api/predictionMarket';
import { toastStore } from './toastStore';

export type SortOption = 'newest' | 'pool_asc' | 'pool_desc' | 'end_time_asc' | 'end_time_desc';
export type StatusFilter = 'all' | 'open' | 'expired' | 'resolved' | 'voided' | 'myMarkets';

// New unified interface without categorization
interface MarketState {
  markets: Market[];
  categories: string[];
  selectedCategory: string | null;
  sortOption: SortOption;
  statusFilter: StatusFilter;
  loading: boolean;
  error: string | null;
  currentUserPrincipal: string | null; // Add current user principal
}

const initialState: MarketState = {
  markets: [],
  categories: ['All'],
  selectedCategory: null,
  sortOption: 'end_time_asc',
  statusFilter: 'open',
  loading: true,
  error: null,
  currentUserPrincipal: null
};

function createMarketStore() {
  const { subscribe, set, update } = writable<MarketState>(initialState);

  return {
    subscribe,
    
    // Initialize the store
    async init(initialOverrides?: { statusFilter?: StatusFilter, sortOption?: SortOption }) {
      update(state => ({
        ...state,
        statusFilter: initialOverrides?.statusFilter ?? state.statusFilter,
        sortOption: initialOverrides?.sortOption ?? state.sortOption,
        loading: true, // Ensure loading is true before fetching
        error: null,
      }));

      try {
        const categoriesResult = await getAllCategories();
        
        update(state => ({
          ...state,
          categories: ['All', ...categoriesResult],
        }));
        
        await this.refreshMarkets(); // Fetches markets with potentially overridden filters
      } catch (e) {
        update(state => ({
          ...state,
          error: 'Failed to load prediction markets',
          loading: false
        }));
        console.error(e);
      }
    },

    // Set current user principal
    setCurrentUserPrincipal(principal: string | null) {
      update(state => ({
        ...state,
        currentUserPrincipal: principal
      }));
    },

    // Set selected category
    setCategory(category: string | null) {
      update(state => ({
        ...state,
        selectedCategory: category === 'All' ? null : category
      }));
      this.refreshMarkets();
    },
    
    // Set sorting option
    setSortOption(sortOption: SortOption) {
      update(state => ({
        ...state,
        sortOption
      }));
      this.refreshMarkets();
    },

    // Set status filter
    setStatusFilter(statusFilter: StatusFilter) {
      update(state => ({
        ...state,
        statusFilter
      }));
      this.refreshMarkets();
    },

    // Refresh markets
    async refreshMarkets() {
      update(state => ({ ...state, loading: true }));
      
      try {
        const { sortOption, statusFilter, currentUserPrincipal } = await new Promise<MarketState>(resolve => {
          subscribe(state => resolve(state))();
        });

        let marketsResult;

        // Check if we need to filter by current user
        if (statusFilter === 'myMarkets') {
          if (!currentUserPrincipal) {
            // If no user is connected, return empty results
            update(state => ({
              ...state,
              markets: [],
              loading: false,
              error: null
            }));
            return;
          }

          // Use getMarketsByCreator for user's markets
          marketsResult = await getMarketsByCreator(currentUserPrincipal, {
            start: 0,
            length: 100,
            sortByCreationTime: sortOption === 'newest'
          });

          // No transformation needed for legacy backend
          const transformedMarkets = marketsResult.markets;

          update(state => ({
            ...state,
            markets: transformedMarkets,
            loading: false,
            error: null
          }));
          return;
        }

        // Use the regular getAllMarkets for other filters
        // Map the UI sort option to backend sort options
        let backendSortOption = undefined;
        if (sortOption === 'pool_asc') {
          backendSortOption = {
            type: 'TotalPool',
            direction: 'Ascending'
          };
        } else if (sortOption === 'pool_desc') {
          backendSortOption = {
            type: 'TotalPool',
            direction: 'Descending'
          };
        } else if (sortOption === 'newest') {
          backendSortOption = {
            type: 'CreatedAt',
            direction: 'Descending'
          };
        } else if (sortOption === 'end_time_asc' || sortOption === 'end_time_desc') {
          // Backend doesn't support EndTime sorting, use CreatedAt as fallback
          backendSortOption = {
            type: 'CreatedAt',
            direction: sortOption === 'end_time_asc' ? 'Ascending' : 'Descending'
          };
        }
        
        // Determine status filter for API
        let apiStatusFilter = undefined;
        if (statusFilter === 'open') {
          apiStatusFilter = "Open";
        } else if (statusFilter === 'resolved') {
          apiStatusFilter = "Closed";
        } else if (statusFilter === 'voided') {
          apiStatusFilter = "Voided";
        }
        // Note: 'expired' is handled by filtering open markets with past end_time 
                
        const allMarketsResult = await getAllMarkets({
          start: 0,
          length: 100, // Fetch a reasonable number of markets
          sortOption: backendSortOption,
          // Only apply API status filter if not showing all
          statusFilter: statusFilter === 'all' ? undefined : apiStatusFilter
        });
        
        // No transformation needed for legacy backend
        update(state => ({
          ...state,
          markets: allMarketsResult.markets || [],
          loading: false,
          error: null
        }));
      } catch (error) {
        console.error('Failed to refresh markets:', error);
        toastStore.add({
          title: "Error",
          message: "Failed to refresh markets",
          type: "error"
        });
        update(state => ({
          ...state,
          loading: false,
          error: 'Failed to refresh markets'
        }));
      }
    },

    // Reset store
    reset() {
      set(initialState);
    }
  };
}

export const marketStore = createMarketStore();

// Derived store for filtered markets
export const filteredMarkets = derived(marketStore, $marketStore => {
  const { markets, selectedCategory } = $marketStore;
  
  // Filter by category if selected
  let filtered = selectedCategory 
    ? markets.filter(market => {
        // Check if the market category matches the selected category
        // MarketCategory is a variant type, so we need to check the key
        return selectedCategory in market.category;
      })
    : markets;
    
  // Group markets by their status
  // Handle both 'Active' and 'Open' status variants for compatibility
  const active = filtered.filter(market => 
    'Active' in market.status || 'Open' in market.status
  );
  const expired_unresolved = filtered.filter(market => 
    ('Active' in market.status || 'Open' in market.status) && 
    BigInt(market.end_time) <= BigInt(Date.now() * 1_000_000)
  );
  const resolved = filtered.filter(market => 
    'Closed' in market.status || 'Voided' in market.status
  );
  
  return {
    active,
    expired_unresolved,
    resolved
  };
});
