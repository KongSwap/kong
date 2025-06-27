import { writable, derived } from 'svelte/store';
import type { Market, MarketResult } from '../../../../declarations/prediction_markets_backend_legacy/prediction_markets_backend.did';
import { getMarketsByStatus, getAllCategories } from '$lib/api/predictionMarketLegacy';
import { toastStore } from './toastStore';

export type SortOption = 'newest' | 'pool_asc' | 'pool_desc';
export type StatusFilter = 'all' | 'open' | 'expired' | 'resolved' | 'voided';

// Legacy interface with grouped markets
interface MarketStateLegacy {
  active: Market[];
  expired_unresolved: Market[];
  resolved: MarketResult[];
  categories: string[];
  selectedCategory: string | null;
  sortOption: SortOption;
  statusFilter: StatusFilter;
  loading: boolean;
  error: string | null;
}

const initialState: MarketStateLegacy = {
  active: [],
  expired_unresolved: [],
  resolved: [],
  categories: ['All'],
  selectedCategory: null,
  sortOption: 'pool_desc',
  statusFilter: 'all',
  loading: true,
  error: null
};

function createMarketStoreLegacy() {
  const { subscribe, set, update } = writable<MarketStateLegacy>(initialState);

  return {
    subscribe,
    
    // Initialize the store
    async init() {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        // Load categories
        const categoriesResult = await getAllCategories();
        update(state => ({
          ...state,
          categories: ['All', ...categoriesResult],
        }));
        
        // Load markets
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
    },
    
    // Set sorting option
    setSortOption(sortOption: SortOption) {
      update(state => ({
        ...state,
        sortOption
      }));
    },

    // Set status filter
    setStatusFilter(statusFilter: StatusFilter) {
      update(state => ({
        ...state,
        statusFilter
      }));
    },

    // Refresh markets
    async refreshMarkets() {
      update(state => ({ ...state, loading: true }));
      
      try {
        const result = await getMarketsByStatus();
        
        if (result && result.markets_by_status) {
          update(state => ({
            ...state,
            active: result.markets_by_status.active || [],
            expired_unresolved: result.markets_by_status.expired_unresolved || [],
            resolved: result.markets_by_status.resolved || [],
            loading: false,
            error: null
          }));
        } else {
          throw new Error('Invalid response from getMarketsByStatus');
        }
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

export const marketStore = createMarketStoreLegacy();

// Helper function to sort markets (works with both Market and MarketResult)
function sortMarkets<T extends Market | MarketResult>(markets: T[], sortOption: SortOption): T[] {
  const sorted = [...markets];
  
  switch (sortOption) {
    case 'newest':
      return sorted.sort((a, b) => {
        const aTime = 'market' in a ? a.market.created_at : a.created_at;
        const bTime = 'market' in b ? b.market.created_at : b.created_at;
        return Number(bTime) - Number(aTime);
      });
    case 'pool_asc':
      return sorted.sort((a, b) => {
        const aPool = 'market' in a ? a.market.total_pool : a.total_pool;
        const bPool = 'market' in b ? b.market.total_pool : b.total_pool;
        return Number(aPool) - Number(bPool);
      });
    case 'pool_desc':
      return sorted.sort((a, b) => {
        const aPool = 'market' in a ? a.market.total_pool : a.total_pool;
        const bPool = 'market' in b ? b.market.total_pool : b.total_pool;
        return Number(bPool) - Number(aPool);
      });
    default:
      return sorted;
  }
}

// Helper function to filter markets by category (works with both Market and MarketResult)
function filterByCategory<T extends Market | MarketResult>(markets: T[], selectedCategory: string | null): T[] {
  if (!selectedCategory) return markets;
  
  return markets.filter(market => {
    // Check if the market category matches the selected category
    // MarketCategory is a variant type, so we need to check the key
    const category = 'market' in market ? market.market.category : market.category;
    return selectedCategory in category;
  });
}

// Legacy derived store that returns grouped markets with properties
export const filteredMarkets = derived(marketStore, $marketStore => {
  const { active, expired_unresolved, resolved, selectedCategory, sortOption, statusFilter } = $marketStore;
  
  // Filter by category
  let filteredActive = filterByCategory(active, selectedCategory);
  let filteredExpiredUnresolved = filterByCategory(expired_unresolved, selectedCategory);
  let filteredResolved = filterByCategory(resolved, selectedCategory);
  
  // Sort markets
  filteredActive = sortMarkets(filteredActive, sortOption);
  filteredExpiredUnresolved = sortMarkets(filteredExpiredUnresolved, sortOption);
  filteredResolved = sortMarkets(filteredResolved, sortOption);
  
  // Return grouped structure expected by legacy components
  return {
    active: filteredActive,
    expired_unresolved: filteredExpiredUnresolved,
    resolved: filteredResolved
  };
}); 