import { derived, writable } from 'svelte/store';
import { PoolService } from '$lib/services/PoolService';
import { formatPoolData } from '$lib/utils/statsUtils';

interface PoolState {
  pools: BE.Pool[];
  totals: {
    tvl: number;
    volume24h: number;
    fees24h: number;
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
      volume24h: 0,
      fees24h: 0
    },
    isLoading: false,
    error: null,
    lastUpdate: null
  });

  // Add debug logging
  const logState = (state: PoolState, action: string) => {
    console.log(`[PoolStore ${action}]`, {
      poolsCount: state.pools.length,
      totals: state.totals,
      isLoading: state.isLoading,
      error: state.error
    });
  };

  return {
    subscribe,
    
    loadPools: async () => {
      update(state => {
        logState(state, 'Loading Start');
        return { ...state, isLoading: true, error: null };
      });
      
      try {
        const poolsData = await PoolService.fetchPoolsData();
        console.log('[PoolStore] Raw pools data:', poolsData);
        
        if (!poolsData?.pools) {
          throw new Error('Invalid pools data received');
        }

        const formattedPools = formatPoolData(poolsData.pools);
        console.log('[PoolStore] Formatted pools:', formattedPools);
        
        update(state => {
          const newState = {
            ...state,
            pools: formattedPools,
            totals: {
              tvl: Number(poolsData.total_tvl) / 1e6,
              volume24h: Number(poolsData.total_24h_volume) / 1e6,
              fees24h: Number(poolsData.total_24h_lp_fee) / 1e6
            },
            isLoading: false,
            lastUpdate: Date.now()
          };
          logState(newState, 'Update Complete');
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
          volume24h: 0,
          fees24h: 0
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
export const poolsTotals = derived(poolStore, ($store, set) => {
  console.log('[PoolStore] Derived totals:', $store.totals);
  set($store.totals);
});

export const poolsList = derived(poolStore, ($store, set) => {
  console.log('[PoolStore] Derived pools list:', $store.pools);
  set($store.pools);
});

export const poolsLoading = derived(poolStore, $store => $store.isLoading);
export const poolsError = derived(poolStore, $store => $store.error);