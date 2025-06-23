<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { ChevronDown } from "lucide-svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import TokenCardMobile from "$lib/components/stats/TokenCardMobile.svelte";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import StatsGrid from "$lib/components/common/StatsGrid.svelte";
  import TokenCell from "$lib/components/stats/TokenCell.svelte";
  import PriceCell from "$lib/components/stats/PriceCell.svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { fetchTokens, fetchTopTokens } from "$lib/api/tokens/TokenApiClient";
  import { fetchPoolTotals } from "$lib/api/pools";
  import { panelRoundness } from "$lib/stores/derivedThemeStore";
  import PlatformStats from "$lib/components/stats/PlatformStats.svelte";
  import BiggestMovers from "$lib/components/stats/BiggestMovers.svelte";
  import TopVolume from "$lib/components/stats/TopVolume.svelte";
  import { page } from "$app/state";

  // Constants
  const REFRESH_INTERVAL = 10000;
  const DEFAULT_ITEMS_PER_PAGE = 50;

  // State using Svelte 5 runes
  let tokens = $state<FE.StatsToken[]>([]);
  let totalCount = $state(0);
  let currentPage = $state(1);
  let itemsPerPage = $state(DEFAULT_ITEMS_PER_PAGE);
  let searchTerm = $state("");
  let isLoading = $state(true);
  let poolTotals = $state({ total_volume_24h: 0, total_tvl: 0, total_fees_24h: 0 });
  let topTokens = $state({ gainers: [], losers: [], hottest: [], top_volume: [] });
  let sortBy = $state("market_cap");
  let sortDirection = $state<"asc" | "desc">("desc");

  // Price flash state
  let priceFlashStates = $state(new Map<string, { class: string; timeout: ReturnType<typeof setTimeout> }>());
  let previousPrices = $state(new Map<string, number>());

  // Local variables
  let isMobile = $state(false);
  let refreshInterval: ReturnType<typeof setInterval>;
  let searchTimeout: ReturnType<typeof setTimeout>;
  let isInitialLoad = true;

  // Derived values
  const topGainers = $derived(topTokens.gainers);
  const topLosers = $derived(topTokens.losers);
  const topVolumeTokens = $derived(topTokens.top_volume);

  // Sorted tokens for mobile
  const sortedTokens = $derived(() => {
    return [...tokens].sort((a, b) => {
      let aVal = 0, bVal = 0;
      switch (sortBy) {
        case "market_cap": aVal = Number(a.metrics?.market_cap || 0); bVal = Number(b.metrics?.market_cap || 0); break;
        case "price": aVal = Number(a.metrics?.price || 0); bVal = Number(b.metrics?.price || 0); break;
        case "volume": aVal = Number(a.metrics?.volume_24h || 0); bVal = Number(b.metrics?.volume_24h || 0); break;
        case "price_change": aVal = Number(a.metrics?.price_change_24h || 0); bVal = Number(b.metrics?.price_change_24h || 0); break;
      }
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });
  });

  // Price flash functionality
  function updatePriceFlashes(newTokens: FE.StatsToken[]) {
    if (isInitialLoad) {
      // On initial load, just store prices without flashing
      const newPrices = new Map(previousPrices);
      newTokens.forEach(token => {
        newPrices.set(token.address, Number(token.metrics?.price || 0));
      });
      previousPrices = newPrices;
      isInitialLoad = false;
      return;
    }

    // Create completely new Maps to ensure reactivity
    const currentPrices = new Map(previousPrices);
    const newFlashStates = new Map();
    
    // Copy existing flash states (excluding expired ones)
    const existingFlashStates = priceFlashStates;
    
    newTokens.forEach(token => {
      const currentPrice = Number(token.metrics?.price || 0);
      const prevPrice = currentPrices.get(token.address);
      
      if (prevPrice !== undefined && prevPrice !== currentPrice && currentPrice > 0) {
        const flashClass = currentPrice > prevPrice ? "flash-green" : "flash-red";
        
        // Clear existing timeout if any
        const existingState = existingFlashStates.get(token.address);
        if (existingState?.timeout) {
          clearTimeout(existingState.timeout);
        }
        
        // Set new flash state with timeout
        const timeout = setTimeout(() => {
          const newStates = new Map(priceFlashStates);
          newStates.delete(token.address);
          priceFlashStates = newStates;
        }, 2000);
        
        newFlashStates.set(token.address, { class: flashClass, timeout });
      }
      
      // Update current price
      currentPrices.set(token.address, currentPrice);
    });
    
    // Set the new states
    priceFlashStates = newFlashStates;
    previousPrices = currentPrices;
  }

  // Data fetching
  async function fetchData(showLoading = false) {
    if (showLoading) isLoading = true;
    
    try {
      const [tokensRes, totalsRes, topTokensRes] = await Promise.all([
        fetchTokens({ page: currentPage, limit: itemsPerPage, search: searchTerm }),
        fetchPoolTotals(),
        fetchTopTokens(),
      ]);

      // Update price flashes before updating state
      updatePriceFlashes(tokensRes.tokens);

      tokens = tokensRes.tokens;
      totalCount = tokensRes.total_count;
      poolTotals = totalsRes;
      topTokens = topTokensRes;
      isLoading = false;
    } catch (error) {
      console.error("Error fetching data:", error);
      isLoading = false;
    }
  }

  // Search handling with debounce
  function handleSearch(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    searchTerm = value;
    
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentPage = 1;
      updateURL();
      fetchData(true);
    }, 300);
  }

  // Page change
  function changePage(newPage: number) {
    currentPage = newPage;
    updateURL();
    fetchData(true);
  }

  // Page size change
  function changePageSize(newPageSize: number) {
    itemsPerPage = newPageSize;
    currentPage = 1;
    updateURL();
    fetchData(true);
  }

  // URL management
  function updateURL() {
    if (!browser) return;
    const url = new URL(page.url);
    
    url.searchParams.set("page", currentPage.toString());
    if (searchTerm) {
      url.searchParams.set("search", searchTerm);
    } else {
      url.searchParams.delete("search");
    }
    
    goto(url.toString(), { replaceState: true, keepFocus: true });
  }

  // Sorting for mobile
  function toggleSort(newSortBy: string) {
    if (sortBy === newSortBy && sortDirection === "desc") {
      sortDirection = "asc";
    } else {
      sortDirection = "desc";
    }
    sortBy = newSortBy;
  }



  // Helper functions
  function getTrendClass(token: FE.StatsToken): string {
    const change = token?.metrics?.price_change_24h;
    if (!change) return "";
    return Number(change) > 0 ? "text-kong-success" 
         : Number(change) < 0 ? "text-kong-error" : "";
  }

  // Table configuration (reactive to pass topTokens and priceFlashStates data)
  const tableColumns = $derived([
    { key: "#", title: "#", align: "center" as const, sortable: false, formatter: (row) => `${row.metrics?.market_cap_rank}` },
    { key: "token", title: "Token", align: "left" as const, component: TokenCell, sortable: false, componentProps: { topTokens } },
    { key: "price", title: "Price", align: "right" as const, sortable: false, component: PriceCell, componentProps: { priceFlashStates } },
    { key: "price_change_24h", title: "24h", align: "right" as const, sortable: false, formatter: (row) => {
      const value = row.metrics?.price_change_24h || 0;
      return `${value > 0 ? "+" : ""}${formatToNonZeroDecimal(value)}%`;
    }},
    { key: "volume_24h", title: "Vol", align: "right" as const, sortable: false, formatter: (row) => formatUsdValue(row.metrics?.volume_24h || 0) },
    { key: "market_cap", title: "MCap", align: "right" as const, sortable: false, formatter: (row) => formatUsdValue(row.metrics?.market_cap || 0) },
    { key: "tvl", title: "TVL(:MC)", align: "right" as const, sortable: false, isHtml: true, formatter: (row) => `<div class="flex flex-col gap-0">${formatUsdValue(row.metrics?.tvl || 0)}  <span class="text-xs text-kong-text-secondary">(${(Number(row.metrics?.tvl) / Number(row.metrics?.market_cap) * 100).toFixed(2)}%)</span></div>` },
  ]);

  // Initialize and cleanup
  onMount(() => {
    if (!browser) return;
    
    // Mobile detection
    isMobile = window.innerWidth < 768;
    const handleResize = () => { isMobile = window.innerWidth < 768; };
    window.addEventListener("resize", handleResize, { passive: true });

    // Initialize from URL
    const urlParams = new URLSearchParams(page.url.search);
    const pageParam = parseInt(urlParams.get("page") || "1");
    const search = urlParams.get("search") || "";
    
    currentPage = pageParam;
    searchTerm = search;
    
    // Initial fetch and setup interval
    fetchData(true);
    refreshInterval = setInterval(() => fetchData(false), REFRESH_INTERVAL);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (refreshInterval) clearInterval(refreshInterval);
      if (searchTimeout) clearTimeout(searchTimeout);
      
      // Clean up price flash timeouts
      priceFlashStates.forEach(state => {
        if (state.timeout) clearTimeout(state.timeout);
      });
    };
  });
</script>

<svelte:head>
  <title>Market Stats - KongSwap</title>
</svelte:head>

<section class="flex flex-col md:flex-row w-full gap-4 px-4">
  <!-- Sidebar -->
  <div class="w-full md:w-[330px] flex flex-col gap-2 order-1">
    <PlatformStats {poolTotals} {isLoading} />
    <BiggestMovers {topGainers} {topLosers} {isLoading} panelRoundness={$panelRoundness} />
    <TopVolume {topVolumeTokens} {isLoading} panelRoundness={$panelRoundness} />
  </div>

  <!-- Main Content -->
  <Panel type="main" className="flex flex-col !p-0 !w-full !shadow-none !border-none order-2" height="100%">
    <div class="flex flex-col h-full !rounded-lg">
      <!-- Search Header (Desktop) -->
      <div class="hidden sm:flex items-center mb-2 gap-2">
        <div class="relative flex-1">
          <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-kong-text-secondary pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder={isMobile ? "Search tokens..." : "Search tokens by name, symbol, or canister ID"}
            class="w-full pl-10 pr-4 py-2 rounded-xl bg-kong-bg-secondary/60 border border-kong-border/40 text-kong-text-primary placeholder-[#8890a4] focus:outline-none focus:border-kong-primary transition-all duration-200 shadow-sm"
            oninput={handleSearch}
            value={searchTerm}
          />
        </div>
      </div>

      <!-- Content -->
      {#if isLoading && sortedTokens().length === 0}
        <div class="flex flex-col items-center justify-center h-64 text-center">
          <div class="h-4 w-32 bg-kong-bg-secondary rounded mb-4"></div>
          <div class="h-4 w-48 bg-kong-bg-secondary rounded"></div>
        </div>
      {:else if sortedTokens().length === 0}
        <div class="flex flex-col items-center justify-center h-64 text-center">
          <p class="text-gray-400">No tokens found matching your search criteria</p>
        </div>
      {:else}
        <div class="flex-1 {$panelRoundness}">
          {#if !isMobile}
            <StatsGrid
              data={sortedTokens()}
              rowKey="canister_id"
              {isLoading}
              columns={tableColumns}
              {itemsPerPage}
              defaultSort={{ column: "market_cap", direction: "desc" }}
              onRowClick={(row) => goto(`/stats/${row.address}`)}
              totalItems={totalCount}
              {currentPage}
              onPageChange={changePage}
              onPageSizeChange={changePageSize}
            />
          {:else}
            <!-- Mobile View -->
            <div class="flex flex-col h-full overflow-hidden">
              <!-- Mobile Filters -->
              <div class="sticky top-0 z-30 backdrop-blur-md border-b border-kong-border/50">
                <div class="flex gap-1.5 sm:px-3 py-3 justify-between">
                  {#each [
                    { key: "market_cap", label: "MCap" },
                    // { key: "price", label: "Price" },
                    { key: "volume", label: "Volume" },
                    { key: "price_change", label: "% (24h)" }
                  ] as sort}
                    <button
                      class="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 {sortBy === sort.key
                        ? 'bg-kong-primary text-kong-text-on-primary shadow-md'
                        : 'bg-kong-bg-primary/40 text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-bg-primary/60'}"
                      onclick={() => toggleSort(sort.key)}
                    >
                      {sort.label}
                      <ChevronDown size={14} class="transition-transform {sortDirection === 'asc' && sortBy === sort.key ? 'rotate-180' : ''}" />
                    </button>
                  {/each}
                </div>
              </div>

              <!-- Token List -->
              <div class="flex-1 overflow-auto">
                <div class="flex flex-col gap-1 py-2">
                  {#each sortedTokens() as token (token.address)}
                    <button class="w-full" onclick={() => goto(`/stats/${token.address}`)}>
                      <TokenCardMobile {token} trendClass={getTrendClass(token)} showIcons={true} section="stats-list" paddingClass="px-3 py-1.5" {topTokens} />
                    </button>
                  {/each}
                </div>
              </div>

              <!-- Mobile Pagination -->
              <div class="sticky bottom-0 flex items-center justify-between px-4 py-2 border-t border-kong-border backdrop-blur-md !rounded-b-lg">
                <button
                  class="px-3 py-1 rounded text-sm {currentPage === 1 ? 'text-kong-text-secondary bg-kong-bg-secondary opacity-50 cursor-not-allowed' : 'text-kong-text-primary bg-kong-primary/20 hover:bg-kong-primary/30'}"
                  onclick={() => changePage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <span class="text-sm text-kong-text-secondary">
                  Page {currentPage} of {Math.max(1, Math.ceil(totalCount / itemsPerPage))}
                </span>
                <button
                  class="px-3 py-1 rounded text-sm {currentPage >= Math.ceil(totalCount / itemsPerPage) ? 'text-kong-text-secondary bg-kong-bg-secondary opacity-50 cursor-not-allowed' : 'text-kong-text-primary bg-kong-primary/20 hover:bg-kong-primary/30'}"
                  onclick={() => changePage(currentPage + 1)}
                  disabled={currentPage >= Math.ceil(totalCount / itemsPerPage)}
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
