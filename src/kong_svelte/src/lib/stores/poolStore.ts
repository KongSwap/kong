import { derived, writable, type Readable, readable } from "svelte/store";
import { formatPoolData } from "$lib/utils/statsUtils";
import { browser } from "$app/environment";
import { fetchPools } from "$lib/api/pools";

interface ExtendedPool extends BE.Pool {
  displayTvl?: number;
}

// Create a store for pools data
const poolsStore = writable<ExtendedPool[]>([]);

// Create a store for the search term
export const poolSearchTerm = writable("");

// Create a store for loading state
export const isLoadingPools = writable(false);

// Create a store for error state
export const poolsError = writable<string | null>(null);

// Create a store for last update timestamp
export const lastPoolsUpdate = writable<number>(0);

// Add a flag to track if a fetch is in progress
let fetchInProgress = false;

// Add a cache for pool data
const poolCache: Record<string, { timestamp: number, pools: BE.Pool[] }> = {};
const CACHE_EXPIRATION = 5 * 60 * 1000; // 5 minutes

// Use the poolsStore for pools list
export const poolsList: Readable<BE.Pool[]> = derived(
  poolsStore,
  ($pools, set) => {
    set($pools);
  },
);

// Create a readable store that automatically refreshes pools data
export const livePools = readable<ExtendedPool[]>([], (set) => {
  // Only run in the browser environment
  if (!browser) {
    // Return a no-op unsubscribe function during SSR
    return () => {};
  }

  // Initial load
  loadPools().catch(err => console.error("[livePools] Initial load error:", err));

  // Set up interval for periodic refresh (every 60 seconds)
  const intervalId = setInterval(() => {
    loadPools().catch(err => console.error("[livePools] Refresh error:", err));
  }, 60000);

  // Subscribe to the poolsStore to update the livePools store
  const unsubscribe = poolsStore.subscribe(pools => {
    set(pools);
  });

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
    unsubscribe();
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

export const liveUserPools = writable<ExtendedPool[]>([]);

// Add a function to fetch pools for a specific canister with caching
export const fetchPoolsForCanister = async (canisterId: string): Promise<BE.Pool[]> => {
  if (!canisterId) return [];
  
  // Check cache first
  const now = Date.now();
  const cacheKey = `canister_${canisterId}`;
  const cacheEntry = poolCache[cacheKey];
  
  if (cacheEntry && (now - cacheEntry.timestamp < CACHE_EXPIRATION)) {
    return cacheEntry.pools;
  }
  
  try {    
    // Use the fetchPools API function directly
    const result = await fetchPools({
      canisterIds: [canisterId],
      limit: 100
    });
    
    if (result?.pools) {
      // Update cache
      poolCache[cacheKey] = {
        timestamp: now,
        pools: result.pools
      };
      
      return result.pools;
    }
    
    return [];
  } catch (error) {
    console.error("[PoolStore] Error fetching pools for canister:", error);
    return [];
  }
};

export const loadPools = async () => {
  // Prevent concurrent fetches
  if (fetchInProgress) {
    // Use a local variable to store the current value
    let currentPools: ExtendedPool[] = [];
    poolsStore.subscribe(value => {
      currentPools = value;
    })();
    return currentPools;
  }
  
  // Check if we have a recent cache
  const now = Date.now();
  let lastUpdateValue = 0;
  lastPoolsUpdate.subscribe(value => {
    lastUpdateValue = value;
  })();
  
  if (lastUpdateValue && (now - lastUpdateValue < 30000)) { // 30 seconds cache
    // Use a local variable to store the current value
    let currentPools: ExtendedPool[] = [];
    poolsStore.subscribe(value => {
      currentPools = value;
    })();
    return currentPools;
  }
  
  try {
    fetchInProgress = true;
    isLoadingPools.set(true);
    poolsError.set(null);
    let page = 1;
    let allPools: BE.Pool[] = [];
    
    // Initial request to get total pages
    const initialResponse = await fetchPools({ limit: 100, page });
    
    if (!initialResponse?.pools) {
      throw new Error("Invalid pools data received");
    }
    
    // Add first page of pools
    allPools = [...initialResponse.pools];
    
    // Get total pages from response
    const totalPages = initialResponse.total_pages || 1;
    
    // Fetch remaining pages if any
    for (let currentPage = 2; currentPage <= totalPages; currentPage++) {
      const pageResponse = await fetchPools({ limit: 100, page: currentPage });
      
      if (pageResponse?.pools) {
        allPools = [...allPools, ...pageResponse.pools];
      }
    }

    // Process pools data with price validation
    const pools = await formatPoolData(allPools);

    // Transform pools to include displayTvl
    const transformedPools = pools.map(pool => ({
      ...pool,
      displayTvl: Number(pool.tvl) / 1e6,
    })) as ExtendedPool[];

    // Update the store
    poolsStore.set(transformedPools);
    
    // Update last update timestamp
    lastPoolsUpdate.set(Date.now());
    
    return transformedPools;
  } catch (error) {
    console.error("[PoolStore] Error loading pools:", error);
    poolsError.set(error instanceof Error ? error.message : "Unknown error");
    throw error;
  } finally {
    fetchInProgress = false;
    isLoadingPools.set(false);
  }
};
