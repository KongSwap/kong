<script lang="ts">
  import { writable, derived } from "svelte/store";
  import {
    CKUSDT_CANISTER_ID,
    ICP_CANISTER_ID,
    KONG_CANISTER_ID,
  } from "$lib/constants/canisterConstants";
  import Panel from "$lib/components/common/Panel.svelte";
  import {
    TrendingUp,
    ChevronDown,
    PiggyBank,
    HandCoins,
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
  import PageHeader from "$lib/components/common/PageHeader.svelte";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import DataTable from "$lib/components/common/DataTable.svelte";
  import TokenCell from "$lib/components/stats/TokenCell.svelte";
  import PriceCell from "$lib/components/stats/PriceCell.svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { fetchTokens } from "$lib/api/tokens/TokenApiClient";
  import { fetchPoolTotals } from "$lib/api/pools";
  import { themeStore } from "$lib/stores/themeStore";
  import { panelRoundness } from "$lib/stores/derivedThemeStore";

  // Constants
  const ITEMS_PER_PAGE = 100;
  const REFRESH_INTERVAL = 10000;
  const SEARCH_DEBOUNCE = 300;
  
  // Theme tracking
  let currentThemeId = $state($themeStore);
  $effect(() => { currentThemeId = $themeStore; });
  
  // State stores
  const tokenData = writable<FE.StatsToken[]>([]);
  const totalCount = writable<number>(0);
  const currentPage = writable<number>(1);
  const searchTerm = writable<string>("");
  const debouncedSearchTerm = writable<string>("");
  const isLoading = writable<boolean>(true);
  const isPageChange = writable<boolean>(false);
  const previousPrices = writable(new Map<string, number>());
  const priceFlashStates = writable(new Map<string, { class: string; timeout: ReturnType<typeof setTimeout> }>());
  const poolTotals = writable({ total_volume_24h: 0, total_tvl: 0, total_fees_24h: 0 });
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
  let lastUrlUpdate = '';
  let isInitialLoadDone = false;
  let isUrlUpdateInProgress = false;

  // Update price flash animation states
  function updatePriceFlash(token: Kong.Token) {
    const currentPrice = Number(token.metrics?.price || 0);
    const prevPrice = $previousPrices.get(token.address);

    // First update the previous price to avoid race conditions
    previousPrices.update(prices => {
      prices.set(token.address, currentPrice);
      return prices;
    });

    // Only compare and flash after the initial refresh cycle is complete
    if ($isInitialRefreshCycleDone && prevPrice !== undefined && prevPrice > 0 && currentPrice > 0 && prevPrice !== currentPrice) {
      const flashClass = currentPrice > prevPrice ? "flash-green" : "flash-red";
      
      // Clean up existing timeout to avoid memory leaks
      priceFlashStates.update(states => {
        if (states.has(token.address)) {
          clearTimeout(states.get(token.address)!.timeout);
        }
        
        // Create a new timeout
        const timeout = setTimeout(() => {
          priceFlashStates.update(currentStates => {
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
      const [{tokens, total_count}, totalsResult] = await Promise.all([
        fetchTokens({ 
          page: $currentPage, 
          limit: ITEMS_PER_PAGE,
          search: $debouncedSearchTerm,
        }),
        fetchPoolTotals()
      ]);

      tokenData.set(tokens);
      totalCount.set(total_count);
      poolTotals.set(totalsResult);
      tokens.forEach(updatePriceFlash);
    } catch (error) {
      console.error('Error refreshing data:', error);
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
    
    if (currentDebouncedTerm !== undefined && currentDebouncedTerm !== lastSearchTerm && !isUrlUpdateInProgress) {
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
    if (browser && $page.url.pathname === '/stats') {
      // Initial data load
      if (!isInitialLoadDone) {
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
    if (browser && $page.url.pathname === '/stats' && 
        ($currentPage !== undefined || $debouncedSearchTerm !== undefined)) {
      
      // Clear previous timeout to avoid race conditions
      if (urlUpdateTimeout) clearTimeout(urlUpdateTimeout);
      
      // Debounce URL updates to ensure we're not updating too frequently
      urlUpdateTimeout = setTimeout(() => {
        const url = new URL(window.location.href);
        
        const currentPageString = $currentPage.toString();
        const urlPageParam = url.searchParams.get('page') || '1';
        
        if (currentPageString !== urlPageParam) {
          url.searchParams.set('page', currentPageString);
        }
        
        const currentSearchTerm = $debouncedSearchTerm;
        const urlSearchParam = url.searchParams.get('search') || '';
        
        if (currentSearchTerm !== urlSearchParam) {
          if (currentSearchTerm) {
            url.searchParams.set('search', currentSearchTerm);
          } else {
            url.searchParams.delete('search');
          }
        }
        
        const newUrl = url.toString();
        
        // Only update URL if it actually changed to prevent excessive history API calls
        if (newUrl !== lastUrlUpdate) {
          lastUrlUpdate = newUrl;
          isUrlUpdateInProgress = true;
          goto(newUrl, { replaceState: true, keepFocus: true })
            .then(() => {
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
      favoriteStore.loadFavorites().then(favorites => favoriteTokenIds.set(favorites));
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
      // Get initial parameters from URL
      const urlParams = new URLSearchParams(window.location.search);
      const pageParam = parseInt(urlParams.get('page') || '1');
      const searchParam = urlParams.get('search') || '';
      
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
      const handleResize = () => (isMobile = window.innerWidth < 768);
      window.addEventListener("resize", handleResize, { passive: true });
      return () => window.removeEventListener("resize", handleResize);
    }
  });

  // Filtered tokens derived store
  const filteredTokens = derived(
    [tokenData, favoriteTokenIds, showFavoritesOnly],
    ([$tokenData, $favoriteTokenIds, $showFavoritesOnly]) => 
      $showFavoritesOnly 
        ? $tokenData.filter(token => $favoriteTokenIds.includes(token.address))
        : $tokenData
  );

  // Helper functions
  function getTrendClass(token: FE.StatsToken): string {
    const change = token?.metrics?.price_change_24h;
    if (!change) return "";
    return Number(change) > 0 ? "text-kong-text-accent-green" : 
           Number(change) < 0 ? "text-kong-accent-red" : "";
  }

  function isTopVolume(token: FE.StatsToken): boolean {
    if (token.address === CKUSDT_CANISTER_ID || token.address === ICP_CANISTER_ID)
      return false;
      
    return token.volumeRank !== undefined && 
           token.volumeRank <= 7 && 
           Number(token.metrics?.volume_24h || 0) > 0;
  }

  function toggleSort(newSortBy: string) {
    if ($sortBy === newSortBy) {
      sortDirection.update(direction => direction === "desc" ? "asc" : "desc");
    } else {
      sortBy.set(newSortBy);
      sortDirection.set("desc");
    }
  }

  // Table columns configuration
  const tableColumns = [
    {
      key: 'token',
      title: 'Token',
      align: 'left' as 'left' | 'right' | 'center',
      component: TokenCell,
      sortable: true
    },
    {
      key: 'price',
      title: 'Price',
      align: 'right' as 'left' | 'right' | 'center',
      sortable: true,
      component: PriceCell,
      componentProps: {
        priceFlashStates: $priceFlashStates
      }
    },
    {
      key: 'price_change_24h',
      title: '24h',
      align: 'right' as 'left' | 'right' | 'center',
      sortable: true,
      formatter: (row) => {
        const value = row.metrics?.price_change_24h || 0;
        return `${value > 0 ? '+' : ''}${formatToNonZeroDecimal(value)}%`;
      }
    },
    {
      key: 'volume_24h',
      title: 'Vol',
      align: 'right' as 'left' | 'right' | 'center',
      sortable: true,
      formatter: (row) => formatUsdValue(row.metrics?.volume_24h || 0)
    },
    {
      key: 'market_cap',
      title: 'MCap',
      align: 'right' as 'left' | 'right' | 'center',
      sortable: true,
      formatter: (row) => formatUsdValue(row.metrics?.market_cap || 0)
    },
    {
      key: 'tvl',
      title: 'TVL',
      align: 'right' as 'left' | 'right' | 'center',
      sortable: true,
      formatter: (row) => formatUsdValue(row.metrics?.tvl || 0)
    }
  ];
</script>

<svelte:head>
  <title>Market Stats - KongSwap</title>
</svelte:head>

<PageHeader
  title="Market Stats"
  description="Track token performance and market activity"
  icon={TrendingUp}
  stats={[
    {
      label: "Vol 24H",
      value: `${formatUsdValue($poolTotals.total_volume_24h)}`,
      icon: TrendingUp,
    },
    {
      label: "TVL",
      value: `${formatUsdValue($poolTotals.total_tvl)}`,
      icon: PiggyBank,
    },
    {
      label: "Fees 24H",
      value: `${formatUsdValue($poolTotals.total_fees_24h)}`,
      icon: HandCoins,
      hideOnMobile: true,
    },
  ]}
/>

<section class="flex flex-col w-full px-2 max-h-[calc(100vh-15rem)] mt-4 h-[calc(100vh-6rem)]">
  <div class="z-10 flex flex-col lg:flex-row w-full mx-auto gap-4 max-w-[1300px] h-[calc(100vh-15rem)]">
    <Panel
      type="main"
      className="content-panel flex-1 !p-0"
      height="100%"
    >
      <div class="flex flex-col h-full !rounded-lg">
        <!-- Header -->
        <div class="flex flex-col gap-3 sm:gap-0 sticky top-0 z-10 backdrop-blur-md rounded-t-lg">
          <div class="hidden sm:flex items-center gap-3 py-1 border-b border-kong-border">
            <div class="flex bg-transparent">
              <button
                class="px-4 py-1 transition-colors duration-200 {!$showFavoritesOnly ? 'text-kong-text-primary' : 'text-kong-text-secondary hover:text-kong-text-primary'}"
                on:click={() => showFavoritesOnly.set(false)}
              >
                All Tokens
              </button>
              <button
                class="px-4 py-1 transition-colors duration-200 {$showFavoritesOnly ? 'text-kong-text-primary' : 'text-kong-text-secondary hover:text-kong-text-primary'}"
                on:click={() => showFavoritesOnly.set(true)}
              >
                My Favorites
                {#if $auth.isConnected}
                  <span class="ml-1 px-2 py-0.5 text-kong-text-primary/80 bg-kong-primary/60 rounded text-xs">
                    {$favoriteCount}
                  </span>
                {/if}
              </button>
            </div>

            <div class="flex-1 px-4 py-2">
              <input
                type="text"
                placeholder={isMobile ? "Search tokens..." : "Search tokens by name, symbol, or canister ID"}
                class="w-full bg-transparent text-kong-text-primary placeholder-[#8890a4] focus:outline-none"
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
              <div class="h-4 w-32 bg-kong-surface-light rounded mb-4"></div>
              <div class="h-4 w-48 bg-kong-surface-light rounded"></div>
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
          <div class="flex-1 {$panelRoundness} h-full overflow-auto {isMobile ? 'h-[calc(100vh-8rem)]' : 'h-[calc(100vh-1rem)]'}">
            {#if !isMobile}
              <DataTable
                data={$filteredTokens}
                rowKey="canister_id"
                isLoading={$isLoading}
                columns={tableColumns}
                itemsPerPage={ITEMS_PER_PAGE}
                defaultSort={{ column: 'market_cap', direction: 'desc' }}
                onRowClick={(row) => goto(`/stats/${row.address}`)}
                isKongRow={(row) => row.address === KONG_CANISTER_ID}
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
                      class="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm {$sortBy === 'market_cap' ? 'bg-kong-primary text-white' : 'bg-kong-surface-light'}"
                      on:click={() => toggleSort("market_cap")}
                    >
                      MCap
                      <ChevronDown
                        size={16}
                        class="transition-transform {$sortDirection === 'asc' && $sortBy === 'market_cap' ? 'rotate-180' : ''}"
                      />
                    </button>
                    <button
                      class="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm {$sortBy === 'volume' ? 'bg-kong-primary text-white' : 'bg-kong-surface-light'}"
                      on:click={() => toggleSort("volume")}
                    >
                      Volume
                      <ChevronDown
                        size={16}
                        class="transition-transform {$sortDirection === 'asc' && $sortBy === 'volume' ? 'rotate-180' : ''}"
                      />
                    </button>
                    <button
                      class="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm {$sortBy === 'price_change' ? 'bg-kong-primary text-white' : 'bg-kong-surface-light'}"
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
                    {#each $filteredTokens as token (token.address)}
                      <button
                        class="w-full"
                        on:click={() => goto(`/stats/${token.address}`)}
                      >
                        <TokenCardMobile
                          {token}
                          isConnected={$auth.isConnected}
                          isFavorite={$favoriteTokenIds.includes(token.address)}
                          trendClass={getTrendClass(token)}
                          showHotIcon={isTopVolume(token)}
                        />
                      </button>
                    {/each}
                  </div>
                </div>

                <!-- Mobile Pagination -->
                <div class="sticky bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2 border-t border-kong-border backdrop-blur-md !rounded-b-lg">
                  <button
                    class="px-3 py-1 rounded text-sm {$currentPage === 1 ? 'text-kong-text-secondary bg-kong-bg-dark opacity-50 cursor-not-allowed' : 'text-kong-text-primary bg-kong-primary/20 hover:bg-kong-primary/30'}"
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
                    Page {$currentPage} of {Math.max(1, Math.ceil($totalCount / ITEMS_PER_PAGE))}
                  </span>
                  <button
                    class="px-3 py-1 rounded text-sm {$currentPage >= Math.ceil($totalCount / ITEMS_PER_PAGE) ? 'text-kong-text-secondary bg-kong-bg-dark opacity-50 cursor-not-allowed' : 'text-kong-text-primary bg-kong-primary/20 hover:bg-kong-primary/30'}"
                    on:click={() => {
                      if ($currentPage < Math.ceil($totalCount / ITEMS_PER_PAGE)) {
                        isPageChange.set(true);
                        currentPage.set($currentPage + 1);
                      }
                    }}
                    disabled={$currentPage >= Math.ceil($totalCount / ITEMS_PER_PAGE)}
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
  @keyframes loading {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
</style>
