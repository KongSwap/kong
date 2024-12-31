<script lang="ts">
  import { fade, slide } from "svelte/transition";
  import { auth } from "$lib/services/auth";
  import { liveUserPools } from "$lib/services/pools/poolStore";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { liveTokens } from "$lib/services/tokens/tokenStore";
  import { goto } from "$app/navigation";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { ChevronRight, Search, X, ArrowUpDown } from "lucide-svelte";
  import { sidebarStore } from "$lib/stores/sidebarStore";
    import { PoolService } from "$lib/services/pools";

  export let filterPair: {token0?: string, token1?: string} = {}; // Filter by specific token pair
  export let filterToken: string = ''; // Filter by single token
  export let initialSearch: string = ""; // Initial search term
  export let pool: any = null; // Single pool to display

  let loading = true;
  let error: string | null = null;
  let processedPools: any[] = [];
  let selectedPool = null;
  let showUserPoolModal = false;
  let searchQuery = initialSearch;
  let searchInput: HTMLInputElement;
  let searchDebounceTimer: NodeJS.Timeout;
  let debouncedSearchQuery = '';
  let sortDirection = 'desc';
  let isSearching = false;
  let searchResultsReady = false;
  let initialFilterApplied = false;
  let UserPoolComponent: any;

  // Update loading state when pools update
  $: {
    if ($liveUserPools !== undefined) {
      loading = false;
    }
  }

  // Process pool balances when they update
  $: {
    if (Array.isArray($liveUserPools)) {
      processedPools = $liveUserPools
        .filter(poolBalance => {
          const hasBalance = Number(poolBalance.balance) > 0;
          return hasBalance;
        })
        .map(poolBalance => {
          const token0 = $liveTokens.find(t => t.symbol === poolBalance.symbol_0);
          const token1 = $liveTokens.find(t => t.symbol === poolBalance.symbol_1);
          
          // Create searchable text with more variations and aliases
          const searchableText = [
            poolBalance.symbol_0,
            poolBalance.symbol_1,
            `${poolBalance.symbol_0}/${poolBalance.symbol_1}`,
            poolBalance.name || '',
            token0?.name || '',
            token1?.name || '',
            token0?.canister_id || '',
            token1?.canister_id || '',
            // Add common aliases
            poolBalance.symbol_0 === 'ICP' ? 'internet computer protocol dfinity' : '',
            poolBalance.symbol_1 === 'ICP' ? 'internet computer protocol dfinity' : '',
            poolBalance.symbol_0 === 'USDT' ? 'tether usdt' : '',
            poolBalance.symbol_1 === 'USDT' ? 'tether usdt' : '',
            poolBalance.symbol_0 === 'BTC' ? 'bitcoin btc' : '',
            poolBalance.symbol_1 === 'BTC' ? 'bitcoin btc' : '',
            poolBalance.symbol_0 === 'ETH' ? 'ethereum eth' : '',
            poolBalance.symbol_1 === 'ETH' ? 'ethereum eth' : '',
          ].join(' ').toLowerCase();
          
          return {
            id: poolBalance.name,
            name: poolBalance.name,
            symbol: poolBalance.symbol,
            symbol_0: poolBalance.symbol_0,
            symbol_1: poolBalance.symbol_1,
            balance: poolBalance.balance.toString(),
            amount_0: poolBalance.amount_0,
            amount_1: poolBalance.amount_1,
            usd_balance: poolBalance.usd_balance,
            address_0: poolBalance.symbol_0,
            address_1: poolBalance.symbol_1,
            searchableText
          };
        });

      // If we have a specific pool to display, immediately filter for it
      if (pool && !initialFilterApplied) {
        searchQuery = `${pool.symbol_0}/${pool.symbol_1}`;
        debouncedSearchQuery = searchQuery.toLowerCase();
        initialFilterApplied = true;
        searchResultsReady = true;
        isSearching = false;
      }
    } else {
      processedPools = [];
    }
  }

  // Debounce search input only when user is actively searching
  $: if (!initialFilterApplied || searchQuery !== `${pool?.symbol_0}/${pool?.symbol_1}`) {
    isSearching = true;
    searchResultsReady = false;
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      debouncedSearchQuery = searchQuery.toLowerCase();
      setTimeout(() => {
        searchResultsReady = true;
        isSearching = false;
      }, 100);
    }, 150);
  }

  // Filter pools based on search, pair filter, and token filter
  $: filteredPools = processedPools
    .filter(poolItem => {
      if (pool) {
        return poolItem.symbol_0 === pool.symbol_0 && poolItem.symbol_1 === pool.symbol_1;
      }
      
      if (debouncedSearchQuery) {
        return poolItem.searchableText.includes(debouncedSearchQuery);
      }
      
      if (filterPair.token0 && filterPair.token1) {
        return (poolItem.symbol_0 === filterPair.token0 && poolItem.symbol_1 === filterPair.token1) ||
               (poolItem.symbol_0 === filterPair.token1 && poolItem.symbol_1 === filterPair.token0);
      }
      
      if (filterToken) {
        return poolItem.symbol_0 === filterToken || poolItem.symbol_1 === filterToken;
      }
      
      return true;
    })
    .sort((a, b) => sortDirection === 'desc' ? 
      Number(b.usd_balance) - Number(a.usd_balance) : 
      Number(a.usd_balance) - Number(b.usd_balance)
    );


  function handleAddLiquidity() {
    goto('/pools/add');
    sidebarStore.collapse();
  }

  async function handlePoolItemClick(poolItem) {
    if (!UserPoolComponent) {
      await loadUserPoolComponent();
    }
    selectedPool = poolItem;
    showUserPoolModal = true;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && searchQuery) {
      event.preventDefault();
      searchQuery = '';
      searchInput.focus();
    }
    else if (event.key === '/' && document.activeElement !== searchInput) {
      event.preventDefault();
      searchInput.focus();
    }
  }

  $: if ($auth.isConnected) {
    PoolService.fetchUserPoolBalances(false);
  }

  async function loadUserPoolComponent() {
    const module = await import('$lib/components/liquidity/pools/UserPool.svelte');
    UserPoolComponent = module.default;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="px-2 min-h-[87vh]" on:keydown={handleKeydown}>
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
                searchQuery = '';
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
          on:click={() => sortDirection = sortDirection === 'desc' ? 'asc' : 'desc'}
          aria-label={`Sort by value ${sortDirection === 'desc' ? 'ascending' : 'descending'}`}
        >
          <span class="toggle-label">Value</span>
          <div class="sort-icon-wrapper" class:ascending={sortDirection === 'asc'}>
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

  <div class="px-2">
    <div class="pool-list">
      {#if loading && processedPools.length === 0}
        <div class="state-message" in:fade>
          <div class="loading-spinner"></div>
          <p>Loading your positions...</p>
        </div>
      {:else if !pool && (isSearching || !searchResultsReady)}
        <div class="state-message" in:fade>
          <div class="loading-spinner"></div>
          <p>Finding pools...</p>
        </div>
      {:else if error}
        <div class="state-message error" in:fade>
          <p>{error}</p>
          <button class="retry-button" on:click={() => PoolService.fetchUserPoolBalances()}>
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
                searchQuery = '';
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
                      $liveTokens.find(token => token.symbol === poolItem.symbol_0),
                      $liveTokens.find(token => token.symbol === poolItem.symbol_1)
                    ]} 
                    size={32}
                    overlap={true}
                  />
                </div>
                <div class="pool-info">
                  <div class="pool-pair">{poolItem.symbol_0}/{poolItem.symbol_1}</div>
                  <div class="pool-balance">
                    {Number(poolItem.balance).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 8
                    })} LP
                  </div>
                </div>
              </div>
              <div class="pool-right">
                <div class="value-info">
                  <div class="usd-value">${formatToNonZeroDecimal(poolItem.usd_balance)}</div>
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
    on:close={() => showUserPoolModal = false}
  />
{/if}

<style lang="postcss">
  .pool-list-wrapper {
    @apply flex flex-col flex-grow min-h-[85vh] overflow-hidden bg-kong-bg-dark/20 rounded-lg gap-1;
  }

  .search-bar {
    @apply flex items-center justify-between p-3 gap-3 border-b border-kong-border/40;
  }

  .search-controls {
    @apply flex items-center gap-2 flex-1;
  }

  .search-input-wrapper {
    @apply relative flex items-center flex-1;
  }

  .search-icon-wrapper {
    @apply absolute left-3 z-10 flex items-center pointer-events-none;
  }

  .search-input {
    @apply w-full bg-kong-bg-dark/30 border border-kong-border/40 rounded-lg py-2 pl-9 pr-3.5 text-sm
           text-kong-text-primary placeholder-kong-text-secondary/70 
           focus:outline-none focus:ring-1 focus:ring-kong-accent-blue/40
           focus:border-kong-accent-blue/40 transition-all;
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

  .pool-list {
    @apply flex flex-col gap-1.5 pb-3;
  }

  .pool-item {
    @apply bg-kong-bg-dark/20 rounded-lg p-4 cursor-pointer 
           hover:bg-kong-bg-dark/30 transition-all duration-200
           border border-kong-border/40 hover:border-kong-accent-blue/30
           hover:shadow-lg hover:shadow-kong-accent-blue/5
           active:scale-[0.995];
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

  .retry-button, .clear-search-button, .add-first-position {
    @apply px-4 py-2 bg-kong-bg-dark/40 text-kong-text-secondary text-xs font-medium rounded-lg
           transition-all duration-200 hover:bg-kong-bg-dark/60 hover:text-kong-text-primary
           border border-kong-border/40 hover:border-kong-accent-blue/30
           active:scale-[0.98];
  }

  .add-first-position {
    @apply bg-kong-accent-blue/90 text-white hover:bg-kong-accent-blue 
           hover:text-white border-transparent;
  }
</style>
