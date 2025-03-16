import { writable, derived } from 'svelte/store';
import type { Market, MarketsByStatus, MarketCategory, MarketResult } from '$lib/types/predictionMarket';
import { getAllMarkets, getAllCategories } from '$lib/api/predictionMarket';
import { toastStore } from './toastStore';

interface MarketState {
  marketsByStatus: MarketsByStatus;
  categories: string[];
  selectedCategory: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: MarketState = {
  marketsByStatus: { active: [], resolved: [], expired_unresolved: [] },
  categories: ['All'],
  selectedCategory: null,
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
        const [allMarketsResult, categoriesResult] = await Promise.all([
          getAllMarkets(),
          getAllCategories()
        ]);

        const nowNs = BigInt(Date.now()) * BigInt(1_000_000);
        
        // Extract markets array from the result
        const markets = allMarketsResult.markets || [];

        update(state => ({
          ...state,
          categories: ['All', ...categoriesResult],
          marketsByStatus: {
            active: markets.filter(
              market => 'Open' in market.status && BigInt(market.end_time) > nowNs
            ),
            expired_unresolved: markets.filter(
              market => 'Open' in market.status && BigInt(market.end_time) <= nowNs
            ),
            resolved: markets.filter(
              market => 'Closed' in market.status
            )
          },
          loading: false,
          error: null
        }));
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

    // Refresh markets
    async refreshMarkets() {
      try {
        const allMarketsResult = await getAllMarkets();
        const nowNs = BigInt(Date.now()) * BigInt(1_000_000);
        
        // Extract markets array from the result
        const markets = allMarketsResult.markets || [];

        update(state => ({
          ...state,
          marketsByStatus: {
            active: markets.filter(
              market => 'Open' in market.status && BigInt(market.end_time) > nowNs
            ),
            expired_unresolved: markets.filter(
              market => 'Open' in market.status && BigInt(market.end_time) <= nowNs
            ),
            resolved: markets.filter(
              market => 'Closed' in market.status
            )
          }
        }));
      } catch (error) {
        console.error('Failed to refresh markets:', error);
        toastStore.add({
          title: "Error",
          message: "Failed to refresh markets",
          type: "error"
        });
      }
    },

    // Reset store
    reset() {
      set(initialState);
    }
  };
}

export const marketStore = createMarketStore();

// Derived store for filtered markets based on selected category
export const filteredMarkets = derived(
  marketStore,
  ($marketStore) => {
    const { marketsByStatus, selectedCategory } = $marketStore;
    
    if (!selectedCategory) return marketsByStatus;

    const filterByCategory = (item: Market | MarketResult) => {
      const market = 'market' in item ? item.market : item;
      const categoryKey = Object.keys(market.category)[0];
      return categoryKey === selectedCategory;
    };

    return {
      active: marketsByStatus.active.filter(filterByCategory),
      expired_unresolved: marketsByStatus.expired_unresolved.filter(filterByCategory),
      resolved: marketsByStatus.resolved.filter(filterByCategory)
    };
  }
); 