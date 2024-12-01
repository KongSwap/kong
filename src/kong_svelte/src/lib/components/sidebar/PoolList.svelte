<script lang="ts">
  import { onMount } from "svelte";
  import { fade, fly, slide } from "svelte/transition";
  import { auth } from "$lib/services/auth";
  import { poolStore } from "$lib/services/pools/poolStore";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { tokenStore } from "$lib/services/tokens/tokenStore";
  import { createEventDispatcher } from "svelte";
  import UserPool from "$lib/components/liquidity/pools/UserPool.svelte";

  const dispatch = createEventDispatcher();
  export let pools: any[] = [];
  export let filterPair: {token0?: string, token1?: string} = {}; // Filter by specific token pair
  export let filterToken: string = ''; // Filter by single token

  let loading = true;
  let error: string | null = null;
  let poolBalances: any[] = [];
  let processedPools: any[] = [];
  let selectedPool = null;
  let showUserPoolModal = false;
  let searchQuery = '';
  let searchInput: HTMLInputElement;
  let searchDebounceTimer: NodeJS.Timeout;
  let debouncedSearchQuery = '';
  let sortDirection = 'desc';

  // Process pool balances when they update
  $: balances = $poolStore.userPoolBalances;
  $: {
    console.log("Raw balances in PoolList:", balances);
    if (Array.isArray(balances)) {
      poolBalances = balances;
      processedPools = balances.map(pool => ({
        id: pool.name,
        name: pool.name,
        symbol: pool.symbol,
        symbol_0: pool.symbol_0,
        symbol_1: pool.symbol_1,
        balance: pool.balance.toString(),
        amount_0: pool.amount_0,
        amount_1: pool.amount_1,
        usd_balance: pool.usd_balance,
        pool_id: pool.pool_id,
        address_0: pool.symbol_0,
        address_1: pool.symbol_1,
        searchableText: `${pool.symbol_0}/${pool.symbol_1} ${pool.name || ''} ${pool.pool_id || ''}`.toLowerCase()
      }));
      console.log("Final processedPools:", processedPools);
    } else {
      poolBalances = [];
      processedPools = [];
    }
  }

  // Debounce search input
  $: {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      debouncedSearchQuery = searchQuery.toLowerCase();
    }, 150);
  }

  // Filter pools based on search, pair filter, and token filter
  $: filteredPools = processedPools
    .filter(pool => {
      // Apply search filter
      if (debouncedSearchQuery) {
        return pool.searchableText.includes(debouncedSearchQuery);
      }
      
      // Apply pair filter
      if (filterPair.token0 && filterPair.token1) {
        return (pool.symbol_0 === filterPair.token0 && pool.symbol_1 === filterPair.token1) ||
               (pool.symbol_0 === filterPair.token1 && pool.symbol_1 === filterPair.token0);
      }
      
      // Apply single token filter
      if (filterToken) {
        return pool.symbol_0 === filterToken || pool.symbol_1 === filterToken;
      }
      
      return true;
    })
    .sort((a, b) => sortDirection === 'desc' ? 
      Number(b.usd_balance) - Number(a.usd_balance) : 
      Number(a.usd_balance) - Number(b.usd_balance)
    );

  async function loadPoolBalances() {
    try {
      loading = true;
      error = null;
      console.log("Loading pool balances...");
      await poolStore.loadUserPoolBalances();
      console.log("Pool balances loaded");
    } catch (err) {
      console.error("Error loading pool balances:", err);
      error = err.message;
      poolBalances = [];
      processedPools = [];
    } finally {
      loading = false;
    }
  }

  function handleAddLiquidity() {
    window.location.href = '/earn';
  }

  function handlePoolItemClick(pool) {
    selectedPool = pool;
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

  onMount(() => {
    if ($auth.isConnected) {
      loadPoolBalances();
    }
  });

  $: if ($auth.isConnected) {
    loadPoolBalances();
  }
</script>

<div class="pool-list-wrapper" on:keydown={handleKeydown}>
  <div class="controls-wrapper">
    <div class="search-section">
      <div class="search-input-wrapper">
        <input
          bind:this={searchInput}
          bind:value={searchQuery}
          type="text"
          placeholder="Search pools by name or token"
          class="search-input"
        />
        {#if searchQuery}
          <button 
            class="clear-button"
            on:click={() => {
              searchQuery = '';
              searchInput.focus();
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        {/if}
      </div>
    </div>

    <div class="filter-bar">
      <div class="sort-toggle" on:click={() => {
        sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
      }}>
        <span class="toggle-label">Sort by value</span>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="2"
          class="sort-arrow"
          class:ascending={sortDirection === 'asc'}
        >
          <path d="M12 20V4M5 13l7 7 7-7"/>
        </svg>
      </div>
    </div>
  </div>

  <div class="pool-list-content">
    <div class="pool-list">
      {#if loading && processedPools.length === 0}
        <div class="loading-state" in:fade>
          <p>Loading positions...</p>
        </div>
      {:else if error}
        <div class="error-state" in:fade>
          <p>{error}</p>
        </div>
      {:else if filteredPools.length === 0}
        <div class="empty-state" in:fade>
          {#if searchQuery}
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
          {:else}
            <p>No active positions</p>
            <button class="primary-button" on:click={handleAddLiquidity}>
              Add Position
            </button>
          {/if}
        </div>
      {:else}
        {#each filteredPools as pool (pool.id)}
          <div 
            class="pool-item" 
            in:slide={{ duration: 200 }}
            on:click={() => handlePoolItemClick(pool)}
            role="button"
            tabindex="0"
          >
            <div class="pool-content">
              <div class="pool-left">
                <TokenImages 
                  tokens={[
                    $tokenStore.tokens.find(token => token.symbol === pool.symbol_0),
                    $tokenStore.tokens.find(token => token.symbol === pool.symbol_1)
                  ]} 
                  size={36}
                />
                <div class="pool-info">
                  <span class="pool-pair">{pool.symbol_0}/{pool.symbol_1}</span>
                  <span class="pool-balance">{parseFloat(pool.balance).toFixed(8)} LP</span>
                  <span class="pool-usd-value">${parseFloat(pool.usd_balance).toFixed(2)}</span>
                </div>
              </div>
              <div class="pool-right">
                <span class="view-details">View Details →</span>
              </div>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>

{#if selectedPool}
  <UserPool
    pool={selectedPool}
    bind:showModal={showUserPoolModal}
    on:close={() => showUserPoolModal = false}
    on:liquidityRemoved={() => {
      loadPoolBalances();
    }}
  />
{/if}

<style lang="postcss">
  .pool-list-wrapper {
    @apply flex flex-col h-full overflow-hidden;
  }

  .controls-wrapper {
    @apply flex flex-col border-b border-gray-800;
  }

  .search-section {
    @apply sticky top-0 z-10 bg-gray-900;
  }

  .search-input-wrapper {
    @apply relative flex items-center;
  }

  .search-input {
    @apply w-full bg-transparent border-none px-4 py-3 text-white placeholder-gray-500
           focus:outline-none focus:ring-0;
  }

  .clear-button {
    @apply absolute right-4 text-gray-500 hover:text-white transition-colors;
  }

  .filter-bar {
    @apply px-4 py-3 border-t border-gray-800 flex justify-between items-center;
  }

  .sort-toggle {
    @apply flex items-center gap-2 text-sm text-gray-400 cursor-pointer hover:text-white transition-colors;
  }

  .sort-arrow {
    @apply transition-transform duration-200;
  }

  .sort-arrow.ascending {
    @apply rotate-180;
  }

  .pool-list-content {
    @apply flex-1 min-h-0 overflow-y-auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
  }

  .pool-list {
    @apply flex flex-col gap-2 p-4;
  }

  .pool-item {
    @apply bg-gray-800/50 rounded-lg p-4 cursor-pointer 
           hover:bg-gray-800/70 transition-all duration-200
           border border-transparent hover:border-blue-500/30;
  }

  .pool-content {
    @apply flex justify-between items-center;
  }

  .pool-left {
    @apply flex items-center gap-4;
  }

  .pool-info {
    @apply flex flex-col gap-1;
  }

  .pool-pair {
    @apply text-base font-medium text-white/95;
  }

  .pool-balance {
    @apply text-sm text-white/70;
  }

  .pool-usd-value {
    @apply text-xs text-white/50;
  }

  .loading-state, .error-state, .empty-state {
    @apply flex flex-col items-center justify-center gap-3
           min-h-[160px] text-white/40 text-sm;
  }

  .primary-button {
    @apply px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg
           transition-all duration-200 hover:bg-blue-600;
  }

  .clear-search-button {
    @apply px-4 py-2 bg-gray-800 text-white/70 text-sm font-medium rounded-lg
           transition-all duration-200 hover:bg-gray-700 hover:text-white;
  }

  .error-state {
    @apply text-red-400;
  }

  .pool-right {
    @apply flex items-center;
  }

  .view-details {
    @apply text-sm text-blue-400 opacity-0 transition-opacity duration-200;
  }

  .pool-item:hover .view-details {
    @apply opacity-100;
  }
</style>
