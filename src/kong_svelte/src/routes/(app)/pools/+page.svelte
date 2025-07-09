<script lang="ts">
  /**
   * Pools Page Component
   * 
   * Displays all liquidity pools with filtering, sorting, and pagination.
   * Features:
   * - All pools view with real-time data
   * - User pools view showing connected wallet's positions
   * - Search functionality
   * - Sorting by TVL, volume, APY, price
   * - Mobile infinite scroll / Desktop pagination
   * - URL state synchronization
   */
  
  import { writable, derived } from "svelte/store";
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { Droplets } from "lucide-svelte";
  import { auth } from "$lib/stores/auth";
  import { browser } from "$app/environment";
  import { KONG_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { fetchPools, fetchPoolTotals, fetchPoolsByLpTokenIds } from "$lib/api/pools";
  import { fetchTokens } from "$lib/api/tokens/TokenApiClient";
  import { page } from "$app/stores";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
  import { calculateUserPoolPercentage } from "$lib/utils/liquidityUtils";
  import { fade } from "svelte/transition";
  import { panelRoundness } from "$lib/stores/derivedThemeStore";
  import { app } from "$lib/state/app.state.svelte";
  
  // Components
  import PoolCard from "$lib/components/liquidity/pools/PoolCard.svelte";
  import PoolsHeader from "$lib/components/liquidity/pools/PoolsHeader.svelte";
  import PoolsToolbar from "$lib/components/liquidity/pools/PoolsToolbar.svelte";
  import PoolsEmptyState from "$lib/components/liquidity/pools/PoolsEmptyState.svelte";
  import PoolsPagination from "$lib/components/liquidity/pools/PoolsPagination.svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { getPoolPriceUsd } from "$lib/utils/statsUtils";

  // ===== State Management =====
  // UI State
  const activePoolView = writable("all");
  const sortColumn = writable("tvl");
  const sortDirection = writable<"asc" | "desc">("desc");
  const isLoading = writable(false);
  let isMobile = $state(app.isMobile);
  
  // Data State
  const allPools = writable<BE.Pool[]>([]);
  const userPoolsData = writable<BE.Pool[]>([]);
  const allTokens = writable([]);
  const poolTotals = writable({
    total_volume_24h: 0,
    total_tvl: 0,
    total_fees_24h: 0,
  });

  // Pagination State (for all pools)
  const totalPages = writable(0);
  const currentPage = writable(1);
  const itemsPerPage = 48;
  let mobilePage = 1;
  let isMobileFetching = $state(false);

  // Search State
  let searchInput = $state("");
  let searchDebounceTimer: NodeJS.Timeout;

  // User Pools State
  let isLoadingUserPools = $state(false);
  
  // Store initialization state globally to prevent re-initialization
  let hasInitializedUserPools = $state(false);
  
  // Track if we've loaded data for the current URL
  let lastLoadedUrl = "";

  // ===== Derived Stores =====
  const tokenMap = derived(
    allTokens,
    ($tokens) => new Map($tokens?.map((token) => [token.address, token]) || []),
  );

  // Sorted pools for "all pools" view
  const sortedAllPools = derived(
    [allPools, sortColumn, sortDirection],
    ([$pools, $column, $direction]) => {
      const sorted = [...$pools].sort((a, b) => {
        // KONG pools always first
        if (
          a.address_0 === KONG_CANISTER_ID ||
          a.address_1 === KONG_CANISTER_ID
        )
          return -1;
        if (
          b.address_0 === KONG_CANISTER_ID ||
          b.address_1 === KONG_CANISTER_ID
        )
          return 1;

        const getValue = (pool) => {
          switch ($column) {
            case "price":
              return Number(getPoolPriceUsd(pool));
            case "tvl":
              return Number(pool.tvl);
            case "rolling_24h_volume":
              return Number(pool.rolling_24h_volume);
            case "rolling_24h_apy":
              return Number(pool.rolling_24h_apy);
            default:
              return Number(pool.rolling_24h_volume);
          }
        };

        const diff = getValue(a) - getValue(b);
        return $direction === "asc" ? diff : -diff;
      });
      return sorted;
    },
  );

  // Enhanced user pools with details from currentUserPoolsStore and live pool data
  const userPoolsWithDetails = derived(
    [currentUserPoolsStore, userPoolsData, sortColumn, sortDirection],
    ([$store, $poolsData, $column, $direction]) => {
      const pools = $store.filteredPools.map((userPool) => {
        const livePool = $poolsData.find(
          (p) =>
            p.address_0 === userPool.address_0 && p.address_1 === userPool.address_1,
        );

        // Calculate share percentage
        let sharePercentage = "0";
        if (livePool && (livePool.balance_0 > 0n || livePool.balance_1 > 0n)) {
          sharePercentage = calculateUserPoolPercentage(
            livePool.balance_0,
            livePool.balance_1,
            userPool.amount_0,
            userPool.amount_1,
            livePool.lp_fee_0,
            livePool.lp_fee_1,
          );
        } else if (!livePool || (livePool.balance_0 === 0n && livePool.balance_1 === 0n)) {
          sharePercentage = userPool.amount_0 > 0 || userPool.amount_1 > 0 ? "100" : "0";
        }

        return {
          ...userPool,
          livePool,
          key: `${userPool.address_0}-${userPool.address_1}`,
          sharePercentage,
          apy: formatToNonZeroDecimal(livePool?.rolling_24h_apy || 0),
          usdValue: formatToNonZeroDecimal(userPool.usd_balance),
          formattedAmount0: formatToNonZeroDecimal(userPool.amount_0),
          formattedAmount1: formatToNonZeroDecimal(userPool.amount_1),
        };
      });

      // Sort user pools
      const sortedPools = pools.sort((a, b) => {
        const getValue = (pool) => {
          const livePool = pool.livePool;
          if (!livePool) return 0;
          
          switch ($column) {
            case "price":
              return Number(getPoolPriceUsd(livePool));
            case "tvl":
              return Number(pool.usd_balance);
            case "rolling_24h_volume":
              return Number(livePool.rolling_24h_volume);
            case "rolling_24h_apy":
              return Number(livePool.rolling_24h_apy);
            default:
              return Number(pool.usd_balance);
          }
        };

        const diff = getValue(a) - getValue(b);
        return $direction === "asc" ? diff : -diff;
      });
      
      return sortedPools;
    },
  );

  // ===== Lifecycle =====
  onMount(() => {
    if (!browser) return;
    // Initial data loading is handled by the URL effect
  });

  onDestroy(() => {
    clearTimeout(searchDebounceTimer);
  });

  // ===== Effects =====
  // Initialize user pools when connected (only on initial load)
  $effect(() => {
    if ($auth.isConnected && browser && !hasInitializedUserPools) {
      hasInitializedUserPools = true;
      initializeUserPools();
    }
  });

  // Mobile state sync
  $effect(() => {
    isMobile = app.isMobile;
  });

  // URL-driven data loading for "all pools" view
  $effect(() => {
    if (!browser) return;
    
    const currentUrl = $page.url.toString();
    
    // Skip if we've already loaded data for this exact URL
    if (currentUrl === lastLoadedUrl) {
      return;
    }
    
    const urlParams = new URLSearchParams($page.url.search);
    const urlSearch = urlParams.get("search") || "";
    const urlPage = parseInt(urlParams.get("page") || "1");
    
    // Update reactive state from URL
    searchInput = urlSearch;
    currentPage.set(urlPage);
    
    // Cancel any pending operations to avoid conflicts
    clearTimeout(searchDebounceTimer);
    
    // Mark this URL as being loaded
    lastLoadedUrl = currentUrl;
    
    // Load data
    loadInitialData(urlPage, urlSearch).catch((error) => {
      console.error("Error loading initial data:", error);
      // Reset on error so it can be retried
      lastLoadedUrl = "";
    });
  });

  // ===== Data Loading Functions =====
  async function loadInitialData(page: number = 1, search: string = "") {
    isLoading.set(true);
    try {
      const [poolsResult, totalsResult, tokensResult] = await Promise.all([
        fetchPools({
          page,
          limit: itemsPerPage,
          search,
        }),
        fetchPoolTotals(),
        fetchTokens(),
      ]);

      allPools.set(poolsResult.pools || []);
      totalPages.set(poolsResult.total_pages);
      currentPage.set(poolsResult.page);
      poolTotals.set(totalsResult);
      allTokens.set(tokensResult.tokens);
      mobilePage = 1;
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      isLoading.set(false);
    }
  }

  async function initializeUserPools(loadData = true) {
    if (isLoadingUserPools) return;
    
    isLoadingUserPools = true;
    try {
      await currentUserPoolsStore.initialize();
      // Always load pool data on initialization for accurate count
      // Only skip if explicitly told not to load data
      if (loadData) {
        await loadUserPoolsData();
      }
    } catch (error) {
      console.error("Error initializing user pools:", error);
    } finally {
      isLoadingUserPools = false;
    }
  }

  async function loadUserPoolsData() {
    if ($currentUserPoolsStore.filteredPools.length === 0) {
      userPoolsData.set([]);
      return;
    }

    isLoadingUserPools = true;
    try {
      // Get LP token IDs from user's positions
      const userLpTokenIds = $currentUserPoolsStore.filteredPools
        .map(p => String(p.lp_token_id))
        .filter(id => id && id !== 'undefined');

      if (userLpTokenIds.length > 0) {
        const pools = await fetchPoolsByLpTokenIds(userLpTokenIds);
        userPoolsData.set(pools);
      } else {
        userPoolsData.set([]);
      }
    } catch (error) {
      console.error("Error fetching user pools data:", error);
      userPoolsData.set([]);
    } finally {
      isLoadingUserPools = false;
    }
  }

  async function refreshUserPools() {
    if (!$auth.isConnected) return;
    
    try {
      currentUserPoolsStore.reset();
      await new Promise((resolve) => setTimeout(resolve, 50));
      hasInitializedUserPools = false;
      await initializeUserPools();
    } catch (error) {
      console.error("Error refreshing user pools:", error);
    }
  }

  // ===== Navigation Functions =====
  function handleSearch() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      try {
        const search = searchInput.trim().toLowerCase();
        
        if ($activePoolView === "all") {
          // For all pools, update URL which triggers data loading
          goto(`/pools?search=${encodeURIComponent(search)}&page=1`, {
            keepFocus: true,
            noScroll: true,
            replaceState: true,
          });
        } else {
          // For user pools, just update the store filter
          currentUserPoolsStore.setSearchQuery(search);
          currentUserPoolsStore.updateFilteredPools();
        }
      } catch (error) {
        console.error("Error navigating during search:", error);
      }
    }, 300);
  }

  function handlePageChange(page: number) {
    goto(`/pools?search=${encodeURIComponent(searchInput)}&page=${page}`, {
      keepFocus: true,
      noScroll: true,
      replaceState: false,
    });
  }

  // ===== Mobile Specific Functions =====
  async function handleMobileScroll(event) {
    if (
      !isMobile ||
      $activePoolView !== "all" ||
      isMobileFetching ||
      mobilePage >= $totalPages
    )
      return;

    const { scrollTop, scrollHeight, clientHeight } = event.target;
    if (scrollHeight - (scrollTop + clientHeight) < 100) {
      isMobileFetching = true;
      try {
        const result = await fetchPools({
          page: mobilePage + 1,
          limit: itemsPerPage,
          search: searchInput,
        });
        allPools.update(pools => [...pools, ...(result.pools || [])]);
        mobilePage++;
      } finally {
        isMobileFetching = false;
      }
    }
  }

  // ===== UI Helper Functions =====
  const getHighestAPY = () =>
    Math.max(...($allPools || []).map((p) => Number(p.rolling_24h_apy)), 0);
    
  const isKongPool = (pool) =>
    pool.address_0 === KONG_CANISTER_ID || pool.address_1 === KONG_CANISTER_ID;

  const getUserPoolData = (pool) => {
    if (!$auth.isConnected) return null;
    return $currentUserPoolsStore.filteredPools.find(
      (p) => p.address_0 === pool.address_0 && p.address_1 === pool.address_1
    );
  };

  // ===== Event Handlers =====
  const handleSortDirectionToggle = () => {
    sortDirection.update((d) => (d === "asc" ? "desc" : "asc"));
  };

  const handleViewChange = async (view: string) => {
    activePoolView.set(view);
    
    if (view === "user") {
      // Always ensure user pools are initialized when switching to user view
      if ($auth.isConnected) {
        // Initialize only if truly not initialized yet
        if (!hasInitializedUserPools) {
          hasInitializedUserPools = true;
          await initializeUserPools();
        }
        
        // Wait for any ongoing loading to complete
        let attempts = 0;
        while ($currentUserPoolsStore.loading && attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
      }
      
      // The search state should already be managed by the search input handler
      // No need to update it when switching views
    }
  };

  const handleSearchInputChange = (value: string) => {
    searchInput = value;
    handleSearch();
  };

  const handleSortColumnChange = (column: string) => {
    sortColumn.set(column);
  };
</script>

<svelte:head>
  <title>Liquidity Pools - KongSwap</title>
</svelte:head>

<!-- Pools Header -->
<PoolsHeader />
<section class="flex flex-col w-full px-2 sm:px-4 pb-4 mt-4 max-w-[1600px] mx-auto">
    <div class="overflow-hidden flex flex-col h-full {$panelRoundness}">
      <!-- Toolbar -->
      <PoolsToolbar
        activePoolView={$activePoolView}
        onViewChange={handleViewChange}
        searchInput={searchInput}
        onSearchInput={handleSearchInputChange}
        sortColumn={$sortColumn}
        onSortColumnChange={handleSortColumnChange}
        sortDirection={$sortDirection}
        onSortDirectionToggle={handleSortDirectionToggle}
        userPoolsCount={$userPoolsWithDetails.length}
        isConnected={$auth.isConnected}
        isMobile={isMobile}
        onUserPoolsClick={refreshUserPools}
      />

    <!-- Content -->
      <div class="flex-1 overflow-hidden">
        {#if $activePoolView === "all"}
        <!-- All Pools -->
              <div
          class="h-full overflow-auto {isMobile
            ? 'mobile-pools-container py-2'
            : 'p-4'}"
                onscroll={handleMobileScroll}
              >
          {#if $isLoading}
            <div class="flex flex-col items-center justify-center h-64 gap-4" in:fade={{ duration: 200 }}>
              <div class="relative">
                <Droplets size={40} class="animate-pulse text-kong-primary" />
                <div class="absolute inset-0 animate-spin">
                  <div class="w-12 h-12 border-2 border-kong-primary/20 border-t-kong-primary rounded-full"></div>
                </div>
              </div>
              <p class="text-base font-medium text-kong-text-primary/70">
                {searchInput ? `Searching for "${searchInput}"...` : "Loading pools..."}
              </p>
            </div>
          {:else if $sortedAllPools.length === 0}
            <PoolsEmptyState 
              isUserPool={false} 
              searchInput={searchInput} 
              isConnected={$auth.isConnected} 
            />
          {:else}
            <div
              class={isMobile
                ? "space-y-3 pb-3"
                : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"}
              in:fade={{ duration: 300 }}
            >
              {#each $sortedAllPools as pool (`${pool.address_0}-${pool.address_1}`)}
                {@const userPoolData = getUserPoolData(pool)}
                <PoolCard
                  pool={pool}
                  tokenMap={$tokenMap}
                  userPoolData={userPoolData}
                  isHighlighted={isKongPool(pool)}
                  isMobile={isMobile}
                  isConnected={$auth.isConnected}
                  onClick={() => goto(`/pools/${pool.address_0}_${pool.address_1}`)}
                />
              {/each}
            </div>
          {/if}

          {#if isMobile && isMobileFetching}
            <div class="text-center text-kong-text-secondary py-4">
              <div
                class="inline-block w-5 h-5 border-2 border-kong-primary/20 border-t-kong-primary rounded-full animate-spin mr-2"
              ></div>
              Loading more pools...
            </div>
          {/if}

          {#if !isMobile}
            <PoolsPagination 
              currentPage={$currentPage} 
              totalPages={$totalPages} 
              onPageChange={handlePageChange} 
            />
          {/if}
          </div>
        {:else if $activePoolView === "user"}
        <!-- User Pools -->
          {#if $auth.isConnected}
            <div class="h-full overflow-auto py-4 sm:p-4">
              {#if isLoadingUserPools || ($currentUserPoolsStore.loading && !hasInitializedUserPools) || ($userPoolsData.length === 0 && $currentUserPoolsStore.filteredPools.length > 0)}
                <div
                  class="flex flex-col items-center justify-center h-64 gap-4"
                  in:fade={{ duration: 300 }}
                >
                <Droplets size={32} class="animate-pulse text-kong-primary" />
                  <p class="text-base font-medium text-kong-text-primary/70">
                    Loading your liquidity positions...
                  </p>
                </div>
              {:else if $currentUserPoolsStore.error}
                <div
                  class="flex flex-col items-center justify-center h-64 gap-4 text-kong-error"
                  in:fade={{ duration: 300 }}
                >
                <svg class="w-10 h-10" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  <p class="text-base font-medium">
                    {$currentUserPoolsStore.error}
                  </p>
                  <button
                    class="px-4 py-2 bg-kong-bg-primary/40 text-kong-text-secondary text-xs font-medium rounded-lg transition-all duration-200 hover:bg-kong-bg-primary/60 hover:text-kong-text-primary border border-kong-border/40 hover:border-kong-accent-blue/30 active:scale-[0.98]"
                  onclick={refreshUserPools}
                  >
                    Retry
                  </button>
                </div>
              {:else if $userPoolsWithDetails.length === 0}
                {console.log("Showing empty state - userPoolsWithDetails:", $userPoolsWithDetails, "userPoolsData:", $userPoolsData)}
                <PoolsEmptyState 
                  isUserPool={true} 
                  searchInput={searchInput} 
                  isConnected={$auth.isConnected} 
                />
              {:else}
                <div
                  class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                >
                  {#key $userPoolsData}
                  {#each $userPoolsWithDetails as pool (pool.key)}
                    {@const poolForCard = pool.livePool || {
                      // Complete fallback pool structure for pools without live data
                      id: pool.id,
                      lp_token_symbol: pool.lp_token_symbol || pool.symbol,
                      symbol: pool.symbol,
                      name: pool.name || `${pool.symbol_0}/${pool.symbol_1} Pool`,
                      address_0: pool.address_0,
                      address_1: pool.address_1,
                      symbol_0: pool.symbol_0,
                      symbol_1: pool.symbol_1,
                      chain_0: pool.chain_0 || "IC",
                      chain_1: pool.chain_1 || "IC",
                      balance_0: BigInt(0),
                      balance_1: BigInt(0),
                      lp_fee_0: BigInt(0),
                      lp_fee_1: BigInt(0),
                      rolling_24h_apy: "0",
                      tvl: BigInt(0),
                      rolling_24h_volume: BigInt(0),
                      rolling_24h_lp_fee: BigInt(0),
                      rolling_24h_num_swaps: BigInt(0),
                      pool_id: 0,
                      lp_token_id: pool.lp_token_id,
                      lp_token_supply: BigInt(0),
                      total_volume: BigInt(0),
                      total_lp_fee: BigInt(0),
                      lp_fee_bps: 30, // Default 0.3% fee
                      is_removed: false,
                      price: 0,
                      ts: Number(pool.ts || 0),
                      token0: pool.token0 || $tokenMap.get(pool.address_0) || undefined,
                      token1: pool.token1 || $tokenMap.get(pool.address_1) || undefined
                    }}
                    <PoolCard
                      pool={poolForCard}
                      tokenMap={$tokenMap}
                      userPoolData={pool}
                      isHighlighted={false}
                      isMobile={false}
                      isConnected={$auth.isConnected}
                      onClick={() => {
                        goto(`/pools/${pool.address_0}_${pool.address_1}`);
                      }}
                    />
                  {/each}
                  {/key}
                </div>
              {/if}

              {#if $currentUserPoolsStore.loading && hasInitializedUserPools}
                <div
                class="fixed bottom-4 right-4 bg-white/10 backdrop-blur-md rounded-full p-2 shadow-lg z-30"
              >
                <Droplets size={18} class="animate-pulse text-kong-primary" />
                </div>
              {/if}
            </div>
          {:else}
            <div class="h-full">
              <PoolsEmptyState 
                isUserPool={true} 
                searchInput={searchInput} 
                isConnected={$auth.isConnected} 
              />
            </div>
          {/if}
        {/if}
      </div>
    </div>
</section>