import { derived, writable, type Readable, readable } from "svelte/store";
import { PoolService } from "./PoolService";
import { formatPoolData, getPoolPriceUsd } from "$lib/utils/statsUtils";
import { eventBus } from "$lib/services/tokens/eventBus";
import { kongDB } from "../db";
import { KONG_CANISTER_ID } from "$lib/constants/canisterConstants";
import { liveQuery } from "dexie";
import { browser } from "$app/environment";

interface ExtendedPool extends BE.Pool {
  displayTvl?: number;
}

// Create a stable reference for pools data
const stablePoolsStore = writable<ExtendedPool[]>([]);

// Create a store for the search term and sort parameters
export const poolSearchTerm = writable("");
export const poolSortColumn = writable("rolling_24h_volume");
export const poolSortDirection = writable<"asc" | "desc">("desc");

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
    const direction = $poolSortDirection === "asc" ? 1 : -1;
    result.sort((a, b) => {
      // Always put Kong pools first
      const aHasKong =
        a.address_0 === KONG_CANISTER_ID || a.address_1 === KONG_CANISTER_ID;
      const bHasKong =
        b.address_0 === KONG_CANISTER_ID || b.address_1 === KONG_CANISTER_ID;

      if (aHasKong && !bHasKong) return -1;
      if (!aHasKong && bHasKong) return 1;

      switch ($poolSortColumn) {
        case "pool_name": {
          const nameA = `${a.symbol_0}/${a.symbol_1}`.toLowerCase();
          const nameB = `${b.symbol_0}/${b.symbol_1}`.toLowerCase();
          return direction * nameA.localeCompare(nameB);
        }
        case "rolling_24h_volume": {
          const diff =
            BigInt(a.rolling_24h_volume) - BigInt(b.rolling_24h_volume);
          return direction * (diff > 0n ? 1 : diff < 0n ? -1 : 0);
        }
        case "tvl": {
          const diff = BigInt(a.tvl || 0) - BigInt(b.tvl || 0);
          return direction * (diff > 0n ? 1 : diff < 0n ? -1 : 0);
        }
        case "rolling_24h_apy":
          return (
            direction * (Number(a.rolling_24h_apy) - Number(b.rolling_24h_apy))
          );
        case "price": {
          const priceA = getPoolPriceUsd(a);
          const priceB = getPoolPriceUsd(b);
          return direction * (priceA - priceB);
        }
        default:
          return 0;
      }
    });

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

export const liveUserPools = readable<UserPoolBalance[]>([], (set) => {
  if (!browser) {
    set([]);
    return;
  }

  const subscription = liveQuery(async () => {
    const pools = await kongDB.user_pools.toArray();
    return pools;
  }).subscribe({
    next: (value) => set(value),
    error: (err) => console.error("[liveUserPools] Error:", err),
  });

  return () => {
    if (subscription) subscription.unsubscribe();
  };
});

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
