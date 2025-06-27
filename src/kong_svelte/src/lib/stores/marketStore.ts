import { writable, derived } from 'svelte/store';
import type { Market } from '../../../../declarations/prediction_markets_backend/prediction_markets_backend.did';
import { getAllMarkets, getAllCategories, getMarketsByCreator } from '$lib/api/predictionMarket';
import { toastStore } from './toastStore';

export type SortOption = 'newest' | 'pool_asc' | 'pool_desc' | 'end_time_asc' | 'end_time_desc';
export type StatusFilter = 'all' | 'active' | 'pending' | 'closed' | 'disputed' | 'voided' | 'myMarkets';

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
  // Pagination state
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
}

const initialState: MarketState = {
  markets: [],
  categories: ['All'],
  selectedCategory: null,
  sortOption: 'pool_desc',
  statusFilter: 'all',
  loading: true,
  error: null,
  currentUserPrincipal: null,
  // Pagination state
  currentPage: 0,
  pageSize: 20,
  totalPages: 0,
  totalCount: 0
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
      this.resetPagination();
      this.refreshMarkets();
    },
    
    // Set sorting option
    setSortOption(sortOption: SortOption) {
      update(state => ({
        ...state,
        sortOption
      }));
      this.resetPagination();
      this.refreshMarkets();
    },

    // Set status filter
    setStatusFilter(statusFilter: StatusFilter) {
      update(state => ({
        ...state,
        statusFilter
      }));
      this.resetPagination();
      this.refreshMarkets();
    },

    // Reset pagination state
    resetPagination() {
      update(state => ({
        ...state,
        currentPage: 0,
        totalPages: 0,
        totalCount: 0
      }));
    },

    // Go to specific page
    async goToPage(page: number) {
      update(state => ({ ...state, loading: true }));
      
      try {
        const { sortOption, statusFilter, currentUserPrincipal, pageSize } = await new Promise<MarketState>(resolve => {
          subscribe(state => resolve(state))();
        });

        // Check if we need to filter by current user
        if (statusFilter === 'myMarkets') {
          if (!currentUserPrincipal) {
            update(state => ({ ...state, loading: false }));
            return;
          }

          // Use getMarketsByCreator for user's markets
          const marketsResult = await getMarketsByCreator(currentUserPrincipal, {
            start: page * pageSize,
            length: pageSize,
            sortByCreationTime: sortOption === 'newest'
          });

          update(state => ({
            ...state,
            markets: marketsResult.markets,
            currentPage: page,
            totalPages: Math.ceil(marketsResult.markets.length / pageSize),
            totalCount: marketsResult.markets.length,
            loading: false
          }));
          return;
        }

        // Use the regular getAllMarkets for other filters
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
          backendSortOption = {
            type: 'EndTime',
            direction: sortOption === 'end_time_asc' ? 'Ascending' : 'Descending'
          };
        }
        
        // Determine status filter for API
        let apiStatusFilter = undefined;
        if (statusFilter === 'active') {
          apiStatusFilter = "Active";
        } else if (statusFilter === 'pending') {
          apiStatusFilter = "ExpiredUnresolved";
        } else if (statusFilter === 'closed') {
          apiStatusFilter = "Closed";
        } else if (statusFilter === 'disputed') {
          apiStatusFilter = "Disputed";
        } else if (statusFilter === 'voided') {
          apiStatusFilter = "Voided";
        }
                
        const allMarketsResult = await getAllMarkets({
          start: page * pageSize,
          length: pageSize,
          sortOption: backendSortOption,
          statusFilter: statusFilter === 'all' ? undefined : apiStatusFilter
        });
        
        const totalCount = Number(allMarketsResult.total_count || 0);
        const totalPages = Math.ceil(totalCount / pageSize);
        
        update(state => ({
          ...state,
          markets: allMarketsResult.markets || [],
          currentPage: page,
          totalPages,
          totalCount,
          loading: false
        }));
      } catch (error) {
        console.error('Failed to load page:', error);
        toastStore.add({
          title: "Error",
          message: "Failed to load markets",
          type: "error"
        });
        update(state => ({
          ...state,
          loading: false
        }));
      }
    },

    // Refresh markets
    async refreshMarkets() {
      update(state => ({ ...state, loading: true }));
      
      try {
        const { sortOption, statusFilter, currentUserPrincipal, pageSize } = await new Promise<MarketState>(resolve => {
          subscribe(state => resolve(state))();
        });

        let marketsResult: { markets: Market[], total_count?: bigint, total?: bigint };

        // Check if we need to filter by current user
        if (statusFilter === 'myMarkets') {
          if (!currentUserPrincipal) {
            // If no user is connected, return empty results
            update(state => ({
              ...state,
              markets: [],
              loading: false,
              error: null,
              currentPage: 0,
              hasMorePages: false,
              totalCount: 0
            }));
            return;
          }

          // Use getMarketsByCreator for user's markets
          marketsResult = await getMarketsByCreator(currentUserPrincipal, {
            start: 0,
            length: pageSize,
            sortByCreationTime: sortOption === 'newest'
          });

          // No transformation needed for legacy backend
          const transformedMarkets = marketsResult.markets;

          update(state => ({
            ...state,
            markets: transformedMarkets,
            loading: false,
            error: null,
            currentPage: 1,
            hasMorePages: transformedMarkets.length === pageSize,
            totalCount: transformedMarkets.length
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
          backendSortOption = {
            type: 'EndTime',
            direction: sortOption === 'end_time_asc' ? 'Ascending' : 'Descending'
          };
        }
        
        // Determine status filter for API
        let apiStatusFilter = undefined;
        if (statusFilter === 'active') {
          apiStatusFilter = "Active";
        } else if (statusFilter === 'pending') {
          apiStatusFilter = "ExpiredUnresolved";
        } else if (statusFilter === 'closed') {
          apiStatusFilter = "Closed";
        } else if (statusFilter === 'disputed') {
          apiStatusFilter = "Disputed";
        } else if (statusFilter === 'voided') {
          apiStatusFilter = "Voided";
        }
                
        const allMarketsResult = await getAllMarkets({
          start: 0,
          length: pageSize,
          sortOption: backendSortOption,
          // Only apply API status filter if not showing all
          statusFilter: statusFilter === 'all' ? undefined : apiStatusFilter
        });
        
        const totalCount = Number(allMarketsResult.total_count || 0);
        const totalPages = Math.ceil(totalCount / pageSize);
        
        update(state => ({
          ...state,
          markets: allMarketsResult.markets || [],
          loading: false,
          error: null,
          currentPage: 0,
          totalPages,
          totalCount
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

// Derived store for filtered markets (returns flat array)
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
  
  // No additional client-side filtering needed since backend handles it correctly
    
  return filtered;
});

// Derived store for grouped filtered markets
export const groupedFilteredMarkets = derived(marketStore, $marketStore => {
  const { markets, selectedCategory } = $marketStore;
  
  // Filter by category if selected
  let filtered = selectedCategory 
    ? markets.filter(market => {
        // Check if the market category matches the selected category
        // MarketCategory is a variant type, so we need to check the key
        return selectedCategory in market.category;
      })
    : markets;
  
  // Active markets: have 'Active' status
  const active = filtered.filter(market => 
    'Active' in market.status
  );
  
  // Expired but unresolved: have 'ExpiredUnresolved' status
  const expired_unresolved = filtered.filter(market => 
    'ExpiredUnresolved' in market.status
  );
  
  // Resolved markets: either Closed or Voided
  const resolved = filtered.filter(market => 
    'Closed' in market.status || 'Voided' in market.status
  );
  
  return {
    active,
    expired_unresolved,
    resolved
  };
});
