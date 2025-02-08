<script lang="ts">
  import { fade, slide } from "svelte/transition";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { ChevronRight, Search, X, ArrowUpDown, Loader2 } from "lucide-svelte";
  import { PoolService } from "$lib/services/pools";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { userPoolListStore } from "$lib/stores/userPoolListStore";
  import { auth } from "$lib/services/auth";

  // --- Type Definitions ---
  interface FilterPair {
    token0?: string;
    token1?: string;
  }

  interface UserPoolBalance {
    symbol_0: string;
    symbol_1: string;
    balance: string;
    usd_balance: string;
    name?: string;
    address_0: string;
    address_1: string;
  }

  interface ProcessedPool extends UserPoolBalance {
    searchableText: string;
    token0?: FE.Token;
    token1?: FE.Token;
  }

  // --- Props ---
  export let filterPair: FilterPair = {};
  export let filterToken = "";
  export let initialSearch = "";
  export let pool: ProcessedPool | null = null;

  // --- Store ---
  let searchInput: HTMLInputElement;
  let selectedPool: ProcessedPool | null = null;
  let showUserPoolModal = false;
  let UserPoolComponent: any;

  // Initialize store
  onMount(() => {
    if ($auth.isConnected) {
      userPoolListStore.initialize();
    }
  });

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
    if (event.key === "Escape" && $userPoolListStore.searchQuery) {
      event.preventDefault();
      userPoolListStore.setSearchQuery("");
      searchInput.focus();
    } else if (event.key === "/" && document.activeElement !== searchInput) {
      event.preventDefault();
      searchInput.focus();
    }
  };
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
              bind:value={$userPoolListStore.searchQuery}
              type="text"
              placeholder="Search pools by name or token..."
              class="search-input"
            />
            {#if $userPoolListStore.searchQuery}
              <button
                class="clear-button"
                on:click={() => {
                  userPoolListStore.setSearchQuery("");
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
            on:click={userPoolListStore.toggleSort}
            aria-label={`Sort by value ${$userPoolListStore.sortDirection === "desc" ? "ascending" : "descending"}`}
          >
            <span class="toggle-label">Value</span>
            <div
              class="sort-icon-wrapper"
              class:ascending={$userPoolListStore.sortDirection === "asc"}
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
      {#if $userPoolListStore.loading}
        <div class="empty-state" in:fade>
          <Loader2 class="animate-spin" size={20} />
          <p>Loading positions...</p>
        </div>
      {:else if $userPoolListStore.error}
        <div class="state-message error" in:fade>
          <p>{$userPoolListStore.error}</p>
          <button
            class="retry-button"
            on:click={() => PoolService.fetchUserPoolBalances(true)}
          >
            Retry
          </button>
        </div>
      {:else if $userPoolListStore.filteredPools.length === 0}
        <div class="state-message" in:fade>
          {#if $userPoolListStore.searchQuery && !pool}
            <p>No pools found matching "{$userPoolListStore.searchQuery}"</p>
            <button
              class="clear-search-button"
              on:click={() => {
                userPoolListStore.setSearchQuery("");
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
        {#each $userPoolListStore.filteredPools as poolItem}
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

