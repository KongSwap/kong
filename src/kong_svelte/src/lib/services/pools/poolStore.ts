import { derived, writable, type Readable, get, readable } from 'svelte/store';
import { PoolService } from './PoolService';
import { formatPoolData, getPoolPriceUsd } from '$lib/utils/statsUtils';
import { auth } from '../auth';
import { eventBus } from '$lib/services/tokens/eventBus';
import { kongDB } from '../db';
import { KONG_CANISTER_ID } from '$lib/constants/canisterConstants';
import { liveQuery } from "dexie";
import { browser } from '$app/environment';
import { syncUserPools } from '../tokens/tokenStore';

interface ExtendedPool extends BE.Pool {
  displayTvl?: number;
}

interface PoolState {
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
const stablePoolsStore = writable<ExtendedPool[]>([]);

// Create a store for the search term and sort parameters
export const poolSearchTerm = writable('');
export const poolSortColumn = writable('rolling_24h_volume');
export const poolSortDirection = writable<'asc' | 'desc'>('desc');

function createPoolStore() {
  const { subscribe, set, update } = writable<PoolState>({
    totals: {
      tvl: 0,
      rolling_24h_volume: 0,
      fees_24h: 0,
    },
    isLoading: false,
    error: null,
    lastUpdate: null,
  });

  return {
    subscribe,
    loadPools: async (forceRefresh = false) => {
      update(state => ({ ...state, isLoading: true, error: null }));

      try {
        const poolsData = await PoolService.fetchPoolsData();
        if (!poolsData?.pools) {
          throw new Error('Invalid pools data received');
        }

        // Process pools data with price validation
        const pools = await formatPoolData(poolsData.pools)

        // Store in DB instead of cache
        await kongDB.transaction('rw', kongDB.pools, async () => {
          // Clear existing pools
          await kongDB.pools.clear();
          // Add new pools
          await kongDB.pools.bulkAdd(pools);
        });
        await kongDB.pool_totals.put({
          id: 'current',
          total_tvl: BigInt(poolsData.total_tvl),
          total_24h_volume: BigInt(poolsData.total_24h_volume),
          total_24h_lp_fee: BigInt(poolsData.total_24h_lp_fee),
          total_24h_num_swaps: BigInt(poolsData.total_24h_num_swaps),
          timestamp: Date.now()
        });;

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
      // Check DB first
      const cachedPool = await kongDB.pools.get(poolId);
      if (cachedPool) {
        return cachedPool;
      }

      try {
        const pool = await PoolService.getPoolDetails(poolId);
        // Store in DB
        await kongDB.pools.put(pool);
        // Update the pools array
        return pool;
      } catch (error) {
        console.error('[PoolStore] Error fetching pool:', error);
        throw error;
      }
    },

    loadUserPoolBalances: async () => {
      try {
        if (!auth?.pnp?.isWalletConnected) {
          return;
        }

        const [balancesResponse] = await Promise.all([
          PoolService.fetchUserPoolBalances(),
        ]);

        // Process the response with proper type checking
        const balances = Array.isArray(balancesResponse) ? balancesResponse : 
                        balancesResponse && typeof balancesResponse === 'object' && 'Ok' in balancesResponse ? 
                        (balancesResponse as { Ok: any[] }).Ok : [];
        
        // Process each balance item
        const processedBalances = balances.map(item => {
          const lpData = item.LP || item;
          // Find matching pool to get the pool ID
          const matchingPool = get(poolsList).find(p => 
            p.symbol_0 === lpData.symbol_0 && 
            p.symbol_1 === lpData.symbol_1
          );
          
          return {
            id: matchingPool?.pool_id,
            name: lpData.name,
            symbol: lpData.symbol || `${lpData.symbol_0}/${lpData.symbol_1}`,
            symbol_0: lpData.symbol_0,
            symbol_1: lpData.symbol_1,
            balance: lpData.balance,
            tvl: lpData.tvl,
            price: lpData.price,
            amount_0: lpData.amount_0,
            amount_1: lpData.amount_1,
            usd_balance: lpData.usd_balance,
            usd_amount_0: lpData.usd_amount_0,
            usd_amount_1: lpData.usd_amount_1,
            ts: lpData.ts,
            pool_id: matchingPool?.pool_id
          };
        }).filter(Boolean).filter(balance => Number(balance.balance) > 0);

        await kongDB.user_pools.bulkPut(processedBalances);
      } catch (error) {
        console.error('[PoolStore] Error loading user pool balances:', error);
      }
    },
    reset: () => {
      if(browser) {
        kongDB.pools.clear();
      }
      set({
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
    },

    setSort: (column: string, direction: 'asc' | 'desc') => {
      poolSortColumn.set(column);
      poolSortDirection.set(direction);
    },

    setSearch: (term: string) => {
      poolSearchTerm.set(term);
    },
  };
}

export const poolStore = createPoolStore();

// Use the stable store for pools list to prevent unnecessary re-renders
export const poolsList: Readable<BE.Pool[]> = derived(stablePoolsStore, ($pools, set) => {
  set($pools);
});

// Dexie's liveQuery for livePools
export const livePools = readable<ExtendedPool[]>([], set => {
  // Only run IndexedDB queries in the browser environment
  if (!browser) {
    // Return a no-op unsubscribe function during SSR
    return () => {};
  }

  const subscription = liveQuery(async () => {
    const pools = await kongDB.pools
      .orderBy('timestamp')
      .reverse()
      .toArray();

    if (!pools?.length) {
      return [];
    }

    return pools.map(pool => ({
      ...pool,
      displayTvl: Number(pool.tvl) / 1e6,
    } as ExtendedPool));
  }).subscribe({
    next: value => set(value),
    error: err => console.error('[livePools] Error:', err),
  });

  return () => {
    subscription.unsubscribe();
  };
});

// Derived store for filtered and sorted pools
export const filteredLivePools = derived(
  [livePools, poolSearchTerm, poolSortColumn, poolSortDirection],
  ([$livePools, $poolSearchTerm, $poolSortColumn, $poolSortDirection]) => {
    let result = [...$livePools];

    // 1. Filter by search term
    if ($poolSearchTerm) {
      const search = $poolSearchTerm.toLowerCase();
      result = result.filter((pool) => {
        return (
          pool.symbol_0.toLowerCase().includes(search) ||
          pool.symbol_1.toLowerCase().includes(search) ||
          `${pool.symbol_0}/${pool.symbol_1}`.toLowerCase().includes(search) ||
          pool.address_0.toLowerCase().includes(search) ||
          pool.address_1.toLowerCase().includes(search)
        );
      });
    }

    // 2. Sort
    const direction = $poolSortDirection === 'asc' ? 1 : -1;
    result.sort((a, b) => {
      // Always put Kong pools first
      const aHasKong =
        a.address_0 === KONG_CANISTER_ID || a.address_1 === KONG_CANISTER_ID;
      const bHasKong =
        b.address_0 === KONG_CANISTER_ID || b.address_1 === KONG_CANISTER_ID;

      if (aHasKong && !bHasKong) return -1;
      if (!aHasKong && bHasKong) return 1;

      switch ($poolSortColumn) {
        case 'pool_name': {
          const nameA = `${a.symbol_0}/${a.symbol_1}`.toLowerCase();
          const nameB = `${b.symbol_0}/${b.symbol_1}`.toLowerCase();
          return direction * nameA.localeCompare(nameB);
        }
        case 'rolling_24h_volume': {
          const diff =
            BigInt(a.rolling_24h_volume) - BigInt(b.rolling_24h_volume);
          return direction * (diff > 0n ? 1 : diff < 0n ? -1 : 0);
        }
        case 'tvl': {
          const diff = BigInt(a.tvl || 0) - BigInt(b.tvl || 0);
          return direction * (diff > 0n ? 1 : diff < 0n ? -1 : 0);
        }
        case 'rolling_24h_apy':
          return (
            direction *
            (Number(a.rolling_24h_apy) - Number(b.rolling_24h_apy))
          );
        case 'price': {
          const priceA = getPoolPriceUsd(a);
          const priceB = getPoolPriceUsd(b);
          return direction * (priceA - priceB);
        }
        default:
          return 0;
      }
    });

    return result;
  }
);

export const livePoolTotals = readable<FE.PoolTotal[]>([], set => {
  if (!browser) {
    set([]);
    return;
  }

  const subscription = liveQuery(async () => {
    const totals = await kongDB.pool_totals.toArray();
    if (!totals?.length) {
      return [{
        id: 'current',
        total_tvl: BigInt(0),
        total_24h_volume: BigInt(0),
        total_24h_lp_fee: BigInt(0),
        total_24h_num_swaps: BigInt(0),
        timestamp: Date.now()
      }];
    }
    return totals;
  }).subscribe({
    next: value => {
      set(value);
    },
    error: err => console.error('[livePoolTotals] Error:', err),
  });

  return () => {
    if (subscription) subscription.unsubscribe();
  };
});

export const liveUserPools = readable<FE.UserPoolBalance[]>([], set => {
  if (!browser) {
    set([]);
    return;
  }

  const subscription = liveQuery(async () => {
    const pools = await kongDB.user_pools.toArray();
    return pools;
  }).subscribe({
    next: value => set(value),
    error: err => console.error('[liveUserPools] Error:', err),
  });

  return () => {
    if (subscription) subscription.unsubscribe();
  };
});

// Subscribe to liveUserPools and sync with tokenStore
if (browser) {
  liveUserPools.subscribe(pools => {
    syncUserPools(pools);
  });
}
