import { writable, derived } from 'svelte/store';
import type { Market, MarketResult } from '$lib/types/predictionMarket';
import { getAllMarkets, getAllCategories } from '$lib/api/predictionMarket';
import { toastStore } from './toastStore';

export type SortOption = 'newest' | 'pool_asc' | 'pool_desc';
export type StatusFilter = 'all' | 'open' | 'expired' | 'resolved' | 'voided';

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
  sortOption: 'pool_desc',
  statusFilter: 'open',
  loading: true,
  error: null
};

function createMarketStore() {
  const { subscribe, set, update } = writable<MarketState>(initialState);

  return {
    subscribe,
    
    // Initialize the store
    async init() {
      try {
        const categoriesResult = await getAllCategories();
        
        update(state => ({
          ...state,
          categories: ['All', ...categoriesResult],
        }));
        
        await this.refreshMarkets();
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
        }
        
        // Determine status filter for API
        let apiStatusFilter = undefined;
        if (statusFilter === 'open') {
          apiStatusFilter = "Active";
        } else if (statusFilter === 'resolved') {
          apiStatusFilter = "Closed";
        } else if (statusFilter === 'voided') {
          apiStatusFilter = "Voided";
        }
        
        const allMarketsResult = await getAllMarkets({
          start: 0,
          length: 100, // Fetch a reasonable number of markets
          sortOption: backendSortOption,
          // Only apply API status filter if not showing all
          statusFilter: statusFilter === 'all' ? undefined : apiStatusFilter
        });
        console.log("allMarketsResult", allMarketsResult);
        
        // Transform the markets from backend format to frontend format
        update(state => ({
          ...state,
          markets: (allMarketsResult.markets || []).map(market => {
            // Transform MarketStatus from backend to frontend format
            let frontendStatus;
            if ('Active' in market.status || 'PendingActivation' in market.status) {
              frontendStatus = { Active: null };
            } else if ('Closed' in market.status) {
              frontendStatus = { Closed: market.status.Closed };
            } else if ('Disputed' in market.status) {
              frontendStatus = { Disputed: null };
            } else if ('Voided' in market.status) {
              frontendStatus = { Voided: null };
            } else if ('ExpiredUnresolved' in market.status) {
              // Treat expired unresolved as still Open for frontend purposes
              frontendStatus = { Active: null };
            } else {
              // Fallback to Open for unknown statuses
              frontendStatus = { Active: null };
            }

            return {
              ...market,
              status: frontendStatus,
              resolution_data: market.resolution_data?.[0] ?? "",
              resolved_by: market.resolved_by?.[0] ?? null
            };
          }),
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

// Derived store that filters and categorizes markets on-the-fly as needed by the UI
export const filteredMarkets = derived(
  marketStore,
  ($marketStore) => {
    const { markets, selectedCategory, statusFilter } = $marketStore;
    const nowNs = BigInt(Date.now()) * BigInt(1_000_000);
    
    // Filter by category if needed
    let filteredMarkets = markets;
    if (selectedCategory) {
      filteredMarkets = markets.filter(market => {
        const categoryKey = Object.keys(market.category)[0];
        return categoryKey === selectedCategory;
      });
    }
    
    // Filter by status
    let statusFilteredMarkets = filteredMarkets;
    if (statusFilter === 'open') {
      statusFilteredMarkets = filteredMarkets.filter(
        market => 'Active' in market.status && BigInt(market.end_time) > nowNs
      );
    } else if (statusFilter === 'expired') {
      statusFilteredMarkets = filteredMarkets.filter(
        market => 'Active' in market.status && BigInt(market.end_time) <= nowNs
      );
    } else if (statusFilter === 'resolved') {
      statusFilteredMarkets = filteredMarkets.filter(
        market => 'Closed' in market.status
      );
    } else if (statusFilter === 'voided') {
      statusFilteredMarkets = filteredMarkets.filter(
        market => 'Voided' in market.status
      );
    }
    
    // For compatibility with the UI, maintain the expected structure
    // When status filter is 'all', put all markets in active to prevent grouping
    if (statusFilter === 'all') {
      return {
        active: filteredMarkets,
        expired_unresolved: [],
        resolved: []
      };
    } else {
      return {
        active: statusFilter === 'open' ? statusFilteredMarkets : [],
        expired_unresolved: statusFilter === 'expired' ? statusFilteredMarkets : [],
        resolved: (statusFilter === 'resolved' || statusFilter === 'voided') ? statusFilteredMarkets as unknown as MarketResult[] : []
      };
    }
  }
); 