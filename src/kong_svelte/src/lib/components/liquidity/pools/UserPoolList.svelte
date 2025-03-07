<script lang="ts">
  import { fade, slide, fly } from "svelte/transition";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import {
    formatToNonZeroDecimal,
    calculateTokenUsdValue,
  } from "$lib/utils/numberFormatUtils";
  import { calculateUserPoolPercentage } from "$lib/utils/liquidityUtils";
  import {
    Plus,
    Minus,
    ChevronDown,
    ChevronUp,
    Droplets,
    BarChart3,
    ChartPie,
  } from "lucide-svelte";
  import UserPool from "$lib/components/liquidity/pools/UserPool.svelte";
  import { onMount } from "svelte";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
  import { livePools } from "$lib/services/pools/poolStore";
  import { auth } from "$lib/services/auth";

  export let searchQuery = "";

  let expandedPoolId: string | null = null;
  let selectedPool: any = null;
  let showUserPoolModal = false;

  // Simple flag for initial load only
  let hasCompletedInitialLoad = false;

  // Cache for pools
  let cachedPools: any[] = [];

  // Update cache whenever we have valid data (not during loading)
  $: if (
    $currentUserPoolsStore.filteredPools.length > 0 &&
    !$currentUserPoolsStore.loading
  ) {
    cachedPools = [...$currentUserPoolsStore.filteredPools];
  }

  // Always use cached pools after initial load if we have them
  $: displayPools = !hasCompletedInitialLoad
    ? $currentUserPoolsStore.filteredPools
    : cachedPools.length > 0
      ? cachedPools
      : $currentUserPoolsStore.filteredPools;

  // Only show loading indicator on initial load
  $: showLoadingIndicator =
    $currentUserPoolsStore.loading && !hasCompletedInitialLoad;

  // Subscribe to the store
  $: if (searchQuery !== $currentUserPoolsStore.searchQuery) {
    currentUserPoolsStore.setSearchQuery(searchQuery);
  }

  onMount(async () => {
    if ($auth.isConnected) {
      await loadUserPools();
    }
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

  // Function to refresh pools without showing loading indicator
  async function refreshUserPools() {
    if (hasCompletedInitialLoad) {
      try {
        // Since refresh() doesn't exist, we can re-initialize the store
        // after initial load is complete
        await currentUserPoolsStore.initialize();
      } catch (error) {
        console.error("Error refreshing user pools:", error);
      }
    }
  }

  function handlePoolItemClick(pool: any) {
    if (expandedPoolId === pool.id) {
      expandedPoolId = null;
    } else {
      expandedPoolId = pool.id;
    }
  }

  function handleAddLiquidity(pool: any, event: Event) {
    event.stopPropagation();
    selectedPool = { ...pool, initialTab: "add" };
    showUserPoolModal = true;
  }

  function handleRemoveLiquidity(pool: any, event: Event) {
    event.stopPropagation();
    selectedPool = { ...pool, initialTab: "remove" };
    showUserPoolModal = true;
  }

  function handleLiquidityRemoved() {
    showUserPoolModal = false;
    selectedPool = null;
    // Refresh the pools after liquidity is removed
    refreshUserPools();
  }

  // Get pool share percentage
  function getPoolSharePercentage(pool: any): string {
    const livePool = $livePools.find(
      (p) => p.address_0 === pool.address_0 && p.address_1 === pool.address_1,
    );

    return calculateUserPoolPercentage(
      livePool?.balance_0,
      livePool?.balance_1,
      pool.amount_0,
      pool.amount_1,
    );
  }

  // Get APY for a pool
  function getPoolApy(pool: any): string {
    const livePool = $livePools.find(
      (p) => p.address_0 === pool.address_0 && p.address_1 === pool.address_1,
    );

    return livePool?.rolling_24h_apy
      ? formatToNonZeroDecimal(livePool.rolling_24h_apy)
      : "0";
  }
</script>

<div class="mt-2">
  {#if showLoadingIndicator}
    <div class="loading-state" in:fade={{ duration: 300 }}>
      <div class="loading-animation">
        <Droplets size={32} class="animate-pulse text-kong-primary" />
      </div>
      <p class="loading-text">Loading your liquidity positions...</p>
    </div>
  {:else if $currentUserPoolsStore.error}
    <div class="error-state" in:fade={{ duration: 300 }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="error-icon"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clip-rule="evenodd"
        />
      </svg>
      <p class="error-text">{$currentUserPoolsStore.error}</p>
      <button class="retry-button" on:click={() => refreshUserPools()}>
        Retry
      </button>
    </div>
  {:else if displayPools.length === 0}
    <div class="empty-state" in:fade={{ duration: 300 }}>
      <div class="empty-icon-container">
        <Droplets size={40} class="empty-icon" />
      </div>
      {#if searchQuery}
        <p class="empty-text">
          No pools found matching "<span class="search-term">{searchQuery}</span
          >"
        </p>
        <p class="empty-subtext">
          Try a different search term or check your active positions
        </p>
      {:else}
        <p class="empty-text">No active liquidity positions</p>
        <p class="empty-subtext">
          Add liquidity to a pool to start earning fees
        </p>
        <a href="/pools/add" class="empty-action-button">
          <Plus size={16} />
          <span>Add Liquidity</span>
        </a>
      {/if}
    </div>
  {:else}
    <div class="pools-grid">
      {#each displayPools as pool (pool.id)}
        <div
          in:fly={{
            y: 20,
            duration: 300,
            delay: 50 * displayPools.indexOf(pool),
          }}
        >
          <div
            class="pool-card {expandedPoolId === pool.id ? 'expanded' : ''}"
            on:click={() => handlePoolItemClick(pool)}
            on:keydown={(e) => e.key === "Enter" && handlePoolItemClick(pool)}
            role="button"
            tabindex="0"
          >
            <!-- Card Header -->
            <div class="pool-card-header">
              <div class="pool-info">
                <button
                  class="absolute bottom-0 right-0 text-kong-text-primary/60"
                  aria-label="Toggle pool details"
                >
                  {#if expandedPoolId === pool.id}
                    <ChevronUp size={18} />
                  {:else}
                    <ChevronDown size={18} />
                  {/if}
                </button>
                <div class="token-images">
                  <TokenImages tokens={[pool.token0, pool.token1]} size={40} />
                </div>
                <div class="pool-details">
                  <h3 class="pool-name">
                    {pool.symbol_0}/{pool.symbol_1}
                  </h3>
                  <div class="pool-stats">
                    <div class="flex items-center gap-1">
                      <ChartPie size={14} />
                      <span class="stat-value"
                        >{getPoolSharePercentage(pool)}% share</span
                      >
                    </div>
                    <div class="h-3 w-px bg-white/10"></div>
                    <div class="flex items-center gap-1">
                      <BarChart3 size={14} />
                      <span class="stat-value accent"
                        >{getPoolApy(pool)}% APY</span
                      >
                    </div>
                  </div>
                </div>
                <div class="pool-value">
                  <div class="usd-value">
                    ${formatToNonZeroDecimal(pool.usd_balance)}
                  </div>
                </div>
              </div>
            </div>

            <!-- Expanded Content -->
            {#if expandedPoolId === pool.id}
              <div
                class="expanded-content"
                transition:slide={{ duration: 300 }}
              >
                <!-- Token Details -->
                <div class="token-details">
                  <h4 class="section-title">Your Tokens</h4>
                  {#each [{ id: "token0", symbol: pool.symbol_0, amount: pool.amount_0, token: pool.token0 }, { id: "token1", symbol: pool.symbol_1, amount: pool.amount_1, token: pool.token1 }] as tokenInfo (tokenInfo.id)}
                    <div class="token-card">
                      <div class="token-info">
                        <TokenImages tokens={[tokenInfo.token]} size={28} />
                        <div class="token-text">
                          <p class="token-symbol">{tokenInfo.symbol}</p>
                          <p
                            class="token-amount truncate"
                            title={formatToNonZeroDecimal(tokenInfo.amount)}
                          >
                            {formatToNonZeroDecimal(tokenInfo.amount)}
                          </p>
                        </div>
                      </div>
                      <div class="token-value">
                        ${calculateTokenUsdValue(
                          tokenInfo.amount,
                          tokenInfo.token,
                        )}
                      </div>
                    </div>
                  {/each}
                </div>

                <!-- Actions -->
                <div class="action-buttons">
                  <!-- Remove LP Button -->
                  <button
                    class="action-button remove-button"
                    on:click|stopPropagation={(e) =>
                      handleRemoveLiquidity(pool, e)}
                  >
                    <Minus size={16} />
                    <span>Remove Liquidity</span>
                  </button>

                  <!-- Add LP Button -->
                  <button
                    class="action-button add-button"
                    on:click|stopPropagation={(e) =>
                      handleAddLiquidity(pool, e)}
                  >
                    <Plus size={16} />
                    <span>Add Liquidity</span>
                  </button>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if $currentUserPoolsStore.loading && hasCompletedInitialLoad}
    <div class="refresh-indicator">
      <div class="loading-animation">
        <Droplets size={18} class="animate-pulse text-kong-primary" />
      </div>
    </div>
  {/if}
</div>

{#if selectedPool}
  <UserPool
    pool={selectedPool}
    bind:showModal={showUserPoolModal}
    on:liquidityRemoved={handleLiquidityRemoved}
  />
{/if}

<style lang="postcss">
  .pools-grid {
    @apply grid gap-5 p-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3;
  }

  .pool-card {
    @apply rounded-xl border border-white/[0.04] bg-white/[0.02] backdrop-blur-md
           p-5 shadow-lg transition-all duration-300 cursor-pointer
           hover:border-white/[0.08] hover:bg-white/[0.04] hover:shadow-xl
           hover:translate-y-[-2px];
  }

  .pool-card.expanded {
    @apply border-kong-primary/20 bg-white/[0.03] shadow-[0_0_15px_rgba(0,149,235,0.1)];
  }

  .pool-card-header {
    @apply flex items-center justify-center relative;
  }

  .pool-info {
    @apply flex flex-col justify-center items-center gap-4 w-full;
  }

  .token-images {
    @apply relative;
  }

  .pool-details {
    @apply flex flex-col;
  }

  .pool-name {
    @apply text-lg justify-center flex tracking-wide font-semibold text-kong-text-primary mb-2;
  }

  .pool-stats {
    @apply flex justify-center items-center gap-2 text-xs text-kong-text-primary/80;
  }

  .stat-value {
    @apply font-medium;
  }

  .stat-value.accent {
    @apply text-kong-accent-green;
  }

  .pool-value {
    @apply flex items-end gap-1;
  }

  .usd-value {
    @apply text-lg font-semibold text-kong-primary;
  }

  .expand-button {
    @apply p-1 rounded-full text-kong-text-primary/50 hover:text-kong-primary 
           hover:bg-kong-primary/10 transition-colors duration-200;
  }

  .expanded-content {
    @apply mt-5 pt-5 border-t border-white/[0.04] space-y-5;
  }

  .token-details {
    @apply space-y-3;
  }

  .section-title {
    @apply text-sm font-medium text-kong-text-primary/70 mb-2;
  }

  .token-card {
    @apply flex items-center justify-between p-3 rounded-lg 
           bg-white/[0.03] border border-white/[0.04]
           hover:bg-white/[0.05] transition-colors duration-200;
  }

  .token-info {
    @apply flex items-center gap-3;
  }

  .token-text {
    @apply flex flex-col min-w-0 max-w-[70%];
  }

  .token-symbol {
    @apply text-sm font-medium text-kong-text-primary;
  }

  .token-amount {
    @apply text-xs text-kong-text-primary/60 overflow-hidden text-ellipsis whitespace-nowrap;
  }

  .truncate {
    @apply overflow-hidden text-ellipsis whitespace-nowrap;
  }

  .token-value {
    @apply text-sm font-medium text-kong-primary;
  }

  .action-buttons {
    @apply flex gap-3 pt-2;
  }

  .action-button {
    @apply flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg
           text-sm font-medium transition-all duration-200;
  }

  .add-button {
    @apply bg-kong-accent-green/10 text-kong-accent-green border border-kong-accent-green/20
           hover:bg-kong-accent-green hover:text-white;
  }

  .remove-button {
    @apply bg-kong-accent-red/10 text-kong-accent-red border border-kong-accent-red/20
           hover:bg-kong-accent-red hover:text-white;
  }

  /* Loading State */
  .loading-state {
    @apply flex flex-col items-center justify-center h-64 gap-4;
  }

  .loading-animation {
    @apply flex items-center justify-center;
  }

  .loading-text {
    @apply text-base font-medium text-kong-text-primary/70;
  }

  /* Error State */
  .error-state {
    @apply flex flex-col items-center justify-center h-64 gap-4
           text-kong-accent-red;
  }

  .error-icon {
    @apply w-10 h-10;
  }

  .error-text {
    @apply text-base font-medium;
  }

  .retry-button {
    @apply px-4 py-2 bg-kong-bg-dark/40 text-kong-text-secondary text-xs font-medium rounded-lg
           transition-all duration-200 hover:bg-kong-bg-dark/60 hover:text-kong-text-primary
           border border-kong-border/40 hover:border-kong-accent-blue/30
           active:scale-[0.98];
  }

  /* Empty State */
  .empty-state {
    @apply flex flex-col items-center justify-center h-64 gap-4 text-center;
  }

  .empty-icon-container {
    @apply p-4 rounded-full bg-kong-primary/5 text-kong-primary/70 mb-2;
  }

  .empty-text {
    @apply text-lg font-medium text-kong-text-primary;
  }

  .search-term {
    @apply font-semibold text-kong-primary;
  }

  .empty-subtext {
    @apply text-sm text-kong-text-primary/60 max-w-md;
  }

  .empty-action-button {
    @apply mt-4 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg
           bg-kong-primary text-white font-medium
           hover:bg-kong-primary-hover transition-all duration-200;
  }

  .refresh-indicator {
    @apply fixed bottom-4 right-4 bg-white/10 backdrop-blur-md
           rounded-full p-2 shadow-lg z-30 border border-white/20;
  }
</style>
