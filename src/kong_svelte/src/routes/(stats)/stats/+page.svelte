<script lang="ts">
  import { writable, derived } from "svelte/store";
  import {
    CKUSDT_CANISTER_ID,
    ICP_CANISTER_ID,
  } from "$lib/constants/canisterConstants";
  import Panel from "$lib/components/common/Panel.svelte";
  import {
    TrendingUp,
    ChevronDown,
    TrendingDown,
    Flame,
  } from "lucide-svelte";
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { auth } from "$lib/stores/auth";
  import { browser } from "$app/environment";
  import { page } from "$app/stores";
  import TokenCardMobile from "$lib/components/stats/TokenCardMobile.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { favoriteStore } from "$lib/stores/favoriteStore";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import StatsGrid from "$lib/components/common/StatsGrid.svelte";
  import TokenCell from "$lib/components/stats/TokenCell.svelte";
  import PriceCell from "$lib/components/stats/PriceCell.svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { fetchTokens } from "$lib/api/tokens/TokenApiClient";
  import { fetchPoolTotals } from "$lib/api/pools";
  import { themeStore } from "$lib/stores/themeStore";
  import { panelRoundness } from "$lib/stores/derivedThemeStore";

  // Constants
  const REFRESH_INTERVAL = 10000;
  const SEARCH_DEBOUNCE = 300;
  const FIXED_ITEMS_PER_PAGE = 50; // Fixed at exactly 50 items per page

  // Theme tracking
  let currentThemeId = $state($themeStore);
  $effect(() => {
    currentThemeId = $themeStore;
  });

  // State stores
  const tokenData = writable<FE.StatsToken[]>([]);
  const totalCount = writable<number>(0);
  const currentPage = writable<number>(1);
  const searchTerm = writable<string>("");
  const debouncedSearchTerm = writable<string>("");
  const isLoading = writable<boolean>(true);
  const isPageChange = writable<boolean>(false);
  const itemsPerPage = writable<number>(FIXED_ITEMS_PER_PAGE); // Fixed at 50 items
  const previousPrices = writable(new Map<string, number>());
  const priceFlashStates = writable(
    new Map<
      string,
      { class: string; timeout: ReturnType<typeof setTimeout> }
    >(),
  );
  const poolTotals = writable({
    total_volume_24h: 0,
    total_tvl: 0,
    total_fees_24h: 0,
  });
  const showFavoritesOnly = writable<boolean>(false);
  const sortBy = writable<string>("market_cap");
  const sortDirection = writable<"asc" | "desc">("desc");
  const favoriteTokenIds = writable<string[]>([]);
  const favoriteCount = writable<number>(0);
  const isInitialRefreshCycleDone = writable<boolean>(false);

  // Local state
  let isMobile = false;
  let searchTimeout: ReturnType<typeof setTimeout>;
  let refreshInterval: ReturnType<typeof setInterval>;
  let lastPage = 1;
  let lastSearchTerm = "";
  let lastUrlUpdate = "";
  let isInitialLoadDone = false;
  let isUrlUpdateInProgress = false;
  let screenHeight = 0; // Reactive state for screen height is not strictly needed here, can be local to onMount/effects

  // Add new state for active tab
  const activeTab = writable<"gainers" | "losers">("gainers");

  // Derived stores for top gainers and losers
  const topGainers = derived(tokenData, ($tokenData) => {
    return [...$tokenData]
      .filter((token) => Number(token.metrics?.price_change_24h || 0) > 0)
      .sort(
        (a, b) =>
          Number(b.metrics?.price_change_24h || 0) -
          Number(a.metrics?.price_change_24h || 0),
      )
      .slice(0, 5);
  });

  const topLosers = derived(tokenData, ($tokenData) => {
    return [...$tokenData]
      .filter((token) => Number(token.metrics?.price_change_24h || 0) < 0)
      .sort(
        (a, b) =>
          Number(a.metrics?.price_change_24h || 0) -
          Number(b.metrics?.price_change_24h || 0),
      )
      .slice(0, 5);
  });

  // Derived store for top volume tokens
  const topVolumeTokens = derived(tokenData, ($tokenData) => {
    return [...$tokenData]
      .filter((token) => Number(token.metrics?.volume_24h || 0) > 0)
      .sort((a, b) => Number(b.metrics?.volume_24h || 0) - Number(a.metrics?.volume_24h || 0))
      .slice(0, 5);
  });

  // Function to handle tab change
  function handleTabChange(tab: "gainers" | "losers") {
    activeTab.set(tab);
  }

  // Update price flash animation states
  function updatePriceFlash(token: Kong.Token) {
    const currentPrice = Number(token.metrics?.price || 0);
    const prevPrice = $previousPrices.get(token.address);

    // First update the previous price to avoid race conditions
    previousPrices.update((prices) => {
      prices.set(token.address, currentPrice);
      return prices;
    });

    // Only compare and flash after the initial refresh cycle is complete
    if (
      $isInitialRefreshCycleDone &&
      prevPrice !== undefined &&
      prevPrice > 0 &&
      currentPrice > 0 &&
      prevPrice !== currentPrice
    ) {
      const flashClass = currentPrice > prevPrice ? "flash-green" : "flash-red";

      // Clean up existing timeout to avoid memory leaks
      priceFlashStates.update((states) => {
        if (states.has(token.address)) {
          clearTimeout(states.get(token.address)!.timeout);
        }

        // Create a new timeout
        const timeout = setTimeout(() => {
          priceFlashStates.update((currentStates) => {
            currentStates.delete(token.address);
            return currentStates;
          });
        }, 2000);

        // Update with new animation state
        states.set(token.address, { class: flashClass, timeout });
        return states;
      });
    }
  }

  // Data fetching
  async function refreshData(isPageChangeRefresh = false) {
    if (isPageChangeRefresh) isLoading.set(true);

    try {
      const [{ tokens, total_count }, totalsResult] = await Promise.all([
        fetchTokens({
          page: $currentPage,
          limit: $itemsPerPage,
          search: $debouncedSearchTerm,
        }),
        fetchPoolTotals(),
      ]);

      const sortedByVolume = [...tokens].sort(
        (a, b) => Number(b.metrics?.volume_24h || 0) - Number(a.metrics?.volume_24h || 0)
      );
      sortedByVolume.forEach((token: any, i) => {
        token.volumeRank = i + 1;
      });

      // Assign priceChangeRank for top gainers (positive change)
      const gainers = [...tokens]
        .filter(t => Number(t.metrics?.price_change_24h || 0) > 0)
        .sort((a, b) => Number(b.metrics?.price_change_24h || 0) - Number(a.metrics?.price_change_24h || 0));
      gainers.forEach((token: any, i) => {
        token.priceChangeRank = i + 1;
      });

      // Assign priceChangeRank for top losers (negative change)
      const losers = [...tokens]
        .filter(t => Number(t.metrics?.price_change_24h || 0) < 0)
        .sort((a, b) => Number(a.metrics?.price_change_24h || 0) - Number(b.metrics?.price_change_24h || 0));
      losers.forEach((token: any, i) => {
        token.priceChangeRank = i + 1;
      });

      // Assign tvlRank for top TVL tokens
      const sortedByTVL = [...tokens].sort(
        (a, b) => Number(b.metrics?.tvl || 0) - Number(a.metrics?.tvl || 0)
      );
      sortedByTVL.forEach((token: any, i) => {
        token.tvlRank = i + 1;
      });

      tokenData.set(sortedByVolume);
      totalCount.set(total_count);
      poolTotals.set(totalsResult);
      tokens.forEach(updatePriceFlash);
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      if (isPageChangeRefresh) isLoading.set(false);
    }
  }

  // Simplify search term handling
  function handleSearchInput(e) {
    const value = e.currentTarget.value;
    searchTerm.set(value);
  }

  // Handle search term debouncing
  $effect(() => {
    if (searchTimeout) clearTimeout(searchTimeout);
    const currentSearchTerm = $searchTerm;

    searchTimeout = setTimeout(() => {
      // Only update if different to prevent cycles
      if (currentSearchTerm !== $debouncedSearchTerm) {
        debouncedSearchTerm.set(currentSearchTerm);
      }
    }, SEARCH_DEBOUNCE);
  });

  // Reset to page 1 and refresh data when search term changes
  $effect(() => {
    const currentDebouncedTerm = $debouncedSearchTerm;

    if (
      currentDebouncedTerm !== undefined &&
      currentDebouncedTerm !== lastSearchTerm &&
      !isUrlUpdateInProgress
    ) {
      lastSearchTerm = currentDebouncedTerm;

      if ($currentPage !== 1) {
        lastPage = 1;
        currentPage.set(1);
      } else {
        isPageChange.set(true);
        refreshData(true);
      }
    }
  });

  // Handle page changes
  $effect(() => {
    if ($currentPage !== lastPage && !isUrlUpdateInProgress) {
      isPageChange.set(true);
      lastPage = $currentPage;
      refreshData(true);
    }
  });

  // Combined reactive effect for data refresh interval
  $effect(() => {
    // Clean up existing interval
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = undefined;
    }

    // Only run in browser and on the stats page
    if (browser && $page.url.pathname === "/stats") {
      // Initial data load
      if (!isInitialLoadDone) {
        // Using fixed item count of 50 per page
        isInitialLoadDone = true;
        isInitialRefreshCycleDone.set(false); // Reset flag on initial load
        refreshData(true);
      }

      // Set up refresh interval
      refreshInterval = setInterval(() => {
        refreshData(false);
        // Mark the initial refresh cycle as done after the first interval runs
        if (!$isInitialRefreshCycleDone) {
          isInitialRefreshCycleDone.set(true);
        }
      }, REFRESH_INTERVAL);
    }
  });

  // Handle URL updates separately to avoid too many history calls
  let urlUpdateTimeout;
  $effect(() => {
    if (
      browser &&
      $page.url.pathname === "/stats" &&
      ($currentPage !== undefined || $debouncedSearchTerm !== undefined)
    ) {
      // Clear previous timeout to avoid race conditions
      if (urlUpdateTimeout) clearTimeout(urlUpdateTimeout);

      // Debounce URL updates to ensure we're not updating too frequently
      urlUpdateTimeout = setTimeout(() => {
        const url = new URL(window.location.href);

        const currentPageString = $currentPage.toString();
        const urlPageParam = url.searchParams.get("page") || "1";

        if (currentPageString !== urlPageParam) {
          url.searchParams.set("page", currentPageString);
        }

        const currentSearchTerm = $debouncedSearchTerm;
        const urlSearchParam = url.searchParams.get("search") || "";

        if (currentSearchTerm !== urlSearchParam) {
          if (currentSearchTerm) {
            url.searchParams.set("search", currentSearchTerm);
          } else {
            url.searchParams.delete("search");
          }
        }

        const newUrl = url.toString();

        // Only update URL if it actually changed to prevent excessive history API calls
        if (newUrl !== lastUrlUpdate) {
          lastUrlUpdate = newUrl;
          isUrlUpdateInProgress = true;
          goto(newUrl, { replaceState: true, keepFocus: true }).then(() => {
            // Set a small delay to ensure URL update completes before allowing other effects
            setTimeout(() => {
              isUrlUpdateInProgress = false;
            }, 50);
          });
        }
      }, 50); // Short timeout to batch potential multiple changes
    }
  });

  // Handle favorites when auth changes
  $effect(() => {
    if ($auth.isConnected) {
      favoriteCount.set(favoriteStore.getCount());
      favoriteStore
        .loadFavorites()
        .then((favorites) => favoriteTokenIds.set(favorites));
    } else {
      favoriteTokenIds.set([]);
      favoriteCount.set(0);
    }
  });

  // Cleanup on component destroy
  onDestroy(() => {
    if (searchTimeout) clearTimeout(searchTimeout);
    if (refreshInterval) clearInterval(refreshInterval);
    if (urlUpdateTimeout) clearTimeout(urlUpdateTimeout);
  });

  // Initialize on mount
  onMount(() => {
    if (browser) {
      screenHeight = window.innerHeight;
      // Using fixed items per page - no dynamic calculation needed
      
      // Get initial parameters from URL
      const urlParams = new URLSearchParams(window.location.search);
      const pageParam = parseInt(urlParams.get("page") || "1");
      const searchParam = urlParams.get("search") || "";

      // Set initial values
      lastPage = pageParam; // Initialize lastPage first
      currentPage.set(pageParam);

      if (searchParam) {
        lastSearchTerm = searchParam; // Initialize lastSearchTerm first
        searchTerm.set(searchParam);
        debouncedSearchTerm.set(searchParam);
      }

      // Handle mobile detection
      isMobile = window.innerWidth < 768;
      const handleResize = () => {
        isMobile = window.innerWidth < 768;
        screenHeight = window.innerHeight;
      };
      window.addEventListener("resize", handleResize, { passive: true });
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }
  });

  // No longer dynamically updating itemsPerPage based on screen height - using fixed 50 items
  $effect(() => {
    // This effect kept for future flexibility, but not actively adjusting item count
    // We're using FIXED_ITEMS_PER_PAGE (50) for all screen sizes
  });

  // Filtered tokens derived store
  const filteredTokens = derived(
    [tokenData, favoriteTokenIds, showFavoritesOnly],
    ([$tokenData, $favoriteTokenIds, $showFavoritesOnly]) =>
      $showFavoritesOnly
        ? $tokenData.filter((token) =>
            $favoriteTokenIds.includes(token.address),
          )
        : $tokenData,
  );

  // Helper functions
  function getTrendClass(token: FE.StatsToken): string {
    const change = token?.metrics?.price_change_24h;
    if (!change) return "";
    return Number(change) > 0
      ? "text-kong-text-accent-green"
      : Number(change) < 0
        ? "text-kong-accent-red"
        : "";
  }

  function isTopVolume(token: FE.StatsToken): boolean {
    if (
      token.address === CKUSDT_CANISTER_ID ||
      token.address === ICP_CANISTER_ID
    )
      return false;

    return (
      token.volumeRank !== undefined &&
      token.volumeRank <= 7 &&
      Number(token.metrics?.volume_24h || 0) > 0
    );
  }

  function toggleSort(newSortBy: string) {
    if ($sortBy === newSortBy) {
      sortDirection.update((direction) =>
        direction === "desc" ? "asc" : "desc",
      );
    } else {
      sortBy.set(newSortBy);
      sortDirection.set("desc");
    }
  }

  // Table columns configuration
  const tableColumns = [
    {
      key: "#",
      title: "#",
      align: "center" as "left" | "right" | "center",
      sortable: false,
      formatter: (row) => `${row.metrics?.market_cap_rank}`,
    },
    {
      key: "token",
      title: "Token",
      align: "left" as "left" | "right" | "center",
      component: TokenCell,
      sortable: false,
    },
    {
      key: "price",
      title: "Price",
      align: "right" as "left" | "right" | "center",
      sortable: false,
      component: PriceCell,
      componentProps: {
        priceFlashStates: $priceFlashStates,
      },
    },
    {
      key: "price_change_24h",
      title: "24h",
      align: "right" as "left" | "right" | "center",
      sortable: false,
      formatter: (row) => {
        const value = row.metrics?.price_change_24h || 0;
        return `${value > 0 ? "+" : ""}${formatToNonZeroDecimal(value)}%`;
      },
    },
    {
      key: "volume_24h",
      title: "Vol",
      align: "right" as "left" | "right" | "center",
      sortable: false,
      formatter: (row) => formatUsdValue(row.metrics?.volume_24h || 0),
    },
    {
      key: "market_cap",
      title: "MCap",
      align: "right" as "left" | "right" | "center",
      sortable: false,
      formatter: (row) => formatUsdValue(row.metrics?.market_cap || 0),
    },
    {
      key: "tvl",
      title: "TVL",
      align: "right" as "left" | "right" | "center",
      sortable: false,
      formatter: (row) => formatUsdValue(row.metrics?.tvl || 0),
    },
  ];
</script>

<svelte:head>
  <title>Market Stats - KongSwap</title>
</svelte:head>

<section class="flex w-full gap-2 px-4">
  <div class="flex flex-col w-[350px]">
    <div class="flex flex-col gap-4">
      <div>
        <Panel
          type="main"
          className="flex flex-col !bg-transparent !border-none !p-0 !shadow-none"
          height="100%"
        >
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between px-1">
              <h3 class="text-lg font-semibold text-kong-text-primary">
                Biggest Movers
              </h3>
              <div class="flex items-center gap-2 pt-2">
                <button
                  class="px-3 py-1 flex items-center gap-1 text-sm rounded-full transition-colors duration-200 {$activeTab ===
                  'gainers'
                    ? 'bg-kong-accent-green text-kong-text-on-primary'
                    : 'bg-kong-bg-light text-kong-text-secondary hover:text-kong-text-primary'}"
                  on:click={() => handleTabChange("gainers")}
                >
                  <TrendingUp size={16} />
                </button>
                <button
                  class="px-3 py-1 flex items-center gap-1 text-sm rounded-full transition-colors duration-200 {$activeTab ===
                  'losers'
                    ? 'bg-kong-accent-red text-kong-text-on-primary'
                    : 'bg-kong-bg-light text-kong-text-secondary hover:text-kong-text-primary'}"
                  on:click={() => handleTabChange("losers")}
                >
                  <TrendingDown size={16} />
                </button>
              </div>
            </div>

            <div class="flex flex-col gap-1">
              {#if $isLoading}
                <div class="space-y-2">
                  {#each Array(5) as _}
                    <div
                      class="h-12 bg-kong-bg-light rounded-lg animate-pulse"
                    ></div>
                  {/each}
                </div>
              {:else}
                {#each $activeTab === "gainers" ? $topGainers : $topLosers as token, i (token.address)}
                  <button
                    class="w-full"
                    on:click={() => goto(`/stats/${token.address}`)}
                  >
                    <TokenCardMobile
                      {token}
                      trendClass={getTrendClass(token)}
                      showAdvancedStats={false}
                      showIcons={false}
                      paddingClass="px-3 py-1.5"
                      showIndex={i}
                    />
                  </button>
                {/each}
              {/if}
            </div>
          </div>
        </Panel>
      </div>
      <div>
        <!-- Top Volume Section -->
        <Panel
          type="main"
          className="flex flex-col !bg-transparent !shadow-none !border-none !p-0"
          height="100%"
        >
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2 px-1">
              <Flame size={22} class="text-orange-400" />
              <h3 class="text-lg font-semibold text-kong-text-primary">
                Top Volume
              </h3>
            </div>
            <div class="flex flex-col gap-1">
              {#each $topVolumeTokens as token, i (token.address)}
                <TokenCardMobile
                  {token}
                  section="top-volume"
                  trendClass={getTrendClass(token)}
                  showAdvancedStats={false}
                  showIcons={false}
                  paddingClass="px-3 py-1.5"
                  showIndex={i}
                />
              {/each}
            </div>
          </div>
        </Panel>
      </div>
      <div class="flex flex-col gap-4 items-center">
        <div class="w-full flex items-center justify-center border-2 border-dashed border-kong-border/40 bg-kong-bg-light/40 text-kong-text-secondary text-lg font-semibold">
          <img src="/images/stick-10.png" class="h-full w-full object-fit object-bottom" />

        </div>
      </div>
    </div>
  </div>
  <Panel
    type="main"
    className="flex flex-col !p-0 !w-full !bg-transparent !shadow-none !border-none"
    height="100%"
  >
    <div class="flex flex-col h-full !rounded-lg">
      <!-- Header -->
      <div class="hidden sm:flex items-center mb-2">
        <div class="flex-1 flex items-center">
          <div class="relative w-full">
            <svg
              class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-kong-text-secondary pointer-events-none"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
              ><circle cx="11" cy="11" r="8" /><line
                x1="21"
                y1="21"
                x2="16.65"
                y2="16.65"
              /></svg
            >
            <input
              type="text"
              placeholder={isMobile
                ? "Search tokens..."
                : "Search tokens by name, symbol, or canister ID"}
              class="w-full pl-10 pr-4 py-2 rounded-full bg-kong-bg-light/60 border border-kong-border/40 text-kong-text-primary placeholder-[#8890a4] focus:outline-none focus:ring-2 focus:ring-kong-primary/40 focus:border-kong-primary transition-all duration-200 shadow-sm"
              on:input={handleSearchInput}
              value={$searchTerm}
              disabled={$showFavoritesOnly}
            />
          </div>
        </div>
      </div>

      <!-- Content -->
      {#if $isLoading && $filteredTokens.length === 0}
        <div class="flex flex-col items-center justify-center h-64 text-center">
          <div class="transition-opacity duration-300">
            <div class="h-4 w-32 bg-kong-bg-light rounded mb-4"></div>
            <div class="h-4 w-48 bg-kong-bg-light rounded"></div>
          </div>
        </div>
      {:else if $filteredTokens.length === 0}
        <div class="flex flex-col items-center justify-center h-64 text-center">
          {#if $showFavoritesOnly && !$auth.isConnected}
            <p class="text-gray-400 mb-4">
              Connect your wallet to view and manage your favorite tokens
            </p>
            <ButtonV2
              variant="solid"
              theme="primary"
              on:click={() => sidebarStore.open()}
            >
              Connect Wallet
            </ButtonV2>
          {:else}
            <p class="text-gray-400">
              No tokens found matching your search criteria
            </p>
          {/if}
        </div>
      {:else}
        <div class="flex-1 {$panelRoundness}">
          {#if !isMobile}
            <StatsGrid
              data={$filteredTokens}
              rowKey="canister_id"
              isLoading={$isLoading}
              columns={tableColumns}
              itemsPerPage={$itemsPerPage}
              defaultSort={{ column: "market_cap", direction: "desc" }}
              onRowClick={(row) => goto(`/stats/${row.address}`)}
              totalItems={$showFavoritesOnly
                ? $filteredTokens.length
                : $totalCount}
              currentPage={$currentPage}
              onPageChange={(page) => currentPage.set(page)}
            />
          {:else}
            <div class="flex flex-col h-full overflow-hidden">
              <!-- Mobile filters -->
              <div
                class="sticky top-0 z-30 bg-kong-bg-light border-b border-kong-border"
              >
                <div class="flex gap-2 px-3 py-2 justify-between">
                  <button
                    class="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm {$sortBy ===
                    'market_cap'
                      ? 'bg-kong-primary text-white'
                      : 'bg-kong-bg-light'}"
                    on:click={() => toggleSort("market_cap")}
                  >
                    MCap
                    <ChevronDown
                      size={16}
                      class="transition-transform {$sortDirection === 'asc' &&
                      $sortBy === 'market_cap'
                        ? 'rotate-180'
                        : ''}"
                    />
                  </button>
                  <button
                    class="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm {$sortBy ===
                    'volume'
                      ? 'bg-kong-primary text-white'
                      : 'bg-kong-bg-light'}"
                    on:click={() => toggleSort("volume")}
                  >
                    Volume
                    <ChevronDown
                      size={16}
                      class="transition-transform {$sortDirection === 'asc' &&
                      $sortBy === 'volume'
                        ? 'rotate-180'
                        : ''}"
                    />
                  </button>
                  <button
                    class="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm {$sortBy ===
                    'price_change'
                      ? 'bg-kong-primary text-white'
                      : 'bg-kong-bg-light'}"
                    on:click={() => toggleSort("price_change")}
                  >
                    24h %
                    <ChevronDown
                      size={16}
                      class="transition-transform {$sortDirection === 'asc' &&
                      $sortBy === 'price_change'
                        ? 'rotate-180'
                        : ''}"
                    />
                  </button>
                </div>
              </div>

              <!-- Scrollable content -->
              <div class="flex-1 overflow-auto">
                <div class="space-y-2.5 px-2 py-2">
                  {#each $filteredTokens as token (token.address)}
                    <button
                      class="w-full"
                      on:click={() => goto(`/stats/${token.address}`)}
                    >
                      <TokenCardMobile
                        {token}
                        trendClass={getTrendClass(token)}
                        showIcons={false}
                      />
                    </button>
                  {/each}
                </div>
              </div>

              <!-- Mobile Pagination -->
              <div
                class="sticky bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2 border-t border-kong-border backdrop-blur-md !rounded-b-lg"
              >
                <button
                  class="px-3 py-1 rounded text-sm {$currentPage === 1
                    ? 'text-kong-text-secondary bg-kong-bg-light opacity-50 cursor-not-allowed'
                    : 'text-kong-text-primary bg-kong-primary/20 hover:bg-kong-primary/30'}"
                  on:click={() => {
                    if ($currentPage > 1) {
                      isPageChange.set(true);
                      currentPage.set($currentPage - 1);
                    }
                  }}
                  disabled={$currentPage === 1}
                >
                  Previous
                </button>
                <span class="text-sm text-kong-text-secondary">
                  Page {$currentPage} of {Math.max(
                    1,
                    Math.ceil($totalCount / $itemsPerPage),
                  )}
                </span>
                <button
                  class="px-3 py-1 rounded text-sm {$currentPage >=
                  Math.ceil($totalCount / $itemsPerPage)
                    ? 'text-kong-text-secondary bg-kong-bg-light opacity-50 cursor-not-allowed'
                    : 'text-kong-text-primary bg-kong-primary/20 hover:bg-kong-primary/30'}"
                  on:click={() => {
                    if (
                      $currentPage < Math.ceil($totalCount / $itemsPerPage)
                    ) {
                      isPageChange.set(true);
                      currentPage.set($currentPage + 1);
                    }
                  }}
                  disabled={$currentPage >=
                    Math.ceil($totalCount / $itemsPerPage)}
                >
                  Next
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </Panel>
</section>

<style scoped lang="postcss">
  @keyframes loading {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
</style>
