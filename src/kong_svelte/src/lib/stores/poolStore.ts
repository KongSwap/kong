import { derived, writable, type Readable } from 'svelte/store';
import { PoolService } from '$lib/services/PoolService';
import { formatPoolData } from '$lib/utils/statsUtils';

interface PoolState {
  pools: BE.Pool[];
  totals: {
    tvl: number;
    rolling_24h_volume: number;
    fees_24h: number;
  };
  isLoading: boolean;
  error: string | null;
  lastUpdate: number | null;
}

function createPoolStore() {
  const { subscribe, set, update } = writable<PoolState>({
    pools: [],
    totals: {
      tvl: 0,
      rolling_24h_volume: 0,
      fees_24h: 0
    },
    isLoading: false,
    error: null,
    lastUpdate: null
  });

  return {
    subscribe,
    loadPools: async () => {
      update(state => {
        return { ...state, isLoading: true, error: null };
      });
      
      try {
        const poolsData = await PoolService.fetchPoolsData();        
        if (!poolsData?.pools) {
          throw new Error('Invalid pools data received');
        }

        const formattedPools = formatPoolData(poolsData.pools);
        
        update(state => {
          const newState = {
            ...state,
            pools: formattedPools,
            totals: {
              tvl: Number(poolsData.total_tvl) / 1e6,
              rolling_24h_volume: Number(poolsData.total_24h_volume) / 1e6,
              fees_24h: Number(poolsData.total_24h_lp_fee) / 1e6
            },
            isLoading: false,
            lastUpdate: Date.now()
          };
          return newState;
        });
      } catch (error) {
        console.error('[PoolStore] Error:', error);
        update(state => ({
          ...state,
          error: error.message,
          isLoading: false
        }));
      }
    },

    getPool: async (poolId: string) => {
      try {
        return await PoolService.getPoolDetails(poolId);
      } catch (error) {
        console.error('[PoolStore] Error fetching pool:', error);
        throw error;
      }
    },

    reset: () => {
      set({
        pools: [],
        totals: {
          tvl: 0,
          rolling_24h_volume: 0,
          fees_24h: 0
        },
        isLoading: false,
        error: null,
        lastUpdate: null
      });
    }
  };
}

export const poolStore = createPoolStore();

// Derived stores with debug logging
export const poolTotals: Readable<{ tvl: number; rolling_24h_volume: number; fees_24h: number }> = derived(poolStore, ($store, set) => {
  set($store.totals);
});

export const poolsList: Readable<BE.Pool[]> = derived(poolStore, ($store, set) => {
  set($store.pools);
});

export const poolsLoading: Readable<boolean> = derived(poolStore, $store => $store.isLoading);
export const poolsError: Readable<string | null> = derived(poolStore, $store => $store.error);
