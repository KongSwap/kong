import { derived, writable, type Readable, readable } from "svelte/store";
import { PoolService } from "./PoolService";
import { formatPoolData } from "$lib/utils/statsUtils";
import { eventBus } from "$lib/services/tokens/eventBus";
import { kongDB } from "../db";
import { liveQuery } from "dexie";
import { browser } from "$app/environment";

interface ExtendedPool extends BE.Pool {
  displayTvl?: number;
}

// Create a stable reference for pools data
const stablePoolsStore = writable<ExtendedPool[]>([]);

// Create a store for the search term
export const poolSearchTerm = writable("");

// Use the stable store for pools list to prevent unnecessary re-renders
export const poolsList: Readable<BE.Pool[]> = derived(
  stablePoolsStore,
  ($pools, set) => {
    set($pools);
  },
);

// Dexie's liveQuery for livePools
export const livePools = readable<ExtendedPool[]>([], (set) => {
  // Only run IndexedDB queries in the browser environment
  if (!browser) {
    // Return a no-op unsubscribe function during SSR
    return () => {};
  }

  const subscription = liveQuery(async () => {
    const pools = await kongDB.pools.orderBy("timestamp").reverse().toArray();

    if (!pools?.length) {
      return [];
    }

    return pools.map(
      (pool) =>
        ({
          ...pool,
          displayTvl: Number(pool.tvl) / 1e6,
        }) as ExtendedPool,
    );
  }).subscribe({
    next: (value) => set(value),
    error: (err) => console.error("[livePools] Error:", err),
  });

  return () => {
    subscription.unsubscribe();
  };
});

// Derived store for filtered pools
export const filteredLivePools = derived(
  [livePools, poolSearchTerm],
  ([$livePools, $poolSearchTerm]) => {
    let result = [...$livePools];

    // Filter by search term
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

    return result;
  },
);

export const livePoolTotals = readable<FE.PoolTotal[]>([], (set) => {
  if (!browser) {
    set([]);
    return;
  }

  const subscription = liveQuery(async () => {
    const totals = await kongDB.pool_totals.toArray();
    if (!totals?.length) {
      return [
        {
          id: "current",
          total_tvl: BigInt(0),
          total_24h_volume: BigInt(0),
          total_24h_lp_fee: BigInt(0),
          total_24h_num_swaps: BigInt(0),
          timestamp: Date.now(),
        },
      ];
    }
    return totals;
  }).subscribe({
    next: (value) => {
      set(value);
    },
    error: (err) => console.error("[livePoolTotals] Error:", err),
  });

  return () => {
    if (subscription) subscription.unsubscribe();
  };
});

export const liveUserPools = writable<ProcessedPool[]>([]);

export const loadPools = async () => {
  try {
    const poolsData = await PoolService.fetchPoolsData();
    if (!poolsData?.pools) {
      throw new Error("Invalid pools data received");
    }

    // Process pools data with price validation
    const pools = await formatPoolData(poolsData.pools);

    // Store in DB instead of cache
    await kongDB.transaction("rw", [kongDB.pools, kongDB.pool_totals], async () => {
      await kongDB.pools.bulkPut(pools);
      await kongDB.pool_totals.put({
        id: "current",
        total_tvl: BigInt(poolsData.total_tvl),
        total_24h_volume: BigInt(poolsData.total_24h_volume),
        total_24h_lp_fee: BigInt(poolsData.total_24h_lp_fee),
        total_24h_num_swaps: BigInt(poolsData.total_24h_num_swaps),
        timestamp: Date.now(),
      });
    });

    eventBus.emit("poolsUpdated", pools);
    return pools;
  } catch (error) {
    console.error("[PoolStore] Error loading pools:", error);
    throw error;
  }
};
