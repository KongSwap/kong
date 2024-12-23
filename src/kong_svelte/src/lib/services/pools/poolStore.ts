import { derived, writable, type Readable, get, readable } from 'svelte/store';
import { PoolService } from './PoolService';
import { formatPoolData } from '$lib/utils/statsUtils';
import { tokenStore } from '$lib/services/tokens/tokenStore';
import { auth } from '../auth';
import { eventBus } from '$lib/services/tokens/eventBus';
import { kongDB } from '../db';
import { KONG_CANISTER_ID } from '$lib/constants/canisterConstants';
import { liveQuery } from "dexie";
import { browser } from '$app/environment';

interface ExtendedPool extends BE.Pool {
  displayTvl?: number;
}

interface PoolState {
  pools: ExtendedPool[];
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
const stablePoolsStore = writable<ExtendedPool[]>([]);

// Create a store for the search term and sort parameters
export const poolSearchTerm = writable('');
export const poolSortColumn = writable('rolling_24h_volume');
export const poolSortDirection = writable<'asc' | 'desc'>('desc');

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

  // Remove the in-memory cache object and replace with DB check
  const shouldRefetch = async () => {
    const latestPool = await kongDB.pools
      .orderBy('timestamp')
      .reverse()
      .first();
    return !latestPool || Date.now() - latestPool.timestamp > CACHE_DURATION;
  };

  // Create a derived store for filtered and sorted pools
  const filteredAndSortedPools = derived(
    [stablePoolsStore, poolSearchTerm, poolSortColumn, poolSortDirection],
    ([$pools, $searchTerm, $sortColumn, $sortDirection]) => {
      let result = [...$pools];

      // Apply search filter
      if ($searchTerm) {
        const search = $searchTerm.toLowerCase();
        result = result.filter(pool => {
          return (
            pool.symbol_0.toLowerCase().includes(search) ||
            pool.symbol_1.toLowerCase().includes(search) ||
            `${pool.symbol_0}/${pool.symbol_1}`.toLowerCase().includes(search) ||
            pool.address_0.toLowerCase().includes(search) ||
            pool.address_1.toLowerCase().includes(search)
          );
        });
      }

      // Apply sorting
      const direction = $sortDirection === 'asc' ? 1 : -1;
      result.sort((a, b) => {
        // Always put Kong pools first
        const aHasKong = a.address_0 === KONG_CANISTER_ID || a.address_1 === KONG_CANISTER_ID;
        const bHasKong = b.address_0 === KONG_CANISTER_ID || b.address_1 === KONG_CANISTER_ID;
        
        if (aHasKong && !bHasKong) return -1;
        if (!aHasKong && bHasKong) return 1;

        switch ($sortColumn) {
          case 'rolling_24h_volume': {
            const diff = BigInt(a.rolling_24h_volume) - BigInt(b.rolling_24h_volume);
            return direction * (diff > 0n ? 1 : diff < 0n ? -1 : 0);
          }
          case 'tvl': {
            const diff = BigInt(a.tvl || 0) - BigInt(b.tvl || 0);
            return direction * (diff > 0n ? 1 : diff < 0n ? -1 : 0);
          }
          case 'rolling_24h_apy':
            return direction * (Number(a.rolling_24h_apy) - Number(b.rolling_24h_apy));
          case 'price':
            return direction * (Number(a.price) - Number(b.price));
          default:
            return 0;
        }
      });

      return result;
    }
  );

  const processPoolData = (pool: BE.Pool) => {
    // Add validation and fallback for price
    if (!pool.price || Number(pool.price) === 0) {
      // For ICP pairs, calculate price from amounts
      if (pool.symbol_0 === 'ICP' || pool.symbol_1 === 'ICP') {
        const icpIndex = pool.symbol_0 === 'ICP' ? 0 : 1;
        
        // Add null checks before converting to BigInt
        const amount0 = pool.amount_0;
        const amount1 = pool.amount_1;
        
        if (!amount0 || !amount1) {
          pool.price = 0;
          return pool;
        }
        
        try {
          const icpAmount = BigInt(icpIndex === 0 ? amount0 : amount1);
          const tokenAmount = BigInt(icpIndex === 0 ? amount1 : amount0);
          
          if (icpAmount > 0n && tokenAmount > 0n) {
            const calculatedPrice = Number(icpAmount) / Number(tokenAmount);
            pool.price = calculatedPrice;
          } else {
            pool.price = 0;
          }
        } catch (error) {
          console.error('[PoolStore] Error calculating price:', error);
          pool.price = 0;
        }
      }
    }
    return pool;
  };

  return {
    subscribe,
    filteredAndSortedPools,
    loadPools: async (forceRefresh = false) => {
      // Check DB first if no force refresh
      if (!forceRefresh) {
        const shouldFetch = await shouldRefetch();
        if (!shouldFetch) {
          const cachedPools = await kongDB.pools.toArray();
          if (cachedPools.length > 0) {
            stablePoolsStore.set(cachedPools);
            update(state => ({
              ...state,
              pools: cachedPools,
              isLoading: false
            }));
            return cachedPools;
          }
        }
      }

      update(state => ({ ...state, isLoading: true, error: null }));

      try {
        const poolsData = await PoolService.fetchPoolsData();
        if (!poolsData?.pools) {
          throw new Error('Invalid pools data received');
        }

        // Process pools data with price validation
        const pools = formatPoolData(poolsData.pools).map(processPoolData);

        // Store in DB instead of cache
        await kongDB.transaction('rw', kongDB.pools, async () => {
          // Clear existing pools
          await kongDB.pools.clear();
          // Add new pools
          await kongDB.pools.bulkAdd(pools);
        });

        // Update the stable store
        stablePoolsStore.set(pools);

        // Update the main store
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
      
      console.log('[PoolStore] Loading user pool balances...');
      console.log('[PoolStore] Auth state:', { 
        isConnected: pnp.isConnected, 
        hasAccount: !!pnp.account,
        accountOwner: pnp.account?.owner 
      });

      try {
        if (!pnp.isConnected) {
          update(state => ({
            ...state,
            userPoolBalances: [],
            isLoading: false,
            error: null
          }));
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

        // Update the store with processed balances
        update(state => ({
          ...state,
          userPoolBalances: processedBalances,
          isLoading: false,
          error: null
        }));
      } catch (error) {
        console.error('[PoolStore] Error loading user pool balances:', error);
        update(state => ({
          ...state,
          userPoolBalances: [],
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load pool balances'
        }));
      }
    },
    reset: () => {
      if(browser) {
        kongDB.pools.clear();
      }
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

export const displayPools = derived(poolsList, ($pools) => {
  return $pools.map(pool => ({
    ...pool,
    displayTvl: Number(pool.tvl) / 1e6
  }));
});

// Export the filtered and sorted pools store
export const sortedPools = derived(
  poolStore.filteredAndSortedPools,
  ($pools) => $pools.map(pool => ({
    ...pool,
    tvl: BigInt(pool.tvl),
    rolling_24h_volume: BigInt(pool.rolling_24h_volume),
    displayTvl: Number(pool.tvl) / 1e6,
  }))
);

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
        case 'price':
          return direction * (Number(a.price) - Number(b.price));
        default:
          return 0;
      }
    });

    return result;
  }
);
