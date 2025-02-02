<script lang="ts">
  import { tooltip } from "$lib/actions/tooltip";
  import { writable, derived } from "svelte/store";
  import type { Readable } from "svelte/store";
  import {
    CKUSDT_CANISTER_ID,
    ICP_CANISTER_ID,
    KONG_CANISTER_ID,
  } from "$lib/constants/canisterConstants";
  import Panel from "$lib/components/common/Panel.svelte";
  import { livePoolTotals } from "$lib/services/pools/poolStore";
  import {
    TrendingUp,
    ChevronDown,
    PiggyBank,
    HandCoins,
  } from "lucide-svelte";
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { auth } from "$lib/services/auth";
  import { browser } from "$app/environment";
  import { page } from "$app/stores";
  import TokenCardMobile from "$lib/components/stats/TokenCardMobile.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { FavoriteService } from "$lib/services/tokens/favoriteService";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import PageHeader from "$lib/components/common/PageHeader.svelte";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import DataTable from "$lib/components/common/DataTable.svelte";
  import TokenCell from "$lib/components/stats/TokenCell.svelte";
  import PriceCell from "$lib/components/stats/PriceCell.svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { fetchTokens } from "$lib/api/tokens";

  const ITEMS_PER_PAGE = 50;
  const REFRESH_INTERVAL = 10000;
  const SEARCH_DEBOUNCE = 300; // 300ms debounce for search
  
  // Initialize stores with loading state
  const tokenData = writable<FE.Token[]>([]);
  const totalCount = writable<number>(0);
  const currentPage = writable<number>(1);
  const searchTerm = writable<string>("");
  const debouncedSearchTerm = writable<string>("");
  const isLoading = writable<boolean>(true);
  const isPageChange = writable<boolean>(false);
  const previousPrices = writable(new Map<string, number>());
  const priceFlashStates = writable(new Map<string, { class: string; timeout: ReturnType<typeof setTimeout> }>());

  // Track price changes for flash animations
  function updatePriceFlash(token: FE.Token) {
    const currentPrice = Number(token.metrics?.price || 0);
    const prevPrice = $previousPrices.get(token.canister_id);

    // Always update the previous price, even if it's the first time seeing this token
    previousPrices.update(prices => {
      prices.set(token.canister_id, currentPrice);
      return prices;
    });

    // Only show flash animation if we have a previous price to compare against
    if (prevPrice !== undefined && prevPrice !== currentPrice) {
      const flashClass = currentPrice > prevPrice ? "flash-green" : "flash-red";
      
      // Clear existing timeout if any
      if ($priceFlashStates.has(token.canister_id)) {
        clearTimeout($priceFlashStates.get(token.canister_id)!.timeout);
      }

      const timeout = setTimeout(() => {
        priceFlashStates.update(states => {
          states.delete(token.canister_id);
          return states;
        });
      }, 2000);

      priceFlashStates.update(states => {
        states.set(token.canister_id, { class: flashClass, timeout });
        return states;
      });
    }
  }

  // Optimize refresh data function
  async function refreshData(isPageChangeRefresh = false) {
    if (isPageChangeRefresh) {
      isLoading.set(true);
    }
    try {
      const {tokens, total_count} = await fetchTokens({ 
        page: $currentPage, 
        limit: ITEMS_PER_PAGE,
        search: $debouncedSearchTerm,
      });

      // Update the data first
      tokenData.set(tokens);
      totalCount.set(total_count);

      // Then update flash states
      tokens.forEach(token => {
        updatePriceFlash(token);
      });
    } catch (error) {
      console.error('Error refreshing token data:', error);
    } finally {
      if (isPageChangeRefresh) {
        isLoading.set(false);
      }
    }
  }

  // Debounce the search term
  let searchTimeout: ReturnType<typeof setTimeout>;
  $: {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      debouncedSearchTerm.set($searchTerm);
    }, SEARCH_DEBOUNCE);
  }

  // Refresh data periodically
  let refreshInterval: ReturnType<typeof setInterval>;

  // Single reactive statement to handle all refresh triggers
  $: if (browser) {
    // Clear any existing interval
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = undefined;
    }

    // Initial load or navigation to /stats
    if ($page.url.pathname === '/stats') {
      refreshData(true); // Initial load should show loading
      refreshInterval = setInterval(() => refreshData(false), REFRESH_INTERVAL);
    }
  }

  // Handle page/search changes
  $: if (browser && ($currentPage !== undefined || $debouncedSearchTerm !== undefined)) {
    const isPageChangeEvent = $isPageChange;
    refreshData(isPageChangeEvent);
    if (isPageChangeEvent) {
      isPageChange.set(false);
    }
  }

  // Keep URL updates in a separate reactive statement
  $: if (browser && ($currentPage !== undefined || $debouncedSearchTerm !== undefined)) {
    const url = new URL(window.location.href);
    url.searchParams.set('page', $currentPage.toString());
    if ($debouncedSearchTerm) {
      url.searchParams.set('search', $debouncedSearchTerm);
    } else {
      url.searchParams.delete('search');
    }
    goto(url.toString(), { replaceState: true, keepFocus: true });
  }

  // Cleanup interval on component destroy
  onDestroy(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = undefined;
    }
  });

  // Initialize on mount
  onMount(async () => {
    if (browser) {
      // Get initial parameters from URL
      const urlParams = new URLSearchParams(window.location.search);
      const pageParam = parseInt(urlParams.get('page') || '1');
      const searchParam = urlParams.get('search') || '';
      
      // Set initial values
      currentPage.set(pageParam);
      if (searchParam) {
        searchTerm.set(searchParam);
        debouncedSearchTerm.set(searchParam);
      }
    }
  });

  // Local state
  let isMobile = false;
  const showFavoritesOnly = writable<boolean>(false);
  const sortBy = writable<string>("market_cap");
  const sortDirection = writable<"asc" | "desc">("desc");

  // Reset to page 1 when search term changes
  $: if ($debouncedSearchTerm !== undefined) {
    currentPage.set(1);
  }

  // Favorites state - needs to be a store since it's shared with other components
  const favoriteTokenIds = writable<string[]>([]);
  const favoriteCount = writable<number>(0);

  // Update favorite tokens when auth changes
  $: if ($auth.isConnected) {
    FavoriteService.getFavoriteCount().then((count) => {
      favoriteCount.set(count);
    });
    FavoriteService.loadFavorites().then((favorites) => {
      favoriteTokenIds.set(favorites);
    });
  } else {
    favoriteTokenIds.set([]);
    favoriteCount.set(0);
  }

  // Filtered tokens store - only apply favorites filter here
  const filteredTokens = derived<[
    typeof tokenData,
    typeof favoriteTokenIds,
    typeof showFavoritesOnly
  ], FE.Token[]>(
    [tokenData, favoriteTokenIds, showFavoritesOnly],
    ([$tokenData, $favoriteTokenIds, $showFavoritesOnly]) => {
      let filtered = [...$tokenData];

      // Apply favorites filter
      if ($showFavoritesOnly) {
        filtered = filtered.filter(token => $favoriteTokenIds.includes(token.canister_id));
      }

      return filtered;
    }
  );

  function getTrendClass(token: FE.Token): string {
    return token?.metrics?.price_change_24h
      ? Number(token.metrics.price_change_24h) > 0
        ? "text-kong-accent-green"
        : Number(token.metrics.price_change_24h) < 0
          ? "text-kong-accent-red"
          : ""
      : "";
  }

  function isTopVolume(token: FE.Token): boolean {
    if (
      token.canister_id === CKUSDT_CANISTER_ID ||
      token.canister_id === ICP_CANISTER_ID
    )
      return false;
    return (
      token.volumeRank &&
      token.volumeRank <= 7 &&
      Number(token.metrics?.volume_24h || 0) > 0
    );
  }

  function toggleSort(newSortBy: string) {
    if ($sortBy === newSortBy) {
      sortDirection.update(direction => direction === "desc" ? "asc" : "desc");
    } else {
      sortBy.set(newSortBy);
      sortDirection.set("desc");
    }
  }

  onMount(() => {
    if (browser) {
      isMobile = window.innerWidth < 768;
      const handleResize = () => (isMobile = window.innerWidth < 768);
      window.addEventListener("resize", handleResize, { passive: true });
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }
  });
</script>

<PageHeader
  title="Market Stats"
  description="Track token performance and market activity"
  icon={TrendingUp}
  stats={[
    {
      label: "Vol 24H",
      value: `${formatUsdValue(Number($livePoolTotals[0]?.total_24h_volume ?? 0) / 1e6)}`,
      icon: TrendingUp,
    },
    {
      label: "TVL",
      value: `${formatUsdValue(Number($livePoolTotals[0]?.total_tvl ?? 0) / 1e6)}`,
      icon: PiggyBank,
    },
    {
      label: "Fees 24H",
      value: `${formatUsdValue(Number($livePoolTotals[0]?.total_24h_lp_fee ?? 0) / 1e6)}`,
      icon: HandCoins,
      hideOnMobile: true,
    },
  ]}
/>

<section class="flex flex-col w-full px-2 max-h-[calc(100vh-15rem)] mt-4">
  <div
    class="z-10 flex flex-col lg:flex-row w-full mx-auto gap-4 max-w-[1300px] h-[calc(100vh-15rem)]"
  >
    <Panel
      variant="transparent"
      type="main"
      className="content-panel flex-1 !p-0"
      height="100%"
    >
      <div class="flex flex-col h-full">
        <!-- Header -->
        <div class="flex flex-col gap-3 sm:gap-0 sticky top-0 z-10">
          <div
            class="hidden sm:flex items-center gap-3 py-1 border-b border-kong-border"
          >
            <div class="flex bg-transparent">
              <button
                class="px-4 py-1 transition-colors duration-200 {!$showFavoritesOnly
                  ? 'text-kong-text-primary'
                  : 'text-kong-text-secondary hover:text-kong-text-primary'}"
                on:click={() => showFavoritesOnly.set(false)}
              >
                All Tokens
              </button>
              <button
                class="px-4 py-2 transition-colors duration-200 {$showFavoritesOnly
                  ? 'text-kong-text-primary'
                  : 'text-kong-text-secondary hover:text-kong-text-primary'}"
                on:click={() => showFavoritesOnly.set(true)}
              >
                My Favorites
                {#if $auth.isConnected}
                  <span
                    class="ml-1 px-2 py-0.5 text-kong-text-primary/80 bg-kong-primary/60 rounded text-xs"
                  >
                    {$favoriteCount}
                  </span>
                {/if}
              </button>
            </div>

            <div class="flex-1 px-4 py-2">
              <input
                type="text"
                placeholder={isMobile
                  ? "Search tokens..."
                  : "Search tokens by name, symbol, or canister ID"}
                class="w-full bg-transparent text-kong-text-primary placeholder-[#8890a4] focus:outline-none"
                on:input={(e) => searchTerm.set(e.currentTarget.value)}
                disabled={$showFavoritesOnly}
              />
            </div>
          </div>
        </div>

        <!-- Content -->
        {#if $isLoading && $filteredTokens.length === 0}
          <div class="flex flex-col items-center justify-center h-64 text-center">
            <div class="animate-pulse">
              <div class="h-4 w-32 bg-kong-background-secondary rounded mb-4"></div>
              <div class="h-4 w-48 bg-kong-background-secondary rounded"></div>
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
          <div
            class="flex-1 custom-scrollbar {isMobile
              ? 'h-[calc(100vh-8rem)]'
              : 'h-[calc(100vh-1rem)]'}"
          >
            {#if !isMobile}
              <DataTable
                data={$filteredTokens}
                rowKey="canister_id"
                isLoading={$isLoading}
                columns={[
                  // {
                  //   key: 'marketCapRank',
                  //   title: '#',
                  //   align: 'center',
                  //   sortable: true,
                  //   width: '60px',
                  //   formatter: (row) => {
                  //     const rank = row.marketCapRank || '-';
                  //     return rank === '-' ? rank : `#${rank}`;
                  //   }
                  // },
                  {
                    key: 'token',
                    title: 'Token',
                    align: 'left',
                    component: TokenCell,
                    sortable: true
                  },
                  {
                    key: 'price',
                    title: 'Price',
                    align: 'right',
                    sortable: true,
                    component: PriceCell,
                    componentProps: {
                      priceFlashStates: $priceFlashStates
                    }
                  },
                  {
                    key: 'price_change_24h',
                    title: '24h',
                    align: 'right',
                    sortable: true,
                    formatter: (row) => {
                      const value = row.metrics?.price_change_24h || 0;
                      return `${value > 0 ? '+' : ''}${formatToNonZeroDecimal(value)}%`;
                    }
                  },
                  {
                    key: 'volume_24h',
                    title: 'Vol',
                    align: 'right',
                    sortable: true,
                    formatter: (row) => formatUsdValue(row.metrics?.volume_24h || 0)
                  },
                  {
                    key: 'market_cap',
                    title: 'MCap',
                    align: 'right',
                    sortable: true,
                    formatter: (row) => formatUsdValue(row.metrics?.market_cap || 0)
                  },
                  {
                    key: 'tvl',
                    title: 'TVL',
                    align: 'right',
                    sortable: true,
                    formatter: (row) => formatUsdValue(row.metrics?.tvl || 0)
                  }
                ]}
                itemsPerPage={ITEMS_PER_PAGE}
                defaultSort={{ column: 'market_cap', direction: 'desc' }}
                onRowClick={(row) => goto(`/stats/${row.canister_id}`)}
                isKongRow={(row) => row.canister_id === KONG_CANISTER_ID}
                totalItems={$showFavoritesOnly ? $filteredTokens.length : $totalCount}
                currentPage={$currentPage}
                onPageChange={(page) => currentPage.set(page)}
              />
            {:else}
              <div class="flex flex-col h-full overflow-hidden">
                <!-- Mobile filters -->
                <div class="sticky top-0 z-30 bg-kong-bg-dark border-b border-kong-border">
                  <div class="flex gap-2 px-3 py-2 justify-between">
                    <button
                      class="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm {$sortBy === 'market_cap' ? 'bg-kong-primary text-white' : 'bg-kong-background-secondary'}"
                      on:click={() => toggleSort("market_cap")}
                    >
                      MCap
                      <ChevronDown
                        size={16}
                        class="transition-transform {$sortDirection === 'asc' && $sortBy === 'market_cap' ? 'rotate-180' : ''}"
                      />
                    </button>
                    <button
                      class="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm {$sortBy === 'volume' ? 'bg-kong-primary text-white' : 'bg-kong-background-secondary'}"
                      on:click={() => toggleSort("volume")}
                    >
                      Volume
                      <ChevronDown
                        size={16}
                        class="transition-transform {$sortDirection === 'asc' && $sortBy === 'volume' ? 'rotate-180' : ''}"
                      />
                    </button>
                    <button
                      class="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm {$sortBy === 'price_change' ? 'bg-kong-primary text-white' : 'bg-kong-background-secondary'}"
                      on:click={() => toggleSort("price_change")}
                    >
                      24h %
                      <ChevronDown
                        size={16}
                        class="transition-transform {$sortDirection === 'asc' && $sortBy === 'price_change' ? 'rotate-180' : ''}"
                      />
                    </button>
                  </div>
                </div>

                <!-- Scrollable content -->
                <div class="flex-1 overflow-auto">
                  <div class="space-y-2.5 px-2 py-2">
                    {#each $filteredTokens as token, index (token.canister_id)}
                      <button
                        class="w-full"
                        on:click={() => goto(`/stats/${token.canister_id}`)}
                      >
                        <TokenCardMobile
                          {token}
                          isConnected={$auth.isConnected}
                          isFavorite={$favoriteTokenIds.includes(token.canister_id)}
                          trendClass={getTrendClass(token)}
                          showHotIcon={isTopVolume(token)}
                          priceClass={getTrendClass(token)}
                        />
                      </button>
                    {/each}
                  </div>
                </div>

                <!-- Mobile Pagination -->
                <div class="sticky bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2 border-t border-kong-border backdrop-blur-md">
                  <button
                    class="px-3 py-1 rounded text-sm {$currentPage === 1 ? 'text-kong-text-secondary bg-kong-bg-dark' : 'text-kong-text-primary bg-kong-primary/20 hover:bg-kong-primary/30'}"
                    on:click={() => currentPage.set($currentPage - 1)}
                    disabled={$currentPage === 1}
                  >
                    Previous
                  </button>
                  <span class="text-sm text-kong-text-secondary">
                    Page {$currentPage} of {Math.ceil($totalCount / ITEMS_PER_PAGE)}
                  </span>
                  <button
                    class="px-3 py-1 rounded text-sm {$currentPage === Math.ceil($totalCount / ITEMS_PER_PAGE) ? 'text-kong-text-secondary bg-kong-bg-dark' : 'text-kong-text-primary bg-kong-primary/20 hover:bg-kong-primary/30'}"
                    on:click={() => currentPage.set($currentPage + 1)}
                    disabled={$currentPage === Math.ceil($totalCount / ITEMS_PER_PAGE)}
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
  </div>
</section>

<style scoped lang="postcss">
  section {
    @apply h-[calc(100vh-6rem)];
  }

  .custom-scrollbar {
    @apply h-full overflow-auto;
  }

  th {
    transition: background-color 0.2s;
  }

  th:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  button:disabled {
    @apply opacity-50 cursor-not-allowed;
  }

  .animate-pulse {
    @apply transition-opacity duration-300;
  }

  .loading-skeleton {
    @apply bg-gradient-to-r from-kong-bg-dark via-kong-bg-dark/50 to-kong-bg-dark;
    background-size: 200% 100%;
    animation: loading 1.5s infinite;
  }

  @keyframes loading {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
</style>
