<script lang="ts">
  import { fade, slide } from "svelte/transition";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { ChevronRight, Search, X, ArrowUpDown, BarChart3, ChartPie } from "lucide-svelte";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { calculateUserPoolPercentage } from "$lib/utils/liquidityUtils";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
  import { livePools } from "$lib/services/pools/poolStore";
  import { auth } from "$lib/services/auth";
  import LoadingIndicator from "$lib/components/common/LoadingIndicator.svelte";

  interface UserPoolBalance {
    symbol_0: string;
    symbol_1: string;
    balance: string;
    usd_balance: string;
    name?: string;
    address_0: string;
    address_1: string;
    amount_0: string;
    amount_1: string;
  }

  interface ProcessedPool extends UserPoolBalance {
    searchableText: string;
    token0?: FE.Token;
    token1?: FE.Token;
  }

  export let pool: ProcessedPool | null = null;

  // --- Store ---
  let searchInput: HTMLInputElement;
  let selectedPool: ProcessedPool | null = null;
  let showUserPoolModal = false;
  let UserPoolComponent: any;
  
  // Simple flag for initial load only
  let hasCompletedInitialLoad = false;
  
  // Cache for pools
  let cachedPools: ProcessedPool[] = [];
  
  // Update cache whenever we have valid data (not during loading)
  $: if ($currentUserPoolsStore.filteredPools.length > 0 && !$currentUserPoolsStore.loading) {
    cachedPools = [...$currentUserPoolsStore.filteredPools];
  }
  
  // Always use cached pools after initial load if we have them
  $: displayPools = (!hasCompletedInitialLoad) 
    ? $currentUserPoolsStore.filteredPools 
    : (cachedPools.length > 0 ? cachedPools : $currentUserPoolsStore.filteredPools);
  
  // Only show loading indicator on initial load
  $: showLoadingIndicator = $currentUserPoolsStore.loading && !hasCompletedInitialLoad;

  // Initialize store and handle auth changes
  onMount(() => {
    const unsubscribe = auth.subscribe(($auth) => {
      if ($auth.isConnected) {
        loadUserPools();
      } else {
        currentUserPoolsStore.reset();
        hasCompletedInitialLoad = false;
        cachedPools = []; // Clear cache when disconnected
      }
    });

    return () => {
      unsubscribe();
    };
  });
  
  // Function to load user pools - simpler now
  async function loadUserPools() {
    try {
      await currentUserPoolsStore.initialize();
      hasCompletedInitialLoad = true;
    } catch (error) {
      console.error("Error loading user pools:", error);
    }
  }
  
  // Function to refresh user pools without showing loading indicator
  async function refreshUserPools() {
    if (hasCompletedInitialLoad) {
      try {
        // Since refresh() doesn't exist, we can re-initialize the store 
        // which effectively refreshes the data
        await currentUserPoolsStore.initialize();
      } catch (error) {
        console.error("Error refreshing user pools:", error);
      }
    }
  }

  // --- Event Handlers ---
  const handleAddLiquidity = () => {
    goto("/pools/add");
    sidebarStore.collapse();
  };

  const handlePoolItemClick = async (poolItem: ProcessedPool) => {
    if (!UserPoolComponent) {
      UserPoolComponent = (
        await import("$lib/components/liquidity/pools/UserPool.svelte")
      ).default;
    }
    selectedPool = poolItem;
    showUserPoolModal = true;
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && $currentUserPoolsStore.searchQuery) {
      event.preventDefault();
      currentUserPoolsStore.setSearchQuery("");
      searchInput.focus();
    } else if (event.key === "/" && document.activeElement !== searchInput) {
      event.preventDefault();
      searchInput.focus();
    }
  };

  // Get pool share percentage
  function getPoolSharePercentage(pool: ProcessedPool): string {
    const livePool = $livePools.find(
      (p) => p.address_0 === pool.address_0 && p.address_1 === pool.address_1
    );
    
    return calculateUserPoolPercentage(
      livePool?.balance_0,
      livePool?.balance_1,
      pool.amount_0,
      pool.amount_1
    );
  }

  // Get APY for a pool
  function getPoolApy(pool: ProcessedPool): string {
    const livePool = $livePools.find(
      (p) => p.address_0 === pool.address_0 && p.address_1 === pool.address_1
    );
    
    return livePool?.rolling_24h_apy ? formatToNonZeroDecimal(livePool.rolling_24h_apy) : "0";
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="pool-list-container flex flex-col" on:keydown={handleKeydown}>
  <div class="search-section bg-kong-bg-dark/50">
    {#if !pool}
      <div class="search-bar">
        <div class="search-controls">
          <div class="search-input-wrapper">
            <div class="search-icon-wrapper">
              <Search size={16} />
            </div>
            <input
              bind:this={searchInput}
              bind:value={$currentUserPoolsStore.searchQuery}
              type="text"
              placeholder="Search pools by name or token..."
              class="search-input"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
            />
            {#if $currentUserPoolsStore.searchQuery}
              <button
                class="clear-button"
                on:click={() => {
                  currentUserPoolsStore.setSearchQuery("");
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
            on:click={currentUserPoolsStore.toggleSort}
            aria-label={`Sort by value ${$currentUserPoolsStore.sortDirection === "desc" ? "ascending" : "descending"}`}
          >
            <span class="toggle-label">Value</span>
            <div
              class="sort-icon-wrapper"
              class:ascending={$currentUserPoolsStore.sortDirection === "asc"}
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

  <div class="pool-list-content rounded-b-lg">
    <div class="pool-list">
      {#if showLoadingIndicator}
        <div class="empty-state" in:fade>
          <LoadingIndicator text="Loading positions..." />
        </div>
      {:else if $currentUserPoolsStore.error}
        <div class="state-message error" in:fade>
          <p>{$currentUserPoolsStore.error}</p>
          <button
            class="retry-button"
            on:click={() => refreshUserPools()}
          >
            Retry
          </button>
        </div>
      {:else if displayPools.length === 0}
        <div class="state-message" in:fade>
          {#if $currentUserPoolsStore.searchQuery && !pool}
            <p>No pools found matching "{$currentUserPoolsStore.searchQuery}"</p>
            <button
              class="clear-search-button"
              on:click={() => {
                currentUserPoolsStore.setSearchQuery("");
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
        {#each displayPools as poolItem}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="bg-kong-bg-dark/20 rounded-lg p-3 cursor-pointer hover:bg-kong-bg-dark/30 transition-all duration-200 border border-kong-border/40 hover:border-kong-accent-blue/30 hover:shadow-lg hover:shadow-kong-accent-blue/5 active:scale-[0.995] mb-1.5 last:mb-0"
            in:slide={{ duration: 200 }}
            on:click={() => handlePoolItemClick(poolItem)}
            role="button"
            tabindex="0"
          >
            <div class="flex justify-between items-center w-full gap-4">
              <div class="flex items-center gap-3">
                <div class="flex-shrink-0">
                  <TokenImages
                    tokens={[
                      poolItem.token0,
                      poolItem.token1
                    ]}
                    size={32}
                    overlap={true}
                  />
                </div>
                <div class="flex flex-col gap-1">
                  <div class="text-sm font-medium text-kong-text-primary tracking-wide mb-0.5">
                    {poolItem.symbol_0}/{poolItem.symbol_1}
                  </div>
                  <div class="flex items-center gap-1">
                    <div class="flex items-center gap-1 text-xs whitespace-nowrap text-kong-text-primary/80">
                      <ChartPie size={14} />
                      <span>{formatToNonZeroDecimal(getPoolSharePercentage(poolItem))}% share</span>
                    </div>
                    <div class="h-3 w-px bg-kong-border/40"></div>
                    <div class="flex items-center gap-1 text-xs whitespace-nowrap text-kong-text-accent-green">
                      <BarChart3 size={14} />
                      <span>{formatToNonZeroDecimal(getPoolApy(poolItem))}% APY</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div class="flex flex-col items-end">
                  <div class="text-sm font-medium text-kong-text-primary tracking-wide">
                    ${formatToNonZeroDecimal(poolItem.usd_balance)}
                  </div>
                </div>
                <div class="text-xs text-kong-text-secondary/60 flex items-center transition-colors group-hover:text-kong-text-secondary">
                  <ChevronRight size={18} class="details-arrow" />
                </div>
              </div>
            </div>
          </div>
        {/each}
      {/if}
      
      {#if $currentUserPoolsStore.loading && hasCompletedInitialLoad}
        <div class="refresh-indicator">
          <LoadingIndicator size={16} />
        </div>
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
    on:liquidityRemoved={() => refreshUserPools()}
  />
{/if}

<style lang="postcss">
  .pool-list-container {
    @apply h-[calc(100vh-180px)] md:h-[calc(100vh-140px)] relative;
  }

  .search-section {
    @apply sticky top-0 z-20;
    @apply border-b border-kong-border;
  }

  .pool-list-content {
    @apply flex-1 overflow-hidden relative bg-kong-bg-light;
  }

  .pool-list {
    @apply absolute inset-0 overflow-y-auto py-1.5 px-2;
  }

  .search-bar {
    @apply flex items-center justify-between py-2 px-3 gap-3;
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
    font-size: 16px;
    -webkit-text-size-adjust: 100%;
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

  .state-message {
    @apply flex flex-col items-center justify-center gap-4 min-h-[200px] 
           text-kong-text-secondary/80 text-sm p-6 text-center;
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
  
  .refresh-indicator {
    @apply fixed bottom-4 right-4 bg-kong-bg-dark/80 backdrop-blur-sm
           rounded-full p-2 shadow-lg z-30;
  }
</style>

