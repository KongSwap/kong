<script lang="ts">
  import { writable, derived } from "svelte/store";
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { Droplets } from "lucide-svelte";
  import { auth } from "$lib/stores/auth";
  import { browser } from "$app/environment";
  import { KONG_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { fetchPools, fetchPoolTotals } from "$lib/api/pools";
  import { fetchTokens } from "$lib/api/tokens/TokenApiClient";
  import { page } from "$app/stores";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
  import { calculateUserPoolPercentage } from "$lib/utils/liquidityUtils";
  import { fade } from "svelte/transition";
  import { panelRoundness } from "$lib/stores/derivedThemeStore";
  
  // Import extracted components
  import PoolCard from "$lib/components/liquidity/pools/PoolCard.svelte";
  import PoolsHeader from "$lib/components/liquidity/pools/PoolsHeader.svelte";
  import PoolsToolbar from "$lib/components/liquidity/pools/PoolsToolbar.svelte";
  import PoolsEmptyState from "$lib/components/liquidity/pools/PoolsEmptyState.svelte";
  import PoolsPagination from "$lib/components/liquidity/pools/PoolsPagination.svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { getPoolPriceUsd } from "$lib/utils/statsUtils";

  // State management
  const activePoolView = writable("all");
  const isMobile = writable(false);
  const sortColumn = writable("tvl");
  const sortDirection = writable<"asc" | "desc">("desc");
  const isLoading = writable(false);
  const livePools = writable<BE.Pool[]>([]);
  const allTokens = writable([]);
  const poolTotals = writable({
    total_volume_24h: 0,
    total_tvl: 0,
    total_fees_24h: 0,
  });

  // Pagination
  const totalPages = writable(0);
  const currentPage = writable(1);
  const itemsPerPage = 48;
  let mobilePage = 1;
  let isMobileFetching = false;

  // Search
  let searchInput = "";
  let searchDebounceTimer: NodeJS.Timeout;
  let urlDebounceTimer: NodeJS.Timeout;

  // User pools
  let hasCompletedInitialLoad = false;

  // Derived stores
  const tokenMap = derived(
    allTokens,
    ($tokens) => new Map($tokens?.map((token) => [token.address, token]) || []),
  );

  const sortedPools = derived(
    [livePools, sortColumn, sortDirection],
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

  const userPoolsWithDetails = derived(
    [currentUserPoolsStore, livePools],
    ([$store, $pools]) =>
      $store.filteredPools.map((pool) => {
        const livePool = $pools.find(
          (p) =>
            p.address_0 === pool.address_0 && p.address_1 === pool.address_1,
        );

        return {
          ...pool,
          key: `${pool.address_0}-${pool.address_1}`,
          sharePercentage: calculateUserPoolPercentage(
            livePool?.balance_0 + livePool?.lp_fee_0,
            livePool?.balance_1 + livePool?.lp_fee_1,
            pool.amount_0,
            pool.amount_1,
          ),
          apy: formatToNonZeroDecimal(livePool?.rolling_24h_apy || 0),
          usdValue: formatToNonZeroDecimal(pool.usd_balance),
          formattedAmount0: formatToNonZeroDecimal(pool.amount_0),
          formattedAmount1: formatToNonZeroDecimal(pool.amount_1),
        };
      }),
  );

  // Initialize data
  onMount(() => {
    if (!browser) return;

    const urlParams = new URLSearchParams($page.url.search);
    searchInput = urlParams.get("search") || "";
    currentPage.set(parseInt(urlParams.get("page") || "1"));

    loadInitialData();
    window.addEventListener("resize", checkMobile);
    checkMobile();

    return () => window.removeEventListener("resize", checkMobile);
  });

  onDestroy(() => {
    clearTimeout(searchDebounceTimer);
    clearTimeout(urlDebounceTimer);
  });

  // Effects
  $effect(() => {
    if ($auth.isConnected && browser) fetchUserPools();
  });

  $effect(() => {
    if (!browser) return;

    clearTimeout(urlDebounceTimer);
    urlDebounceTimer = setTimeout(() => {
      const urlParams = new URLSearchParams($page.url.search);
      const urlSearch = urlParams.get("search") || "";
      const urlPage = parseInt(urlParams.get("page") || "1");

      if (urlSearch !== searchInput || urlPage !== $currentPage) {
        searchInput = urlSearch;
        currentPage.set(urlPage);
        loadPools(urlPage, urlSearch);
      }
    }, 350);
  });

  // Functions
  async function loadInitialData() {
    isLoading.set(true);
    try {
      const [poolsResult, totalsResult, tokensResult] = await Promise.all([
        fetchPools({
          page: $currentPage,
          limit: itemsPerPage,
          search: searchInput,
        }),
        fetchPoolTotals(),
        fetchTokens(),
      ]);

      livePools.set(poolsResult.pools || []);
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

  async function loadPools(page: number, search: string) {
    isLoading.set(true);
    try {
      const result = await fetchPools({ page, limit: itemsPerPage, search });
      livePools.set(result.pools || []);
      totalPages.set(result.total_pages);
      currentPage.set(result.page);
      mobilePage = 1;
    } catch (error) {
      console.error("Error fetching pools:", error);
    } finally {
      isLoading.set(false);
    }
  }

  async function fetchUserPools() {
    if (!hasCompletedInitialLoad || !$currentUserPoolsStore.loading) {
      isLoading.set(true);
      try {
        await currentUserPoolsStore.initialize();
        hasCompletedInitialLoad = true;
      } catch (error) {
        console.error("Error fetching user pools:", error);
        hasCompletedInitialLoad = false;
      } finally {
        isLoading.set(false);
      }
    }
  }

  async function refreshUserPools() {
    if (hasCompletedInitialLoad && !$currentUserPoolsStore.loading) {
      try {
        currentUserPoolsStore.reset();
        await new Promise((resolve) => setTimeout(resolve, 50));
        await currentUserPoolsStore.initialize();
      } catch (error) {
        console.error("Error refreshing user pools:", error);
      }
    }
  }

  function handleSearch() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      const search = searchInput.trim().toLowerCase();
      goto(`/pools?search=${encodeURIComponent(search)}&page=1`, {
        keepFocus: true,
        noScroll: true,
        replaceState: true,
      });
    }, 300);
  }

  async function handleMobileScroll(event) {
    if (
      !$isMobile ||
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
        $livePools = [...$livePools, ...(result.pools || [])];
        mobilePage++;
      } finally {
        isMobileFetching = false;
      }
    }
  }

  function handlePageChange(page: number) {
    goto(`/pools?search=${encodeURIComponent(searchInput)}&page=${page}`, {
      keepFocus: true,
      noScroll: true,
      replaceState: true,
    });
  }

  const checkMobile = () => {
    if (browser) $isMobile = window.innerWidth < 768;
  };

  // Component helpers
  const getHighestAPY = () =>
    Math.max(...($livePools || []).map((p) => Number(p.rolling_24h_apy)), 0);
  const isKongPool = (pool) =>
    pool.address_0 === KONG_CANISTER_ID || pool.address_1 === KONG_CANISTER_ID;

  // Helper to check if a pool is a user pool
  const getUserPoolData = (pool) => {
    return $userPoolsWithDetails.find(
      (p) => p.address_0 === pool.address_0 && p.address_1 === pool.address_1
    );
  };

  // Toolbar handlers
  const handleSortDirectionToggle = () => {
    sortDirection.update((d) => (d === "asc" ? "desc" : "asc"));
  };

  const handleViewChange = (view: string) => {
    activePoolView.set(view);
    
    // Clear search when switching views
    if (view === "user") {
      // Apply current search to user pools
      currentUserPoolsStore.setSearchQuery(searchInput);
      currentUserPoolsStore.updateFilteredPools();
    }
  };

  const handleSearchInputChange = (value: string) => {
    searchInput = value;
    
    // If viewing user pools, update the store's search query
    if ($activePoolView === "user") {
      currentUserPoolsStore.setSearchQuery(value);
      currentUserPoolsStore.updateFilteredPools();
    } else {
      handleSearch();
    }
  };

  const handleSortColumnChange = (column: string) => {
    sortColumn.set(column);
  };
</script>

<svelte:head>
  <title>Liquidity Pools - KongSwap</title>
</svelte:head>

<!-- Pools Header -->
<PoolsHeader 
  poolTotals={$poolTotals} 
  highestAPY={getHighestAPY()} 
/>
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
        isMobile={$isMobile}
        onUserPoolsClick={fetchUserPools}
      />

    <!-- Content -->
      <div class="flex-1 overflow-hidden">
        {#if $activePoolView === "all"}
        <!-- All Pools -->
              <div
          class="h-full overflow-auto {$isMobile
            ? 'mobile-pools-container py-2'
            : 'p-4'}"
                onscroll={handleMobileScroll}
              >
          {#if $sortedPools.length === 0}
            <PoolsEmptyState 
              isUserPool={false} 
              searchInput={searchInput} 
              isConnected={$auth.isConnected} 
            />
          {:else}
            <div
              class={$isMobile
                ? "space-y-3 pb-3"
                : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"}
            >
              {#each $sortedPools as pool (pool.address_0 + pool.address_1)}
                {@const userPoolData = getUserPoolData(pool)}
                <PoolCard
                  pool={pool}
                  tokenMap={$tokenMap}
                  userPoolData={userPoolData}
                  isHighlighted={isKongPool(pool)}
                  isMobile={$isMobile}
                  onClick={() => goto(`/pools/add?token0=${pool.address_0}&token1=${pool.address_1}`)}
                />
              {/each}
            </div>
          {/if}

          {#if $isMobile && isMobileFetching}
            <div class="text-center text-kong-text-secondary py-4">
              <div
                class="inline-block w-5 h-5 border-2 border-kong-primary/20 border-t-kong-primary rounded-full animate-spin mr-2"
              ></div>
              Loading more pools...
            </div>
          {/if}

          {#if !$isMobile}
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
              {#if $currentUserPoolsStore.loading && !hasCompletedInitialLoad}
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
                <PoolsEmptyState 
                  isUserPool={true} 
                  searchInput={searchInput} 
                  isConnected={$auth.isConnected} 
                />
              {:else}
                <div
                  class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                >
                  {#each $userPoolsWithDetails as pool (pool.key)}
                    {@const livePool = $livePools.find(p => p.address_0 === pool.address_0 && p.address_1 === pool.address_1)}
                    {@const poolForCard = livePool ? {
                      ...livePool,
                      // Keep user pool data for display
                    } : {
                      ...pool,
                      // Convert ts from bigint to number
                      ts: Number(pool.ts || 0),
                      // Add missing properties for pools not in live data
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
                      lp_token_supply: BigInt(0),
                      total_volume: BigInt(0),
                      total_lp_fee: BigInt(0),
                      lp_fee_bps: 30, // Default 0.3% fee
                      is_removed: false,
                      price: 0,
                      name: pool.name || `${pool.symbol_0}/${pool.symbol_1} Pool`,
                      token0: pool.token0,
                      token1: pool.token1
                    }}
                    <PoolCard
                      pool={poolForCard}
                      tokenMap={$tokenMap}
                      userPoolData={pool}
                      isHighlighted={false}
                      isMobile={false}
                      onClick={() => goto(`/pools/add?token0=${pool.address_0}&token1=${pool.address_1}`)}
                    />
                  {/each}
                </div>
              {/if}

              {#if $currentUserPoolsStore.loading && hasCompletedInitialLoad}
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

{#if $isLoading}
  <div
    class="loading-state flex flex-col items-center justify-center h-64 gap-4"
  >
      <Droplets size={32} class="animate-pulse text-kong-primary" />
    <p class="loading-text text-base font-medium text-kong-text-primary/70">
      Loading pools...
    </p>
  </div>
{/if}
