<script lang="ts">
  import {
    formatToNonZeroDecimal,
  } from "$lib/utils/numberFormatUtils";
  import { writable, derived } from "svelte/store";
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import {
    ArrowUp,
    ArrowDown,
    Droplets,
    Flame,
    TrendingUp,
    PiggyBank,
    Plus,
  } from "lucide-svelte";
  import Card from "$lib/components/common/Card.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import UserPool from "$lib/components/liquidity/pools/UserPool.svelte";
  import { auth } from "$lib/stores/auth";
  import { browser } from "$app/environment";
  import { getPoolPriceUsd } from "$lib/utils/statsUtils";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { KONG_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { fetchPools, fetchPoolTotals } from "$lib/api/pools";
  import { fetchTokens } from "$lib/api/tokens/TokenApiClient";
  import { page } from "$app/stores";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
  import { panelRoundness } from "$lib/stores/derivedThemeStore";
  import { calculateUserPoolPercentage } from "$lib/utils/liquidityUtils";
  import { fade, slide } from "svelte/transition";

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
  let selectedPool: any = null;
  let showUserPoolModal = false;
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

  function handleLiquidityComplete() {
    showUserPoolModal = false;
    selectedPool = null;
    refreshUserPools();
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

  // Reusable pool card renderer
  function renderPoolCard(pool, userPoolData = null, isUserPoolView = false) {
    const livePool = isUserPoolView ? $livePools.find(p => p.address_0 === pool.address_0 && p.address_1 === pool.address_1) : pool;
    const effectiveUserData = isUserPoolView ? pool : userPoolData;
    
    return {
      pool,
      livePool,
      userPoolData: effectiveUserData,
      onClick: () => goto(`/pools/add?token0=${pool.address_0}&token1=${pool.address_1}`),
      isHighlighted: !isUserPoolView && isKongPool(pool),
      stats: [
        { 
          label: "Price", 
          value: `${pool.symbol_1 === "ckUSDT" ? "$" : ""}${livePool ? formatToNonZeroDecimal(getPoolPriceUsd(livePool)) : "0"}${pool.symbol_1 === "ckUSDT" ? "" : " " + pool.symbol_1}` 
        },
        { 
          label: "TVL", 
          value: formatUsdValue(Number(livePool?.tvl || 0)) 
        },
        { 
          label: "Volume 24h", 
          value: formatUsdValue(Number(livePool?.rolling_24h_volume || 0)) 
        },
        ...(($auth.isConnected || isUserPoolView) ? [{
          label: "Your Position",
          value: `$${effectiveUserData?.usdValue || 0}`,
          color: effectiveUserData ? 'text-kong-success' : 'text-kong-text-secondary'
        }] : [])
      ]
    };
  }

  // Common loading state component
  const LoadingState = {
    component: Droplets,
    text: "Loading your liquidity positions..."
  };

  // Common empty state config
  const getEmptyStateConfig = (isUserPool) => ({
    icon: Droplets,
    title: searchInput 
      ? `No pools found matching "${searchInput}"`
      : isUserPool 
        ? "No active liquidity positions" 
        : "No pools available",
    subtitle: searchInput
      ? "Try a different search term or check your active positions"
      : isUserPool
        ? "Add liquidity to a pool to start earning fees"
        : "Check back later for available pools",
    showAddButton: !searchInput && isUserPool
  });

  // Sort options
  const sortOptions = [
    { value: "tvl", label: "TVL" },
    { value: "rolling_24h_volume", label: "Volume 24H" },
    { value: "rolling_24h_apy", label: "APY" },
    { value: "price", label: "Price" }
  ];
</script>

<svelte:head>
  <title>Liquidity Pools - KongSwap</title>
</svelte:head>

<!-- Custom Advertisement-Style Header -->
<div class="px-4">
  <div
    class="w-3/4 mx-auto overflow-hidden relative"
  >

    <div class="relative z-10 md:pb-4">
      <div class="max-w-7xl mx-auto">
        <!-- Main headline -->
        <div class="text-center mb-4">
          <h1
            class="text-4xl md:text-4xl font-bold text-kong-text-primary mb-4"
          >
            Keep <span
              class="text-transparent font-black bg-clip-text bg-gradient-to-r from-kong-primary to-kong-accent-blue animate-shine"
              >100%</span
              > of Liquidity Fees
          </h1>

          <p
            class="text-lg md:text-base text-kong-text-secondary !max-w-xl mx-auto"
          >
            Provide liquidity and keep every penny. No protocol fees. Auto-compounding.
            <span class="text-kong-text-primary font-semibold"
              >Pure profit for you.</span
            >
          </p>
        </div>

        <!-- Stats showcase -->
        <div
          class="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-xl mx-auto"
        >
          <!-- Total Volume -->
          <div
            class="bg-kong-bg-secondary {$panelRoundness} px-5 py-3.5 border border-kong-border/50 hover:border-kong-primary/50 transition-all duration-300 group"
          >
            <div class="flex items-center justify-between mb-2">
              <TrendingUp
                class="w-7 h-7 text-kong-primary group-hover:animate-bounce"
              />
              <span
                class="text-xs text-kong-text-secondary uppercase tracking-wider"
                >24H Volume</span
              >
            </div>
            <div class="text-2xl font-bold text-kong-text-primary mb-1">
              {formatUsdValue($poolTotals.total_volume_24h)}
            </div>
            <div class="text-sm text-kong-success font-medium">
              = {formatUsdValue($poolTotals.total_volume_24h * 0.003)} in fees
            </div>
          </div>

          <!-- Total TVL -->
          <div
            class="bg-kong-bg-secondary {$panelRoundness} px-5 py-3.5 border border-kong-border/50 hover:border-kong-accent-blue/50 transition-all duration-300 group"
          >
            <div class="flex items-center justify-between mb-2">
              <PiggyBank
                class="w-7 h-7 text-kong-accent-blue group-hover:animate-bounce"
              />
              <span
                class="text-xs text-kong-text-secondary uppercase tracking-wider"
                >Total Locked</span
              >
            </div>
            <div class="text-2xl font-bold text-kong-text-primary mb-1">
              {formatUsdValue($poolTotals.total_tvl)}
            </div>
            <div class="text-sm text-kong-text-secondary">
              Earning fees 24/7
            </div>
          </div>

          <!-- Highest APY -->
          <div
            class="bg-kong-bg-secondary bg-gradient-to-br from-kong-success/10 to-kong-bg-primary/50 {$panelRoundness} px-5 py-3.5 border border-kong-success/30 hover:border-kong-success/50 transition-all duration-300 group"
          >
            <div class="flex items-center justify-between mb-2">
              <Flame
                class="w-7 h-7 text-kong-success group-hover:animate-pulse"
              />
              <span
                class="text-xs text-kong-success uppercase tracking-wider font-semibold"
                >Top APY</span
              >
            </div>
            <div class="text-2xl font-bold text-kong-success mb-1">
              {getHighestAPY().toFixed(2)}%
            </div>
            <div class="text-sm text-kong-text-secondary">
              Best performing pool
            </div>
          </div>
        </div>

        <!-- CTA section -->
        <div class="mt-8 text-center">
          <div
            class="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              class="group relative px-8 py-3 bg-gradient-to-r from-kong-primary to-kong-accent-blue text-white font-semibold {$panelRoundness} transition-all duration-300 hover:scale-105"
              onclick={() => goto("/pools/add")}
            >
              <span class="relative z-10 flex items-center gap-2">
                <Plus size={20} />
                Start Earning Now
              </span>
              <div
                class="absolute inset-0 bg-gradient-to-r from-kong-accent-blue to-kong-primary rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              ></div>
            </button>

            <div
              class="flex items-center gap-4 text-sm text-kong-text-secondary"
            >
              <div class="flex items-center gap-1">
                <Droplets class="w-4 h-4 text-kong-primary" />
                <span>200+ Active Pools</span>
              </div>
              <div class="hidden sm:block w-px h-4 bg-kong-border"></div>
              <div class="flex items-center gap-1">
                <span class="text-kong-success">●</span>
                <span>0.3% Swap Fee</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<section class="flex flex-col w-full px-2 pb-4 mt-4 max-w-xl">
    <div class="overflow-hidden flex flex-col h-full {$panelRoundness}">
    <!-- Header -->
      <div
        class="flex flex-col sticky top-0 z-20 backdrop-blur-md rounded-t-{$panelRoundness}"
      >
        <div class="flex flex-col gap-3 sm:gap-0">
        <!-- Mobile Header -->
          <div class="sm:hidden space-y-2">
            <div class="flex gap-2 w-full">
              <!-- View Toggle -->
              <div
                class="flex border border-white/[0.08] rounded-lg overflow-hidden shadow-inner bg-white/[0.02]"
              >
              {#each ["all", "user"] as view}
                <button
                  class="px-3 py-2 text-sm transition-colors {$activePoolView ===
                  view
                    ? 'text-kong-text-primary bg-kong-primary/10 font-medium'
                    : 'text-kong-text-secondary'}"
                  onclick={() => {
                    $activePoolView = view;
                    if (view === "user") fetchUserPools();
                  }}
                >
                  {view === "all"
                    ? "All"
                    : `My (${$userPoolsWithDetails.length})`}
                </button>
                {#if view === "all"}<div
                    class="w-px bg-white/[0.04]"
                  ></div>{/if}
              {/each}
              </div>

              <!-- Search -->
              <div class="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search pools..."
                  class="w-full bg-white rounded-lg pl-8 pr-2 py-2 text-sm text-kong-text-primary placeholder-kong-text-secondary focus:outline-none focus:ring-1 focus:ring-kong-primary/20 transition-all duration-200"
                  bind:value={searchInput}
                  oninput={handleSearch}
                />
                <svg
                  class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-kong-text-secondary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            {#if $activePoolView === "all"}
              <div class="flex gap-2 w-full">
                <!-- Sort -->
                <div
                  class="flex-1 flex bg-white/[0.02] border border-white/[0.08] rounded-lg overflow-hidden shadow-inner"
                >
                  <select
                    bind:value={$sortColumn}
                    class="flex-1 bg-transparent text-kong-text-primary text-sm focus:outline-none px-3 py-2"
                  >
                    {#each sortOptions as option}
                      <option value={option.value}>{option.label}</option>
                    {/each}
                  </select>
                  <div class="w-px bg-white/[0.04]"></div>
                  <button
                    onclick={() =>
                    sortDirection.update((d) => (d === "asc" ? "desc" : "asc"))}
                    class="px-3 text-kong-primary"
                  >
                    <svelte:component
                    this={$sortDirection === "asc" ? ArrowUp : ArrowDown}
                      class="w-4 h-4"
                    />
                  </button>
                </div>

              <!-- Add Button -->
                <button
                  class="bg-kong-primary text-white rounded-lg px-4 py-2 hover:bg-kong-primary-hover flex items-center gap-2 transition-all duration-200 shadow-md"
                  onclick={() => goto("/pools/add")}
                >
                <Plus size={16} />
                  <span class="text-sm font-medium">Add</span>
                </button>
              </div>
            {/if}
          </div>

        <!-- Desktop Header -->
          <div
            class="hidden sm:flex border-b border-white/[0.04] py-1 rounded-t-{$panelRoundness}"
          >
          <div class="flex-1 flex items-center">
                <div class="flex bg-transparent">
                  <button
                    class="px-4 py-2 transition-colors duration-200 rounded {$activePoolView ===
                    'all'
                      ? 'text-kong-text-primary font-medium'
                      : 'text-kong-text-secondary hover:text-kong-text-primary'}"
                    onclick={() => ($activePoolView = "all")}
                  >
                    All Pools
                  </button>
                  {#if $auth.isConnected}
                    <button
                      class="px-4 py-2 transition-colors duration-200 {$activePoolView ===
                      'user'
                        ? 'text-kong-text-primary font-medium'
                        : 'text-kong-text-secondary hover:text-kong-text-primary'}"
                      onclick={() => {
                        $activePoolView = "user";
                        fetchUserPools();
                      }}
                    >
                      My Pools <span
                        class="text-xs ml-1 font-bold py-0.5 text-white bg-kong-primary px-1.5 rounded"
                    >{$userPoolsWithDetails.length}</span
                      >
                    </button>
                  {/if}
                </div>

                <div class="flex-1 px-4 py-2">
                  <input
                    type="text"
                    placeholder={$isMobile
                      ? "Search pools..."
                      : "Search pools by name, symbol, or canister ID"}
                    class="w-full bg-kong-bg-secondary p-2 text-kong-text-primary placeholder-kong-text-secondary/70 focus:outline-none focus:border-b focus:border-kong-primary/20 transition-all duration-200"
                    bind:value={searchInput}
                    oninput={handleSearch}
                  />
                </div>

                {#if $activePoolView === "all"}
                  <div class="flex items-center gap-2 px-4">
                <span class="text-sm text-kong-text-secondary">Sort by:</span>
                    <div class="relative">
                      <select
                        bind:value={$sortColumn}
                        class="appearance-none bg-white/[0.05] border border-white/[0.08] rounded-lg pl-3 pr-8 py-1.5 text-sm text-kong-text-primary focus:outline-none focus:border-kong-primary/50 cursor-pointer"
                      >
                        {#each sortOptions as option}
                          <option value={option.value}>{option.label}</option>
                        {/each}
                      </select>
                      <svg
                        class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-kong-text-secondary pointer-events-none"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                    <button
                      onclick={() =>
                    sortDirection.update((d) => (d === "asc" ? "desc" : "asc"))}
                      class="p-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-kong-primary hover:bg-white/[0.08] transition-all duration-200"
                    >
                      <svelte:component
                    this={$sortDirection === "asc" ? ArrowUp : ArrowDown}
                        class="w-4 h-4"
                      />
                    </button>
                  </div>
                {/if}
            </div>
          </div>
        </div>
      </div>

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
          <div
            class={$isMobile
              ? "space-y-3 pb-3"
              : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"}
          >
            {#each $sortedPools as pool (pool.address_0 + pool.address_1)}
              {@const userPoolData = getUserPoolData(pool)}
              {@const cardData = renderPoolCard(pool, userPoolData, false)}
              <Card
                onClick={cardData.onClick}
                isHighlighted={cardData.isHighlighted}
                className={$isMobile
                  ? "active:scale-[0.99]"
                  : "hover:scale-[1.02] active:scale-[0.98]"}
              >
                <div class="p-4 h-full flex flex-col">
                  <div class="flex items-center justify-between mb-4">
                    <div
                      class="flex items-center gap-{$isMobile ? '2.5' : '3'}"
                    >
                      <TokenImages
                        tokens={[
                          $tokenMap.get(pool.address_0),
                          $tokenMap.get(pool.address_1),
                        ]}
                        size={$isMobile ? 28 : 36}
                        overlap={!$isMobile}
                      />
                      <div>
                        <div
                          class="text-{$isMobile
                            ? 'base'
                            : 'base'} font-{$isMobile
                            ? 'medium'
                            : 'semibold'} text-kong-text-primary"
                        >
                          {pool.symbol_0}/{pool.symbol_1}
                        </div>
                        {#if !$isMobile}
                          <div class="text-xs text-kong-text-secondary">
                            {pool.name ||
                              `${pool.symbol_0}/${pool.symbol_1} Pool`}
                          </div>
                        {/if}
                        {#if userPoolData}
                          <div class="text-xs text-kong-accent-blue">
                            {userPoolData.sharePercentage}% of pool
                          </div>
                        {/if}
                      </div>
                    </div>
                    <div
                      class="{$isMobile ? 'text-sm' : 'text-sm'} flex items-center gap-1{$isMobile
                        ? '.5'
                        : ''} bg-kong-primary/10 px-2{$isMobile
                        ? '.5'
                        : ''} py-1 rounded-lg"
                    >
                      <span
                        class="text-kong-primary text-nowrap font-{$isMobile
                          ? 'medium'
                          : 'semibold'}"
                      >
                        {Number(pool.rolling_24h_apy).toFixed(2)}%{!$isMobile
                          ? " APY"
                          : ""}
                      </span>
                    </div>
                  </div>

                  <!-- Stats - Add flex-1 to push content down when no user data -->
                  <div class="{!userPoolData ? 'flex-1 flex flex-col justify-end' : ''}">
                    {#if $isMobile}
                      <div class="grid grid-cols-3 gap-4">
                        {#each cardData.stats.slice(0, 3) as stat}
                          <div class="bg-black/10 rounded-lg p-2.5">
                            <div class="text-xs text-kong-text-secondary mb-1">
                              {stat.label}
                            </div>
                            <div
                              class="text-sm font-medium text-kong-text-primary"
                            >
                              {stat.value}
                            </div>
                          </div>
                        {/each}
                      </div>
                    {:else}
                      <div class="space-y-3">
                        {#each cardData.stats as stat}
                          <div class="flex justify-between items-center">
                            <span class="text-sm text-kong-text-secondary"
                            >{stat.label}</span
                            >
                            <span
                              class="text-sm font-medium {stat.color || 'text-kong-text-primary'}"
                            >{stat.value}</span
                            >
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </div>
              </Card>
            {/each}
          </div>

          {#if $isMobile && isMobileFetching}
            <div class="text-center text-kong-text-secondary py-4">
              <div
                class="inline-block w-5 h-5 border-2 border-kong-primary/20 border-t-kong-primary rounded-full animate-spin mr-2"
              ></div>
              Loading more pools...
            </div>
          {/if}

          {#if !$isMobile && $totalPages > 1}
                  <div class="mt-6 flex justify-center items-center gap-2">
                    <button
                      class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 {$currentPage ===
                      1
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        : 'bg-white/[0.05] text-kong-text-primary hover:bg-white/[0.08]'}"
                      onclick={() => handlePageChange($currentPage - 1)}
                      disabled={$currentPage === 1}
                    >
                      Previous
                    </button>

                    <div class="flex items-center gap-1">
                      {#each Array(Math.min($totalPages, 7)) as _, i}
                        {@const pageNum = (() => {
                          if ($totalPages <= 7) return i + 1;
                          if ($currentPage <= 4) return i + 1;
                          if ($currentPage >= $totalPages - 3)
                            return $totalPages - 6 + i;
                          return $currentPage - 3 + i;
                        })()}
                        {#if pageNum > 0 && pageNum <= $totalPages}
                          <button
                            class="w-10 h-10 rounded-lg text-sm font-medium transition-all duration-200 {pageNum ===
                            $currentPage
                              ? 'bg-kong-primary text-white'
                              : 'bg-white/[0.05] text-kong-text-primary hover:bg-white/[0.08]'}"
                            onclick={() => handlePageChange(pageNum)}
                          >
                            {pageNum}
                          </button>
                        {/if}
                      {/each}
                    </div>

                    <button
                      class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 {$currentPage ===
                      $totalPages
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        : 'bg-white/[0.05] text-kong-text-primary hover:bg-white/[0.08]'}"
                      onclick={() => handlePageChange($currentPage + 1)}
                      disabled={$currentPage === $totalPages}
                    >
                      Next
                    </button>
              </div>
            {/if}
          </div>
        {:else if $activePoolView === "user"}
        <!-- User Pools -->
          {#if $auth.isConnected}
            <div class="h-full overflow-auto p-4">
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
                {@const emptyConfig = getEmptyStateConfig(true)}
                <div
                  class="flex flex-col items-center justify-center h-64 gap-4 text-center"
                  in:fade={{ duration: 300 }}
                >
                  <div
                    class="p-4 rounded-full bg-kong-primary/5 text-kong-primary/70 mb-2"
                  >
                    <svelte:component this={emptyConfig.icon} size={40} />
                  </div>
                  <p class="text-lg font-medium text-kong-text-primary">
                    {emptyConfig.title}
                  </p>
                  <p class="text-sm text-kong-text-primary/60 max-w-md">
                    {emptyConfig.subtitle}
                  </p>
                  {#if emptyConfig.showAddButton}
                    <button
                      onclick={() => goto("/pools/add")}
                      class="mt-4 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-kong-primary text-white font-medium hover:bg-kong-primary-hover transition-all duration-200"
                    >
                      <Plus size={16} />
                      <span>Add Liquidity</span>
                    </button>
                  {/if}
                </div>
              {:else}
                <div
                  class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                >
                  {#each $userPoolsWithDetails as pool (pool.key)}
                    {@const cardData = renderPoolCard(pool, null, true)}
                    <Card
                      onClick={cardData.onClick}
                      isHighlighted={false}
                      className="hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <div class="p-4 h-full flex flex-col">
                        <div class="flex items-center justify-between mb-4">
                          <div class="flex items-center gap-3">
                            <TokenImages
                              tokens={[pool.token0, pool.token1]}
                              size={36}
                              overlap={true}
                            />
                            <div>
                              <div
                                class="text-base font-semibold text-kong-text-primary"
                              >
                                {pool.symbol_0}/{pool.symbol_1}
                              </div>
                              <div class="text-xs text-kong-text-secondary">
                                {cardData.livePool?.name || `${pool.symbol_0}/${pool.symbol_1} Pool`}
                              </div>
                              <div class="text-xs text-kong-accent-blue">
                                {pool.sharePercentage}% of pool
                              </div>
                            </div>
                          </div>
                          <div
                            class="text-sm flex items-center gap-1 bg-kong-primary/10 px-2 py-1 rounded-lg"
                          >
                            <span
                              class="text-kong-primary text-nowrap font-semibold"
                            >
                              {pool.apy}% APY
                            </span>
                          </div>
                        </div>

                        <!-- Stats -->
                        <div class="flex-1 flex flex-col justify-end">
                          <div class="space-y-3">
                            {#each cardData.stats as stat}
                              <div class="flex justify-between items-center">
                                <span class="text-sm text-kong-text-secondary">{stat.label}</span>
                                <span class="text-sm font-medium {stat.color || 'text-kong-text-primary'}">{stat.value}</span>
                              </div>
                            {/each}
                          </div>
                        </div>
                      </div>
                    </Card>
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
            <div
              class="flex flex-col items-center justify-center h-64 text-center p-6 bg-white/[0.02] rounded-xl border border-white/[0.04] shadow-lg backdrop-blur-md m-4"
            >
              <div
                class="p-4 rounded-full bg-kong-primary/5 text-kong-primary/70 mb-4"
              >
                <Droplets size={40} />
              </div>
              <p class="text-lg font-medium text-kong-text-primary mb-2">
                Connect your wallet to view your liquidity positions
              </p>
              <p class="text-sm text-kong-text-primary/60 max-w-md mb-6">
                Provide liquidity to pools and earn trading fees and rewards
              </p>
              <button
                class="px-6 py-2.5 bg-kong-primary text-white rounded-lg hover:bg-kong-primary-hover transition-all duration-200 flex items-center gap-2 shadow-md"
              onclick={() => sidebarStore.open()}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <path d="M12 12h.01" />
                </svg>
                <span class="font-medium">Connect Wallet</span>
              </button>
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

{#if selectedPool}
  <UserPool
    pool={selectedPool}
    bind:showModal={showUserPoolModal}
    on:liquidityRemoved={handleLiquidityComplete}
    on:liquidityAdded={handleLiquidityComplete}
  />
{/if}
