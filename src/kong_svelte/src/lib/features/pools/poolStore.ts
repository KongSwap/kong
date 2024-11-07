import { derived, writable, type Readable } from 'svelte/store';
import { PoolService } from './PoolService';
import { formatPoolData } from '$lib/utils/statsUtils';
import { tokenStore } from '$lib/features/tokens/tokenStore';
import BigNumber from 'bignumber.js';
import { UserPoolBalanceSchema } from './poolSchema';

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

function createPoolStore() {
  const CACHE_DURATION = 1000 * 60 * 1; // 1 minute cache
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
      // Return cached data if available and fresh
      if (!forceRefresh && !shouldRefetch() && cache.pools.size > 0) {
        return Array.from(cache.pools.values());
      }

      update(state => ({ ...state, isLoading: true, error: null }));
      
      try {
        // Load pools incrementally
        const poolsData = await PoolService.fetchPoolsData();
        if (!poolsData?.pools) {
          throw new Error('Invalid pools data received');
        }

        // Process pools in chunks
        const CHUNK_SIZE = 10;
        const pools = poolsData.pools;
        
        for (let i = 0; i < pools.length; i += CHUNK_SIZE) {
          const chunk = pools.slice(i, i + CHUNK_SIZE);
          const formattedChunk = formatPoolData(chunk);
          
          // Update store with each chunk
          update(state => ({
            ...state,
            pools: [...state.pools, ...formattedChunk],
          }));

          // Update cache
          formattedChunk.forEach(pool => {
            cache.pools.set(pool.id, pool);
          });

          // Small delay to prevent UI blocking
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        // Update totals and finish loading
        update(state => ({
          ...state,
          totals: {
            tvl: Number(poolsData.total_tvl) / 1e6,
            rolling_24h_volume: Number(poolsData.total_24h_volume) / 1e6,
            fees_24h: Number(poolsData.total_24h_lp_fee) / 1e6
          },
          isLoading: false,
          lastUpdate: Date.now()
        }));

        cache.lastFetch = Date.now();

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
      // Check cache first
      if (cache.pools.has(poolId)) {
        return cache.pools.get(poolId);
      }

      try {
        const pool = await PoolService.getPoolDetails(poolId);
        cache.pools.set(poolId, pool);
        return pool;
      } catch (error) {
        console.error('[PoolStore] Error fetching pool:', error);
        throw error;
      }
    },

    loadUserPoolBalances: async () => {
      update(state => ({ ...state, isLoading: true, error: null }));

      try {
        const [balances, tokenPrices] = await Promise.all([
          PoolService.fetchUserPoolBalances(),
          tokenStore.getTokenPrices()
        ]);

        if (!tokenPrices) {
          throw new Error('Token prices are not available');
        }

        // Process balances in chunks
        const CHUNK_SIZE = 5;
        const processedBalances: FE.UserPoolBalance[] = [];

        for (let i = 0; i < balances.length; i += CHUNK_SIZE) {
          const chunk = balances.slice(i, i + CHUNK_SIZE);
          
          const processedChunk = chunk
            .map(item => {
              const key = Object.keys(item)[0];
              const token = item[key];
              const poolPrice = tokenPrices[`${token.symbol_0}_${token.symbol_1}`] || 
                              tokenPrices[`${token.symbol_1}_${token.symbol_0}`];

              return {
                name: `${token.symbol_0}/${token.symbol_1}`,
                balance: new BigNumber(token.balance).toFormat(8),
                amount_0: token.amount_0,
                amount_1: token.amount_1,
                symbol_0: token.symbol_0,
                symbol_1: token.symbol_1,
                ...item
              };
            })
            .filter(Boolean);

          processedBalances.push(...processedChunk);

          // Update store incrementally
          update(state => ({
            ...state,
            userPoolBalances: processedBalances,
          }));

          // Prevent UI blocking
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        update(state => ({
          ...state,
          isLoading: false,
          lastUpdate: Date.now(),
        }));

      } catch (error) {
        console.error('[PoolStore] Error loading user pool balances:', error);
        update(state => ({
          ...state,
          error: error.message,
          isLoading: false,
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

// Derived store for user pool balances
export const userPoolBalances: Readable<FE.UserPoolBalance[]> = derived(
  poolStore,
  ($store) => $store.userPoolBalances
);
