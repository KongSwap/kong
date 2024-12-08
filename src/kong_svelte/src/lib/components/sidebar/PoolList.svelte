<script lang="ts">
  import { onMount } from "svelte";
  import { fade, slide } from "svelte/transition";
  import { auth } from "$lib/services/auth";
  import { poolStore } from "$lib/services/pools/poolStore";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { tokenStore } from "$lib/services/tokens/tokenStore";
  import { createEventDispatcher } from "svelte";
  import UserPool from "$lib/components/liquidity/pools/UserPool.svelte";
  import { goto } from "$app/navigation";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { sidebarStore } from "$lib/stores/sidebarStore";

  const dispatch = createEventDispatcher();
  export let pool: any = null; // Single pool to display
  export let searchTerm: string = ""; // External search term from parent

  let searchInput: HTMLInputElement;
  let loading = true;
  let error: string | null = null;
  let poolBalances: any[] = [];
  let processedPools: any[] = [];
  let selectedPool = null;
  let showUserPoolModal = false;
  let sortDirection = 'desc';
  let isSearching = false;
  let searchResultsReady = false;
  let initialFilterApplied = false;

  // Process pool balances when they update
  $: balances = $poolStore.userPoolBalances;
  $: {
    if (Array.isArray(balances)) {
      poolBalances = balances;
      processedPools = balances
        .filter(poolBalance => Number(poolBalance.balance) > 0)
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
            pool_id: (poolBalance as any)?.pool_id,
            address_0: poolBalance.symbol_0,
            address_1: poolBalance.symbol_1,
            searchableText
          };
        });

      // If we have a specific pool to display, immediately filter for it
      if (pool && !initialFilterApplied) {
        initialFilterApplied = true;
      }
    } else {
      poolBalances = [];
      processedPools = [];
    }
  }

  // Filter pools based on external searchTerm
  $: filteredPools = processedPools
    .filter(poolItem => {
      if (pool) {
        return poolItem.symbol_0 === pool.symbol_0 && poolItem.symbol_1 === pool.symbol_1;
      }
      
      if (!searchTerm) return true;
      
      return poolItem.searchableText.includes(searchTerm.toLowerCase());
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
      
      searchResultsReady = true;
    } catch (err) {
      console.error("Error loading pool balances:", err);
      error = err.message;
      poolBalances = [];
      processedPools = [];
    } finally {
      loading = false;
      isSearching = false;
    }
  }

  async function handleAddLiquidity() {
    await sidebarStore.collapse();
    goto('/earn/add');
  }

  function handlePoolItemClick(poolItem) {
    selectedPool = poolItem;
    showUserPoolModal = true;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
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
      <div class="pool-list">
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
                  size={32}
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
                  <span class="usd-value">
                    ${formatToNonZeroDecimal(poolItem.usd_balance)}
                  </span>
                </div>
                <div class="chevron-wrapper">
                  <svg xmlns="http://www.w3.org/2000/svg" 
                       width="20" height="20" 
                       viewBox="0 0 24 24" 
                       fill="none" 
                       stroke="currentColor" 
                       stroke-width="2"
                       class="chevron-right">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="pool-list-content">
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
        {#if searchTerm && !pool}
          <p>No pools found matching "{searchTerm}"</p>
        {:else if !pool}
          <p>No active positions</p>
          <button class="primary-button" on:click={handleAddLiquidity}>
            Add Position
          </button>
        {:else}
          <p>No matching pool found</p>
        {/if}
      </div>
    {/if}
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

<style scoped lang="postcss">
  .pool-list-wrapper {
    @apply flex flex-col h-full overflow-hidden;
  }

  .controls-wrapper {
    @apply flex flex-col border-b border-gray-800;
  }

  .pool-list-content {
    @apply flex-1 min-h-0 overflow-y-auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
  }

  .pool-list {
    @apply flex flex-col gap-1.5 sm:gap-2 mt-2;
  }

  .pool-item {
    @apply bg-gray-800/50 rounded-lg p-3 sm:p-4 cursor-pointer 
           hover:bg-gray-800/70 transition-all duration-200
           border border-transparent hover:border-blue-500/30;
  }

  .pool-content {
    @apply flex items-center justify-between w-full gap-2;
  }

  .pool-left {
    @apply flex items-center gap-2 sm:gap-4 flex-1 min-w-0;
  }

  .pool-info {
    @apply flex flex-col gap-0.5 sm:gap-1 flex-1 min-w-0;
  }

  .pool-pair {
    @apply text-base sm:text-lg font-medium text-white/95 truncate;
  }

  .pool-balance {
    @apply text-sm text-white/70 truncate;
  }

  .pool-right {
    @apply flex items-center gap-3 sm:gap-4;
  }

  .value-info {
    @apply flex items-center justify-end min-w-[100px] sm:min-w-[120px];
  }

  .usd-value {
    @apply text-base sm:text-lg font-medium text-white/90 tabular-nums;
  }

  .chevron-wrapper {
    @apply flex items-center justify-center w-6 sm:w-8;
  }

  .chevron-right {
    @apply text-white/40 w-5 h-5 sm:w-6 sm:h-6;
  }

  /* Hide chevron on mobile if needed */
  @media (max-width: 370px) {
    .chevron-wrapper {
      @apply hidden;
    }
    
    .value-info {
      @apply min-w-[80px];
    }
    
    .usd-value {
      @apply text-sm;
    }
  }

  .loading-state, .error-state, .empty-state {
    @apply flex flex-col items-center justify-center gap-2 sm:gap-3
           min-h-[120px] sm:min-h-[160px] text-white/40 text-sm
           px-4 text-center;
  }

  .error-state {
    @apply text-red-400;
  }

  .loading-state {
    @apply flex flex-col items-center justify-center gap-3
           min-h-[160px] text-white/40 text-sm animate-pulse;
  }

  .pool-list-content::-webkit-scrollbar {
    @apply w-1.5;
  }

  .pool-list-content::-webkit-scrollbar-track {
    @apply bg-transparent;
  }

  .pool-list-content::-webkit-scrollbar-thumb {
    @apply bg-white/10 rounded-full;
  }
</style>
