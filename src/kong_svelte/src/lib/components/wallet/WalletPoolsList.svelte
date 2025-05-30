<script lang="ts">
  import { LayoutGrid, ChartPie, BarChart3, RefreshCw } from 'lucide-svelte';
  import Badge from "$lib/components/common/Badge.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
  import { auth } from "$lib/stores/auth";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { livePools } from "$lib/stores/poolStore";
  import { calculateUserPoolPercentage } from "$lib/utils/liquidityUtils";
  import UserPool from "$lib/components/liquidity/pools/UserPool.svelte";
  import WalletListHeader from "./WalletListHeader.svelte";

  // Props
  const {
    // Legacy props for backward compatibility - can be removed once fully migrated 
    liquidityPools = [],
    isLoading = false,
    // Optional callback function for refreshing data
    onRefresh = undefined,
    showUsdValues = true,
    isRefreshing = false,
  } = $props<{
    liquidityPools?: Array<{
      id: string;
      token0: { symbol: string; icon: string };
      token1: { symbol: string; icon: string };
      value: number;
      share: number;
      apr: number;
      chain: string;
    }>;
    isLoading?: boolean;
    onRefresh?: (() => void) | undefined;
    showUsdValues?: boolean;
    isRefreshing?: boolean;
  }>();
  
  // State for user pools from store
  let hasCompletedInitialLoad = $state(false);
  let errorMessage = $state<string | null>(null);
  
  // State for the UserPool modal
  let selectedPool = $state<any>(null);
  let showUserPoolModal = $state(false);
  
  // Initialize store and handle auth changes
  $effect(() => {
    if ($auth.isConnected) {
      loadUserPools();
    } else {
      currentUserPoolsStore.reset();
      hasCompletedInitialLoad = false;
    }
    
    // No need for unsubscribe in runes, as $effect cleanup happens automatically
  });
  
  // Function to load user pools
  async function loadUserPools() {
    try {
      await currentUserPoolsStore.initialize();
      hasCompletedInitialLoad = true;
    } catch (error) {
      console.error("Error loading user pools:", error);
      errorMessage = "Failed to load your liquidity positions. Please try again.";
    }
  }
  
  // Common function to refresh pools data
  async function refreshPoolsData(errorMsg = "Failed to refresh your liquidity positions. Please try again.") {
    try {
      // Don't reset the store until we have new data
      await currentUserPoolsStore.initialize();
      if (onRefresh) onRefresh();
      return true;
    } catch (error) {
      console.error("Error refreshing pools:", error);
      errorMessage = errorMsg;
      return false;
    }
  }
  
  // Function to refresh user pools with callback
  async function handleRefresh() {
    if (hasCompletedInitialLoad && onRefresh) {
      errorMessage = null;
      onRefresh();
    }
  }
  
  // Function to handle clicking on a pool item
  function handlePoolItemClick(pool: any) {
    selectedPool = pool;
    showUserPoolModal = true;
  }
  
  // Function to handle when liquidity is removed
  async function handleLiquidityRemoved() {
    showUserPoolModal = false;
    selectedPool = null;
    
    // Force a complete refresh of the pools store
    errorMessage = null;
    await refreshPoolsData("Failed to update your liquidity positions. Please try refreshing manually.");
  }
  
  // Get pool share percentage
  function getPoolSharePercentage(pool: any): string {
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
  function getPoolApy(pool: any): string {
    const livePool = $livePools.find(
      (p) => p.address_0 === pool.address_0 && p.address_1 === pool.address_1
    );
    
    return livePool?.rolling_24h_apy ? formatToNonZeroDecimal(livePool.rolling_24h_apy) : "0";
  }

  // Format currency with 2 decimal places
  function formatCurrency(value: number | string): string {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numValue);
  }
  
  // Format number with specified decimal places
  function formatNumber(value: number, decimals: number = 4): string {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    }).format(value);
  }
  
  // Determine the loading state
  const isLoadingPools = $derived($currentUserPoolsStore.loading && !hasCompletedInitialLoad);
  
  // Determine if we should use store data or legacy data
  const usingStoreData = $derived($auth.isConnected && $currentUserPoolsStore.filteredPools.length > 0);
</script>

<div>
  <!-- Fixed header that doesn't scroll -->
  <WalletListHeader
    title="Your Liquidity Positions"
    isLoading={isRefreshing || $currentUserPoolsStore.loading}
    isRefreshing={isRefreshing || $currentUserPoolsStore.loading}
    onRefresh={handleRefresh}
  />
  
  <!-- Scrollable content area -->
  <div class="overflow-y-auto scrollbar-thin" style="max-height: calc(100vh - 225px);">
    {#if isLoadingPools && !$currentUserPoolsStore.filteredPools.length || isLoading && !liquidityPools.length}
      <div class="py-10 text-center">
        <div class="animate-pulse flex flex-col items-center gap-4">
          <div class="w-16 h-16 bg-kong-text-primary/10 rounded-full"></div>
          <div class="h-4 w-36 bg-kong-text-primary/10 rounded-md"></div>
          <div class="h-3 w-48 bg-kong-text-primary/5 rounded-md"></div>
        </div>
      </div>
    {:else if errorMessage}
      <div class="py-10 text-center">
        <div class="p-5 rounded-full bg-kong-accent-red/10 inline-block mb-3 mx-auto">
          <LayoutGrid size={24} class="text-kong-accent-red/80" />
        </div>
        <p class="text-base font-medium text-kong-text-primary">Error Loading Pools</p>
        <p class="text-sm text-kong-text-secondary/70 mt-1 max-w-[300px] mx-auto mb-4">
          {errorMessage}
        </p>
        <button 
          class="px-4 py-2 bg-kong-bg-dark/40 text-kong-text-primary text-xs font-medium rounded-lg
                 border border-kong-border/40 hover:border-kong-primary/30 hover:bg-kong-bg-dark/60 
                 transition-all duration-200 active:scale-[0.98]"
          on:click={handleRefresh}
        >
          Try Again
        </button>
      </div>
    {:else if (usingStoreData && $currentUserPoolsStore.filteredPools.length === 0) || (!usingStoreData && liquidityPools.length === 0)}
      <div class="py-10 text-center">
        <div class="p-5 rounded-full bg-kong-text-primary/5 inline-block mb-3 mx-auto" style="box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.03);">
          <LayoutGrid size={24} class="text-kong-primary/40" />
        </div>
        <p class="text-base font-medium text-kong-text-primary">No Liquidity Positions</p>
        <p class="text-sm text-kong-text-secondary/70 mt-1 max-w-[280px] mx-auto">
          You don't have any active liquidity pools. Add liquidity to start earning fees.
        </p>
      </div>
    {:else if usingStoreData}
      <!-- Display pools from the store -->
      <div class="space-y-0">
        {#each $currentUserPoolsStore.filteredPools as pool}
          <div 
            class="px-4 py-3.5 bg-kong-bg-light/5 border-b border-kong-border/30 hover:bg-kong-bg-light/10 transition-colors cursor-pointer"
            on:click={() => handlePoolItemClick(pool)}
            on:keydown={(e) => e.key === "Enter" && handlePoolItemClick(pool)}
            role="button"
            tabindex="0"
          >
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <div class="flex-shrink-0">
                  <TokenImages
                    tokens={[pool.token0, pool.token1]}
                    size={28}
                    overlap={true}
                  />
                </div>
                <div class="text-sm font-medium text-kong-text-primary flex flex-col justify-center">
                  {pool.symbol_0}/{pool.symbol_1}
                </div>
              </div>
              
              <Badge variant="blue" size="xs" class="text-[10px] uppercase tracking-wide font-semibold">
                {pool.token0?.chain || "Internet Computer"}
              </Badge>
            </div>
            
            <div class="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div class="text-kong-text-secondary mb-1">Value</div>
                <div class="text-kong-text-primary font-medium">
                  {#if showUsdValues}
                    {formatCurrency(pool.usd_balance || "0")}
                  {:else}
                    $****
                  {/if}
                </div>
              </div>
              <div>
                <div class="text-kong-text-secondary mb-1">Pool Share</div>
                <div class="text-kong-text-primary font-medium">
                  <div class="flex items-center gap-1">
                    <ChartPie size={12} class="text-kong-text-secondary/70" />
                    {#if showUsdValues}
                      <span>{formatToNonZeroDecimal(getPoolSharePercentage(pool))}%</span>
                    {:else}
                      <span>****%</span>
                    {/if}
                  </div>
                </div>
              </div>
              <div>
                <div class="text-kong-text-secondary mb-1">APY</div>
                <div class="text-kong-accent-green font-medium">
                  <div class="flex items-center gap-1">
                    <BarChart3 size={12} class="text-kong-accent-green/70" />
                    <span>{getPoolApy(pool)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <!-- Legacy display for static data -->
      <div class="space-y-0">
        {#each liquidityPools as pool}
          <div 
            class="px-4 py-3.5 bg-kong-bg-light/5 border-b border-kong-border/30 hover:bg-kong-bg-light/10 transition-colors cursor-pointer"
            on:click={() => handlePoolItemClick(pool)}
            on:keydown={(e) => e.key === "Enter" && handlePoolItemClick(pool)}  
            role="button"
            tabindex="0"
          >
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <div class="flex -space-x-2 flex-shrink-0">
                  <div class="w-7 h-7 rounded-full bg-kong-text-primary/10 flex items-center justify-center border border-kong-border z-10">
                    <span class="text-xs font-bold text-kong-primary">{pool.token0.symbol}</span>
                  </div>
                  <div class="w-7 h-7 rounded-full bg-kong-text-primary/10 flex items-center justify-center border border-kong-border">
                    <span class="text-xs font-bold text-kong-primary">{pool.token1.symbol}</span>
                  </div>
                </div>
                <div class="text-sm font-medium text-kong-text-primary flex flex-col justify-center">
                  {pool.token0.symbol}/{pool.token1.symbol}
                </div>
              </div>
              
              <Badge variant="blue" size="xs" class="text-[10px] uppercase tracking-wide font-semibold">
                {pool.chain}
              </Badge>
            </div>
            
            <div class="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div class="text-kong-text-secondary mb-1">Value</div>
                <div class="text-kong-text-primary font-medium">
                  {#if showUsdValues}
                    {formatCurrency(pool.value)}
                  {:else}
                    $****
                  {/if}
                </div>
              </div>
              <div>
                <div class="text-kong-text-secondary mb-1">Pool Share</div>
                <div class="text-kong-text-primary font-medium">
                  {#if showUsdValues}
                    {formatNumber(pool.share * 100, 4)}%
                  {:else}
                    ****%
                  {/if}
                </div>
              </div>
              <div>
                <div class="text-kong-text-secondary mb-1">APR</div>
                <div class="text-kong-accent-green font-medium">{pool.apr}%</div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
    
    {#if $currentUserPoolsStore.loading && hasCompletedInitialLoad}
      <div class="px-4 py-2 mt-2 flex justify-center">
        <div class="text-xs text-kong-text-secondary animate-pulse flex items-center gap-1.5">
          <RefreshCw size={12} class="animate-spin" />
          <span>Refreshing pools...</span>
        </div>
      </div>
    {/if}
  </div>
</div>

{#if selectedPool}
  <UserPool
    pool={selectedPool}
    bind:showModal={showUserPoolModal}
    on:liquidityRemoved={handleLiquidityRemoved}
  />
{/if}

<style>
  /* Scrollbar styling */
  :global(.scrollbar-thin::-webkit-scrollbar) {
    width: 0.375rem; /* w-1.5 */
  }

  :global(.scrollbar-thin::-webkit-scrollbar-track) {
    background-color: transparent; /* bg-transparent */
  }

  :global(.scrollbar-thin::-webkit-scrollbar-thumb) {
    background-color: var(--kong-border); /* bg-kong-border */
    border-radius: 9999px; /* rounded-full */
  }
</style> 