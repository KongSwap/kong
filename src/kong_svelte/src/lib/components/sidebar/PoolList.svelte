<script lang="ts">
  import { fade, slide } from "svelte/transition";
  import { liveUserPools } from "$lib/services/pools/poolStore";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { goto } from "$app/navigation";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { ChevronRight, Search, X, ArrowUpDown, Loader2 } from "lucide-svelte";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import { PoolService } from "$lib/services/pools";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { onMount } from "svelte";

  interface FilterPair {
    token0?: string;
    token1?: string;
  }

   // Add TypeScript interfaces
   interface UserPool {
    symbol_0?: string;
    symbol_1?: string;
    balance: string;
    usd_balance: string | number;
    name?: string;
    searchableText?: string;
    token0?: FE.Token;
    token1?: FE.Token;
  }

  // Typed props
  export let filterPair: FilterPair = {};
  export let filterToken = "";
  export let initialSearch = "";
  export let pool: UserPool | null = null;

  // State variables
  let loading = true;
  let error: string | null = null;
  let processedPools: UserPool[] = [];
  let selectedPool: UserPool | null = null;
  let showUserPoolModal = false;
  let searchQuery = initialSearch;
  let searchInput: HTMLInputElement;
  let isSearching = false;
  let searchResultsReady = false;
  let initialFilterApplied = false;
  let UserPoolComponent: any;
  let sortDirection: "asc" | "desc" = "desc";
  let tokens: Record<string, FE.Token> = {};
  let tokensLoading = false;
  let poolsProcessed = false;
  let lastFetchedTokenIds: string[] = [];

  // Memoized search state
  const SEARCH_DEBOUNCE = 150;
  let searchDebounceTimer: ReturnType<typeof setTimeout>;
  $: debouncedSearchQuery = createDebouncedSearch(searchQuery);

  onMount(() => {
    PoolService.fetchUserPoolBalances(true);
  });

  function createDebouncedSearch(query: string): string {
    if (
      !initialFilterApplied ||
      searchQuery !== `${pool?.symbol_0}/${pool?.symbol_1}`
    ) {
      isSearching = true;
      searchResultsReady = false;
      clearTimeout(searchDebounceTimer);

      searchDebounceTimer = setTimeout(() => {
        searchResultsReady = true;
        isSearching = false;
      }, SEARCH_DEBOUNCE);
    }
    return query.toLowerCase();
  }

  let currentTokenFetch: Promise<void> | null = null;

  function areTokenIdsEqual(ids1: string[], ids2: string[]): boolean {
    if (ids1.length !== ids2.length) return false;
    const set1 = new Set(ids1);
    return ids2.every(id => set1.has(id));
  }

  async function fetchTokensForPools(pools: any[]): Promise<void> {
    if (pools.length === 0) return;
    
    const tokenIds = [...new Set(pools.flatMap(pool => [pool.address_0, pool.address_1]))];

    // Skip if we're already loading these exact tokens
    if (tokensLoading && areTokenIdsEqual(tokenIds, lastFetchedTokenIds)) {
      return;
    }

    // Skip if we already have all these tokens cached
    if (tokenIds.every(id => tokens[id])) {
      processPoolsWithTokens();
      return;
    }
    
    tokensLoading = true;
    lastFetchedTokenIds = tokenIds;
    
    try {
      // Create a new fetch promise
      const fetchPromise = (async () => {
        try {
          const fetchedTokens = await fetchTokensByCanisterId(tokenIds);
          tokens = {
            ...tokens,
            ...fetchedTokens.reduce((acc, token) => {
              acc[token.canister_id] = token;
              return acc;
            }, {} as Record<string, FE.Token>)
          };
        } catch (e) {
          error = "Failed to load token information";
          console.error("Error fetching tokens:", e);
        } finally {
          tokensLoading = false;
          poolsProcessed = true;
        }
      })();

      // Store the current fetch promise
      currentTokenFetch = fetchPromise;
      
      // Wait for the fetch to complete
      await fetchPromise;
      
      // Only process if this was the last fetch initiated
      if (currentTokenFetch === fetchPromise) {
        processPoolsWithTokens();
      }
    } catch (e) {
      error = "Failed to load token information";
      console.error("Error fetching tokens:", e);
      tokensLoading = false;
      poolsProcessed = true;
    }
  }

  // Optimize pool processing with memoization
  function processPool(poolBalance: UserPoolBalance) {
    const token0 = tokens[poolBalance.address_0];
    const token1 = tokens[poolBalance.address_1];

    const searchTerms = [
      poolBalance.symbol_0,
      poolBalance.symbol_1,
      `${poolBalance.symbol_0}/${poolBalance.symbol_1}`,
      poolBalance.name || "",
      token0?.name || "",
      token1?.name || "",
      token0?.canister_id || "",
      token1?.canister_id || "",
      getTokenAliases(poolBalance.symbol_0),
      getTokenAliases(poolBalance.symbol_1),
    ];

    return {
      ...poolBalance,
      token0,
      token1,
      searchableText: searchTerms.filter(Boolean).join(" ").toLowerCase(),
    };
  }

  function getTokenAliases(symbol: string): string {
    const aliases: Record<string, string> = {
      ICP: "internet computer protocol dfinity",
      USDT: "tether usdt",
      BTC: "bitcoin btc",
      ETH: "ethereum eth",
    };
    return aliases[symbol] || "";
  }

  function processPoolsWithTokens(): void {
    if (!Array.isArray($liveUserPools)) return;
    
    const validPools = $liveUserPools.filter((poolBalance) => Number(poolBalance.balance) > 0);
    const processed = validPools.map((poolBalance) => processPool(poolBalance));
    processedPools = sortPools(processed as UserPool[]); // Apply initial sort

    if (pool && !initialFilterApplied) {
      searchQuery = `${pool.symbol_0}/${pool.symbol_1}`;
      debouncedSearchQuery = searchQuery.toLowerCase();
      initialFilterApplied = true;
      searchResultsReady = true;
      isSearching = false;
    }

    loading = false;
  }

  // Optimize pool filtering
  function filterPools(pools: UserPool[]): UserPool[] {
    const filtered = pools.filter((poolItem) => {
      if (pool) {
        return (
          poolItem.symbol_0 === pool.symbol_0 &&
          poolItem.symbol_1 === pool.symbol_1
        );
      }

      if (debouncedSearchQuery) {
        return poolItem.searchableText?.includes(debouncedSearchQuery);
      }

      if (filterPair.token0 && filterPair.token1) {
        return (
          (poolItem.symbol_0 === filterPair.token0 &&
            poolItem.symbol_1 === filterPair.token1) ||
          (poolItem.symbol_0 === filterPair.token1 &&
            poolItem.symbol_1 === filterPair.token0)
        );
      }

      if (filterToken) {
        return (
          poolItem.symbol_0 === filterToken || poolItem.symbol_1 === filterToken
        );
      }

      return true;
    });

    return filtered;
  }

  // Add separate sort function
  function sortPools(pools: UserPool[]): UserPool[] {
    return [...pools].sort((a, b) => {
      const aValue = Number(a.usd_balance) || 0;
      const bValue = Number(b.usd_balance) || 0;
      return sortDirection === "desc" ? bValue - aValue : aValue - bValue;
    });
  }

  // Combined reactive statement for pool processing
  $: {
    if (Array.isArray($liveUserPools)) {
      const validPools = $liveUserPools.filter((poolBalance) => Number(poolBalance.balance) > 0);
      
      if (validPools.length > 0) {
        fetchTokensForPools(validPools);
      } else {
        loading = false;
        processedPools = [];
        poolsProcessed = true;
      }
    } else {
      processedPools = [];
      poolsProcessed = true;
    }
  }

  // Update the reactive statement for filtered pools to only sort once
  $: filteredPools = filterPools(processedPools);

  // Add a new reactive statement to handle sorting
  $: {
    if (filteredPools.length > 0) {
      filteredPools = sortPools(filteredPools);
    }
  }

  // Event handlers
  const handleAddLiquidity = () => {
    goto("/pools/add");
    sidebarStore.collapse();
  };

  const handlePoolItemClick = async (poolItem: UserPool) => {
    if (!UserPoolComponent) {
      UserPoolComponent = (
        await import("$lib/components/liquidity/pools/UserPool.svelte")
      ).default;
    }
    selectedPool = poolItem;
    showUserPoolModal = true;
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && searchQuery) {
      event.preventDefault();
      searchQuery = "";
      searchInput.focus();
    } else if (event.key === "/" && document.activeElement !== searchInput) {
      event.preventDefault();
      searchInput.focus();
    }
  };

  // Update the sort toggle handler
  function toggleSort() {
    sortDirection = sortDirection === "desc" ? "asc" : "desc";
    // Force a re-sort when direction changes
    filteredPools = sortPools([...filteredPools]);
  }

  // Add a reactive statement to trigger resort when direction changes
  $: {
    if (processedPools.length > 0) {
      filteredPools = filterPools(processedPools);
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="pool-list-container" on:keydown={handleKeydown}>
  <div class="search-section">
    {#if !pool}
      <div class="search-bar">
        <div class="search-controls">
          <div class="search-input-wrapper">
            <div class="search-icon-wrapper">
              <Search size={16} />
            </div>
            <input
              bind:this={searchInput}
              bind:value={searchQuery}
              type="text"
              placeholder="Search pools by name or token..."
              class="search-input"
            />
            {#if searchQuery}
              <button
                class="clear-button"
                on:click={() => {
                  searchQuery = "";
                  searchInput.focus();
                }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            {/if}
          </div>

          <button
            class="sort-toggle"
            on:click={toggleSort}
            aria-label={`Sort by value ${sortDirection === "desc" ? "ascending" : "descending"}`}
          >
            <span class="toggle-label">Value</span>
            <div
              class="sort-icon-wrapper"
              class:ascending={sortDirection === "asc"}
            >
              <ArrowUpDown size={14} />
            </div>
          </button>
        </div>

        <button
          class="add-position-button"
          on:click={handleAddLiquidity}
          aria-label="Add new position"
        >
          +
        </button>
      </div>
    {/if}
  </div>

  <div class="pool-list-content">
    <div class="pool-list">
      {#if loading && processedPools.length === 0}
        <div class="empty-state" in:fade>
          <Loader2 class="animate-spin" size={20} />
          <p>Loading positions...</p>
        </div>
      {:else if !pool && (isSearching || !searchResultsReady)}
        <div class="empty-state" in:fade>
          <Loader2 class="animate-spin" size={20} />
          <p>Finding pools...</p>
        </div>
      {:else if error}
        <div class="state-message error" in:fade>
          <p>{error}</p>
          <button
            class="retry-button"
            on:click={() => PoolService.fetchUserPoolBalances(true)}
          >
            Retry
          </button>
        </div>
      {:else if filteredPools.length === 0}
        <div class="state-message" in:fade>
          {#if searchQuery && !pool}
            <p>No pools found matching "{searchQuery}"</p>
            <button
              class="clear-search-button"
              on:click={() => {
                searchQuery = "";
                searchInput.focus();
              }}
            >
              Clear Search
            </button>
          {:else if !pool}
            <p>No active positions</p>
            <button class="add-first-position" on:click={handleAddLiquidity}>
              Add Your First Position
            </button>
          {:else}
            <p>No matching pool found</p>
          {/if}
        </div>
      {:else}
        {#each filteredPools as poolItem}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="pool-item"
            in:slide={{ duration: 200 }}
            on:click={() => handlePoolItemClick(poolItem)}
            role="button"
            tabindex="0"
          >
            <div class="pool-content">
              <div class="pool-left">
                <div class="token-images-wrapper">
                  <TokenImages
                    tokens={[
                      poolItem.token0,
                      poolItem.token1
                    ]}
                    size={32}
                    overlap={true}
                  />
                </div>
                <div class="pool-info">
                  <div class="pool-pair">
                    {poolItem.symbol_0}/{poolItem.symbol_1}
                  </div>
                  <div class="pool-balance">
                    {Number(poolItem.balance).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 8,
                    })} LP
                  </div>
                </div>
              </div>
              <div class="pool-right">
                <div class="value-info">
                  <div class="usd-value">
                    ${formatToNonZeroDecimal(poolItem.usd_balance)}
                  </div>
                </div>
                <div class="view-details">
                  <ChevronRight size={18} class="details-arrow" />
                </div>
              </div>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>

{#if selectedPool && UserPoolComponent}
  <svelte:component
    this={UserPoolComponent}
    pool={selectedPool}
    bind:showModal={showUserPoolModal}
    on:close={() => (showUserPoolModal = false)}
  />
{/if}

<style lang="postcss">
  .pool-list-container {
    @apply flex flex-col h-[87dvh] relative;
  }

  .search-section {
    @apply sticky top-0 z-20 bg-kong-bg-light;
    @apply border-b border-kong-border;
  }

  .pool-list-content {
    @apply flex-1 overflow-hidden relative;
  }

  .pool-list {
    @apply absolute inset-0 overflow-y-auto py-1.5 px-2;
  }

  .search-bar {
    @apply flex items-center justify-between p-3 gap-3;
  }

  .search-controls {
    @apply flex items-center gap-2 flex-1;
  }

  .search-input-wrapper {
    @apply relative flex items-center flex-1 bg-kong-bg-dark/30 rounded-lg border border-kong-border/40;
  }

  .search-icon-wrapper {
    @apply absolute left-3 z-10 flex items-center pointer-events-none;
  }

  .search-input {
    @apply w-full bg-transparent border-none py-2 pl-9 pr-3.5 text-sm
           text-kong-text-primary placeholder-kong-text-secondary/70 
           focus:outline-none focus:ring-1 focus:ring-kong-accent-blue/40;
  }

  .clear-button {
    @apply absolute right-2 text-kong-text-secondary hover:text-kong-text-primary transition-colors p-1;
  }

  .sort-toggle {
    @apply flex items-center gap-2 text-xs text-kong-text-secondary 
           hover:text-white transition-colors whitespace-nowrap bg-kong-bg-dark/30
           px-3 py-2.5 rounded-lg border border-kong-border/40
           hover:border-kong-accent-blue/30 hover:bg-kong-bg-dark/40
           active:scale-[0.98];
  }

  .sort-icon-wrapper {
    @apply transition-transform duration-200;
  }

  .sort-icon-wrapper.ascending {
    @apply rotate-180;
  }

  .add-position-button {
    @apply px-4 py-1.5 bg-kong-accent-blue/90 text-white text-sm font-medium rounded-lg
           transition-all duration-200 hover:bg-kong-accent-blue hover:scale-[0.98]
           active:scale-[0.96] shadow-lg shadow-kong-accent-blue/20 flex-shrink-0;
  }

  .pool-item {
    @apply bg-kong-bg-dark/20 rounded-lg p-4 cursor-pointer 
           hover:bg-kong-bg-dark/30 transition-all duration-200
           border border-kong-border/40 hover:border-kong-accent-blue/30
           hover:shadow-lg hover:shadow-kong-accent-blue/5
           active:scale-[0.995] mb-1.5 last:mb-0;
  }

  .pool-content {
    @apply flex justify-between items-center w-full gap-4;
  }

  .pool-left {
    @apply flex items-center gap-3.5;
  }

  .token-images-wrapper {
    @apply flex-shrink-0;
  }

  .pool-info {
    @apply flex flex-col gap-1;
  }

  .pool-pair {
    @apply text-sm font-medium text-kong-text-primary tracking-wide;
  }

  .pool-balance {
    @apply text-xs text-kong-text-secondary/80 font-medium tracking-wide;
  }

  .pool-right {
    @apply flex items-center gap-3;
  }

  .value-info {
    @apply flex flex-col items-end;
  }

  .usd-value {
    @apply text-sm font-medium text-kong-text-primary tracking-wide;
  }

  .view-details {
    @apply text-xs text-kong-text-secondary/60 flex items-center transition-colors
           group-hover:text-kong-text-secondary;
  }

  .clear-search-button {
    @apply px-4 py-2 bg-kong-bg-dark/40 text-kong-text-secondary text-xs font-medium rounded-lg
           transition-all duration-200 hover:bg-kong-bg-dark/60 hover:text-kong-text-primary
           border border-kong-border/40 hover:border-kong-accent-blue/30;
  }

  .state-message {
    @apply flex flex-col items-center justify-center gap-4 min-h-[200px] 
           text-kong-text-secondary/80 text-sm p-6 text-center;
  }

  .loading-spinner {
    @apply w-6 h-6 border-2 border-kong-accent-blue/30 border-t-kong-accent-blue
           rounded-full animate-spin;
  }

  .error {
    @apply text-red-400;
  }

  .retry-button,
  .clear-search-button,
  .add-first-position {
    @apply px-4 py-2 bg-kong-bg-dark/40 text-kong-text-secondary text-xs font-medium rounded-lg
           transition-all duration-200 hover:bg-kong-bg-dark/60 hover:text-kong-text-primary
           border border-kong-border/40 hover:border-kong-accent-blue/30
           active:scale-[0.98];
  }

  .add-first-position {
    @apply bg-kong-accent-blue/90 text-white hover:bg-kong-accent-blue 
           hover:text-white border-transparent;
  }

  .empty-state {
    @apply flex flex-col items-center justify-center gap-2
           min-h-[120px] text-kong-text-secondary text-xs;
  }
</style>
