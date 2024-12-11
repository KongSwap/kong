<script lang="ts">
  import { onMount } from "svelte";
  import { fade, fly, slide } from "svelte/transition";
  import { auth } from "$lib/services/auth";
  import { poolStore } from "$lib/services/pools/poolStore";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { tokenStore } from "$lib/services/tokens/tokenStore";
  import UserPool from "$lib/components/liquidity/pools/UserPool.svelte";
  import { goto } from "$app/navigation";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";

  export const pools: any[] = [];
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

  const MIN_USD_VALUE = 0.01; // Minimum USD value threshold (1 cent)

  // Process pool balances when they update
  $: balances = $poolStore.userPoolBalances;
  $: {
    if (Array.isArray(balances)) {
      processedPools = balances
        .filter(poolBalance => {
          const hasBalance = Number(poolBalance.balance) > 0;
          const hasMinValue = Number(poolBalance.usd_balance) >= MIN_USD_VALUE;
          console.log('Pool:', poolBalance.name, 
            'Balance:', poolBalance.balance, 
            'USD:', poolBalance.usd_balance,
            'Passes Filter:', hasBalance && hasMinValue
          );
          return hasBalance && hasMinValue;
        })
        .map(poolBalance => {
          const token0 = $tokenStore.tokens.find(t => t.symbol === poolBalance.symbol_0);
          const token1 = $tokenStore.tokens.find(t => t.symbol === poolBalance.symbol_1);
          
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

  async function loadPoolBalances() {
    try {
      loading = true;
      error = null;
      
      await poolStore.loadUserPoolBalances();
      
      // Don't show loading state for specific pool view
      if (!pool) {
        isSearching = true;
        searchResultsReady = false;
      }
      
      // If we have initial search or specific pool, apply filter immediately
      if ((initialSearch || pool) && !initialFilterApplied) {
        searchQuery = pool ? `${pool.symbol_0}/${pool.symbol_1}` : initialSearch;
        debouncedSearchQuery = searchQuery.toLowerCase();
        initialFilterApplied = true;
      }
      
      searchResultsReady = true;
    } catch (err) {
      console.error("Error loading pool balances:", err);
      error = err.message;
      processedPools = [];
    } finally {
      loading = false;
      isSearching = false;
    }
  }

  function handleAddLiquidity() {
    goto('/earn/add');
  }

  function handlePoolItemClick(poolItem) {
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

  onMount(() => {
    if ($auth.isConnected) {
      loadPoolBalances();
    }
  });

  $: if ($auth.isConnected) {
    loadPoolBalances();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="pool-list-wrapper" on:keydown={handleKeydown}>
  <div class="controls-wrapper">
    {#if !pool}
    <div class="search-bar">
      <div class="search-input-wrapper">
        <input
          bind:this={searchInput}
          bind:value={searchQuery}
          type="text"
          placeholder="Search..."
          class="search-input"
        />
        {#if searchQuery}
          <!-- svelte-ignore a11y_consider_explicit_label -->
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

      <!-- svelte-ignore a11y_click_events_have_key_events -->
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
    {/if}
  </div>

  <div class="pool-list-content">
    {#if !pool}
      <div class="add-liquidity-button-wrapper">
        <button class="primary-button" on:click={handleAddLiquidity}>
          Add Position
        </button>
      </div>
    {/if}
    <div class="pool-list">
      {#if loading && processedPools.length === 0}
        <div class="loading-state" in:fade>
          <p>Loading positions...</p>
        </div>
      {:else if !pool && (isSearching || !searchResultsReady)}
        <div class="loading-state" in:fade>
          <p>Finding pools...</p>
        </div>
      {:else if error}
        <div class="error-state" in:fade>
          <p>{error}</p>
        </div>
      {:else if filteredPools.length === 0}
        <div class="empty-state" in:fade>
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
          {:else}
            <p>No matching pool found</p>
          {/if}
        </div>
      {:else}
        {#each filteredPools as poolItem (poolItem.id)}
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
                <TokenImages 
                  tokens={[
                    $tokenStore.tokens.find(token => token.symbol === poolItem.symbol_0),
                    $tokenStore.tokens.find(token => token.symbol === poolItem.symbol_1)
                  ]} 
                  size={36}
                />
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
                  <div class="usd-value">
                    ${formatToNonZeroDecimal(poolItem.usd_balance)}
                  </div>
                </div>
                <div class="view-details">
                  <span class="details-text">View Details</span>
                  <span class="details-arrow">→</span>
                </div>
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

  .search-bar {
    @apply flex items-center justify-between py-3;
  }

  .search-input-wrapper {
    @apply relative flex items-center flex-1 mr-4;
  }

  .search-input {
    @apply w-full bg-transparent border-none py-2 text-white placeholder-gray-500
           focus:outline-none focus:ring-0;
  }

  .clear-button {
    @apply absolute right-0 text-gray-500 hover:text-white transition-colors;
  }

  .sort-toggle {
    @apply flex items-center gap-2 text-sm text-gray-400 cursor-pointer hover:text-white transition-colors whitespace-nowrap;
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

  .add-liquidity-button-wrapper {
    @apply flex justify-end py-4;
  }

  .pool-list {
    @apply flex flex-col gap-2 mt-2;
  }

  .pool-item {
    @apply bg-gray-800/50 rounded-lg p-4 cursor-pointer 
           hover:bg-gray-800/70 transition-all duration-200
           border border-transparent hover:border-blue-500/30;
  }

  .pool-content {
    @apply flex justify-between items-center w-full;
  }

  .pool-left {
    @apply flex items-center gap-4;
  }

  .pool-info {
    @apply flex flex-col gap-1;
  }

  .pool-pair {
    @apply text-lg font-medium text-white/95;
  }

  .pool-balance {
    @apply text-sm text-white/70;
  }

  .pool-right {
    @apply flex items-center gap-1;
  }

  .value-info {
    @apply flex flex-col items-end;
  }

  .usd-value {
    @apply text-base font-medium text-white/95;
  }

  .view-details {
    @apply text-sm text-blue-400 ml-4 flex items-center gap-1;
  }

  .details-text {
    @apply block;
    @apply sm:block hidden;
  }

  .details-arrow {
    @apply block;
  }

  /* Adjust margin on mobile */
  @media (max-width: 640px) {
    .view-details {
      @apply ml-2;
    }
  }

  .pool-item:hover .view-details {
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

  .loading-state {
    @apply flex flex-col items-center justify-center gap-3
           min-h-[160px] text-white/40 text-sm animate-pulse;
  }
</style>
