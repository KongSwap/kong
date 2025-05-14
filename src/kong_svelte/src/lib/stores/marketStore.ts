import { writable, derived } from 'svelte/store';
import type { Market, MarketResult } from '$lib/types/predictionMarket';
import { getAllMarkets, getAllCategories } from '$lib/api/predictionMarket';
import { toastStore } from './toastStore';

export type SortOption = 'newest' | 'pool_asc' | 'pool_desc' | 'end_time_asc' | 'end_time_desc';
export type StatusFilter = 'all' | 'active' | 'pending' | 'closed' | 'disputed' | 'voided';

// New unified interface without categorization
interface MarketState {
  markets: Market[];
  categories: string[];
  selectedCategory: string | null;
  sortOption: SortOption;
  statusFilter: StatusFilter;
  loading: boolean;
  error: string | null;
}

const initialState: MarketState = {
  markets: [],
  categories: ['All'],
  selectedCategory: null,
  sortOption: 'end_time_asc',
  statusFilter: 'active',
  loading: true,
  error: null
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
        const { sortOption, statusFilter } = await new Promise<MarketState>(resolve => {
          subscribe(state => resolve(state))();
        });
        
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
        } else if (sortOption === 'end_time_asc') {
          backendSortOption = {
            type: 'EndTime',
            direction: 'Ascending'
          };
        } else if (sortOption === 'end_time_desc') {
          backendSortOption = {
            type: 'EndTime',
            direction: 'Descending'
          };
        }
        
        // Determine status filter for API
        let apiStatusFilter = undefined;
        if (statusFilter === 'active') {
          apiStatusFilter = "Active";
        } else if (statusFilter === 'closed') {
          apiStatusFilter = "Closed";
        } else if (statusFilter === 'voided') {
          apiStatusFilter = "Voided";
        } else if (statusFilter === 'pending') {
          apiStatusFilter = "Pending";
        } else if (statusFilter === 'disputed') {
          apiStatusFilter = "Disputed";
        } 
                
        const allMarketsResult = await getAllMarkets({
          start: 0,
          length: 100, // Fetch a reasonable number of markets
          sortOption: backendSortOption,
          // Only apply API status filter if not showing all
          statusFilter: statusFilter === 'all' ? undefined : apiStatusFilter
        });
        
        // Just store the markets as they were returned from the backend
        // without categorizing them
        update(state => ({
          ...state,
          markets: (allMarketsResult.markets || []).map(market => ({
            ...market,
            resolution_data: market.resolution_data?.[0] ?? "",
            resolved_by: market.resolved_by?.[0] ?? null
          })),
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
