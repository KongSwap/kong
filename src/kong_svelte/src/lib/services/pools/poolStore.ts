import { derived, writable, type Readable } from 'svelte/store';
import { PoolService } from './PoolService';
import { formatPoolData } from '$lib/utils/statsUtils';
import { tokenStore } from '$lib/services/tokens/tokenStore';
import BigNumber from 'bignumber.js';
import { get } from 'svelte/store';
import { auth } from '../auth';
import { eventBus } from '$lib/services/tokens/eventBus';

interface PoolState {
  pools: BE.Pool[];
  userPoolBalances: FE.UserPoolBalance[];
  totals: {
    tvl: number;
    rolling_24h_volume: number;
    fees_24h: number;
  };
  isLoading: boolean;
  error: string | null;
  lastUpdate: number | null;
}

// Create a stable reference for pools data
const stablePoolsStore = writable<BE.Pool[]>([]);

function createPoolStore() {
  const CACHE_DURATION = 1000 * 60; // 30 second cache
  const { subscribe, set, update } = writable<PoolState>({
    pools: [],
    userPoolBalances: [],
    totals: {
      tvl: 0,
      rolling_24h_volume: 0,
      fees_24h: 0,
    },
    isLoading: false,
    error: null,
    lastUpdate: null,
  });

  // Cache management
  const cache = {
    pools: new Map<string, BE.Pool>(),
    lastFetch: 0
  };

  const shouldRefetch = () => {
    return Date.now() - cache.lastFetch > CACHE_DURATION;
  };

  return {
    subscribe,
    loadPools: async (forceRefresh = false) => {
      // Determine if we should fetch new data
      if (!forceRefresh && !shouldRefetch() && cache.pools.size > 0) {
        return Array.from(cache.pools.values());
      }

      update(state => ({ ...state, isLoading: true, error: null }));

      try {
        const poolsData = await PoolService.fetchPoolsData();
        if (!poolsData?.pools) {
          throw new Error('Invalid pools data received');
        }

        // Process pools data
        const pools = formatPoolData(poolsData.pools);

        // Update cache
        const newPoolsMap = new Map<string, BE.Pool>();
        pools.forEach(pool => {
          newPoolsMap.set(pool.id, pool);
        });

        // Update the stable store first
        stablePoolsStore.set(pools);

        // Then update the main store
        set({
          pools: pools,
          userPoolBalances: get(poolStore).userPoolBalances,
          totals: {
            tvl: Number(poolsData.total_tvl) / 1e6,
            rolling_24h_volume: Number(poolsData.total_24h_volume) / 1e6,
            fees_24h: Number(poolsData.total_24h_lp_fee) / 1e6
          },
          isLoading: false,
          error: null,
          lastUpdate: Date.now()
        });

        // Update cache
        cache.pools = newPoolsMap;
        cache.lastFetch = Date.now();
        console.log('[PoolStore] Pools data updated successfully');

        // Emit event for token store to update if needed
        eventBus.emit('poolsUpdated', pools);

        return pools;
      } catch (error) {
        console.error('[PoolStore] Error loading pools:', error);
        update(state => ({
          ...state,
          error: error instanceof Error ? error.message : 'Unknown error',
          isLoading: false
        }));
        throw error;
      }
    },

    getPool: async (poolId: string) => {
      // Check cache first
      if (cache.pools.has(poolId)) {
        return cache.pools.get(poolId);
      }

      try {
        const pool = await PoolService.getPoolDetails(poolId);
        cache.pools.set(poolId, pool);
        // Optionally, update the pools array if necessary
        update(state => ({
          ...state,
          pools: [...state.pools.filter(p => p.id !== poolId), pool]
        }));
        return pool;
      } catch (error) {
        console.error('[PoolStore] Error fetching pool:', error);
        throw error;
      }
    },

    loadUserPoolBalances: async () => {
      update(state => ({ ...state, isLoading: true, error: null }));
      const pnp = get(auth);
      const tokens = get(tokenStore);
      try {
        const [balances, tokenPrices] = await Promise.all([
          pnp.isConnected ? PoolService.fetchUserPoolBalances() : [],
          tokens.prices
        ]);

        if (!tokenPrices) {
          throw new Error('Token prices are not available');
        }

        // Update the store with processed balances
        update(state => ({
          ...state,
          userPoolBalances: balances || [],
          isLoading: false,
          error: null
        }));
      } catch (error) {
        console.error('Error loading user pool balances:', error);
        update(state => ({
          ...state,
          userPoolBalances: [],
          isLoading: false,
          error: 'Failed to load pool balances'
        }));
      }
    },

    reset: () => {
      cache.pools.clear();
      cache.lastFetch = 0;
      set({
        pools: [],
        userPoolBalances: [],
        totals: {
          tvl: 0,
          rolling_24h_volume: 0,
          fees_24h: 0,
        },
        isLoading: false,
        error: null,
        lastUpdate: null,
      });
      console.log('[PoolStore] Reset successful');
    }
  };
}

export const poolStore = createPoolStore();

// Derived stores with debug logging
export const poolTotals: Readable<{ tvl: number; rolling_24h_volume: number; fees_24h: number }> = derived(poolStore, ($store, set) => {
  set($store.totals);
});

// Use the stable store for pools list to prevent unnecessary re-renders
export const poolsList: Readable<BE.Pool[]> = derived(stablePoolsStore, ($pools, set) => {
  set($pools);
});

export const poolsLoading: Readable<boolean> = derived(poolStore, $store => $store.isLoading);

export const poolsError: Readable<string | null> = derived(poolStore, $store => $store.error);

// Derived store for user pool balances
export const userPoolBalances: Readable<FE.UserPoolBalance[]> = derived(
  poolStore,
  ($store) => $store.userPoolBalances
);
