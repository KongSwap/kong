<script lang="ts">
  import { LayoutGrid, RefreshCw } from "lucide-svelte";
  import Badge from "$lib/components/common/Badge.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
  import { auth } from "$lib/stores/auth";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { calculateUserPoolPercentage } from "$lib/utils/liquidityUtils";
  import { livePools } from "$lib/stores/poolStore";
  import { goto } from "$app/navigation";
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
    onNavigate = undefined,
  } = $props<{
    liquidityPools?: Array<{
      id: string;
      token0: { symbol: string; icon: string };
      token1: { symbol: string; icon: string };
      value: number;
      share: string;
      apr: number;
      chain: string;
    }>;
    isLoading?: boolean;
    onRefresh?: (() => void) | undefined;
    showUsdValues?: boolean;
    isRefreshing?: boolean;
    onNavigate?: ((path: string) => void) | undefined;
  }>();

  // State for user pools from store
  let hasCompletedInitialLoad = $state(false);
  let errorMessage = $state<string | null>(null);
  let isInitializing = $state(false);

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
    if (isInitializing) return; // Prevent multiple simultaneous loads
    
    isInitializing = true;
    try {
      await currentUserPoolsStore.initialize();
      hasCompletedInitialLoad = true;
    } catch (error) {
      console.error("Error loading user pools:", error);
      errorMessage =
        "Failed to load your liquidity positions. Please try again.";
    } finally {
      isInitializing = false;
    }
  }

  // Common function to refresh pools data
  async function refreshPoolsData(
    errorMsg = "Failed to refresh your liquidity positions. Please try again.",
  ) {
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
    if (!$currentUserPoolsStore.loading && !isInitializing) {
      errorMessage = null;
      
      // Refresh the store data
      await loadUserPools();
      
      // Call the parent's refresh callback if provided
      if (onRefresh) {
        onRefresh();
      }
    }
  }

  // Function to handle clicking on a pool item
  function handlePoolItemClick(pool: any) {
    // Build the pool ID
    const poolId = `${pool.address_0}_${pool.address_1}`;
    const path = `/pools/${poolId}/position`;
    
    // If we have an onNavigate callback (which closes the sidebar), use it
    if (onNavigate) {
      onNavigate(path);
    } else {
      // Otherwise just navigate normally
      goto(path);
    }
  }

  // Get pool share percentage
  function getPoolSharePercentage(pool: any): string {
    const livePool = $livePools.find(
      (p) => p.address_0 === pool.address_0 && p.address_1 === pool.address_1,
    );

    return calculateUserPoolPercentage(
      livePool?.balance_0 + livePool?.lp_fee_0,
      livePool?.balance_1 + livePool?.lp_fee_1,
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

  // Format currency with 2 decimal places
  function formatCurrency(value: number | string): string {
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numValue);
  }

  // Determine the loading state
  const isLoadingPools = $derived(
    $currentUserPoolsStore.loading && !hasCompletedInitialLoad,
  );

  // Determine if we should use store data or legacy data
  const usingStoreData = $derived(
    $auth.isConnected && $currentUserPoolsStore.filteredPools.length > 0,
  );
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
  <div
    class="overflow-y-auto scrollbar-thin"
    style="max-height: calc(100vh - 225px);"
  >
    {#if (isLoadingPools && !$currentUserPoolsStore.filteredPools.length) || (isLoading && !liquidityPools.length)}
      <div class="py-10 text-center">
        <div class="animate-pulse flex flex-col items-center gap-4">
          <div class="w-16 h-16 bg-kong-text-primary/10 rounded-full"></div>
          <div class="h-4 w-36 bg-kong-text-primary/10 rounded-md"></div>
          <div class="h-3 w-48 bg-kong-text-primary/5 rounded-md"></div>
        </div>
      </div>
    {:else if errorMessage}
      <div class="py-10 text-center">
        <div
          class="p-5 rounded-full bg-kong-error/10 inline-block mb-3 mx-auto"
        >
          <LayoutGrid size={24} class="text-kong-error/80" />
        </div>
        <p class="text-base font-medium text-kong-text-primary">
          Error Loading Pools
        </p>
        <p
          class="text-sm text-kong-text-secondary/70 mt-1 max-w-[300px] mx-auto mb-4"
        >
          {errorMessage}
        </p>
        <button
          class="px-4 py-2 bg-kong-bg-primary/40 text-kong-text-primary text-xs font-medium rounded-lg
                 border border-kong-border/40 hover:border-kong-primary/30 hover:bg-kong-bg-primary/60
                 transition-all duration-200 active:scale-[0.98]"
          onclick={handleRefresh}
        >
          Try Again
        </button>
      </div>
    {:else if (usingStoreData && $currentUserPoolsStore.filteredPools.length === 0) || (!usingStoreData && liquidityPools.length === 0)}
      <div class="py-10 text-center">
        <div
          class="p-5 rounded-full bg-kong-text-primary/5 inline-block mb-3 mx-auto"
          style="box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.03);"
        >
          <LayoutGrid size={24} class="text-kong-primary/40" />
        </div>
        <p class="text-base font-medium text-kong-text-primary">
          No Liquidity Positions
        </p>
        <p
          class="text-sm text-kong-text-secondary/70 mt-1 max-w-[280px] mx-auto"
        >
          You don't have any active liquidity pools. Add liquidity to start
          earning fees.
        </p>
      </div>
    {:else if usingStoreData}
      <!-- Display pools from the store -->
      <div class="space-y-0">
        {#each $currentUserPoolsStore.filteredPools as pool}
          <div
            class="px-4 md:px-4 py-3.5 bg-kong-bg-secondary/5 border-t border-kong-border/80 hover:bg-kong-primary/10 transition-all duration-200 cursor-pointer"
            onclick={() => handlePoolItemClick(pool)}
            onkeydown={(e) => e.key === "Enter" && handlePoolItemClick(pool)}
            role="button"
            tabindex="0"
          >
            <div class="flex items-center gap-3">
              <div class="flex-shrink-0">
                <TokenImages
                  tokens={[pool.token0, pool.token1]}
                  size={38}
                  overlap={true}
                />
              </div>
              <div class="flex flex-col"> 
              <span class="text-sm text-kong-text-primary">
                {pool.symbol_0}/{pool.symbol_1}
              </span>
              <span class="text-xs text-kong-text-secondary/90">
                {formatToNonZeroDecimal(pool.amount_0)} {pool.symbol_0} / {formatToNonZeroDecimal(pool.amount_1)} {pool.symbol_1}
              </span>
              </div>
              <div class="flex-grow flex justify-end">
                  <div class="flex flex-col items-end gap-1 text-xs text-kong-text-secondary">
                    <span class="font-medium text-sm text-kong-text-primary">
                      {#if showUsdValues}
                        {formatCurrency(pool.usd_balance || "0")}
                      {:else}
                        $****
                      {/if}
                    </span>
                    <span class="text-kong-success">{getPoolApy(pool)}% APR</span>
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
            class="px-4 py-3.5 bg-kong-bg-secondary/5 border-b border-kong-border hover:bg-kong-bg-secondary/10 transition-colors cursor-pointer"
            onclick={() => handlePoolItemClick(pool)}
            onkeydown={(e) => e.key === "Enter" && handlePoolItemClick(pool)}
            role="button"
            tabindex="0"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div class="flex -space-x-2 flex-shrink-0">
                  <div
                    class="w-7 h-7 rounded-full bg-kong-text-primary/10 flex items-center justify-center border border-kong-border z-10"
                  >
                    <span class="text-xs font-bold text-kong-primary"
                      >{pool.token0.symbol}</span
                    >
                  </div>
                  <div
                    class="w-7 h-7 rounded-full bg-kong-text-primary/10 flex items-center justify-center border border-kong-border"
                  >
                    <span class="text-xs font-bold text-kong-primary"
                      >{pool.token1.symbol}</span
                    >
                  </div>
                </div>
                <span class="text-sm font-medium text-kong-text-primary"
                  >{pool.token0.symbol}/{pool.token1.symbol}</span
                >
              </div>
              <Badge
                variant="blue"
                size="xs"
                class="text-[10px] uppercase tracking-wide font-semibold"
              >
                {pool.chain}
              </Badge>
            </div>

            <div class="grid grid-cols-3 gap-2 text-xs mt-2">
              <div>
                <div class="text-kong-text-secondary">Value</div>
                <div class="text-kong-text-primary font-medium mt-0.5">
                  {#if showUsdValues}
                    {formatCurrency(pool.value)}
                  {:else}
                    $****
                  {/if}
                </div>
              </div>
              <div>
                <div class="text-kong-text-secondary">Pool Share</div>
                <div class="text-kong-text-primary font-medium mt-0.5">
                  {#if showUsdValues}
                    {getPoolSharePercentage(pool)}%
                  {:else}
                    ****%
                  {/if}
                </div>
              </div>
              <div>
                <div class="text-kong-text-secondary">APR</div>
                <div class="text-kong-success font-medium mt-0.5">
                  {pool.apr}%
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    {#if isRefreshing && hasCompletedInitialLoad}
      <div class="px-4 py-2 mt-2 flex justify-center">
        <div
          class="text-xs text-kong-text-secondary animate-pulse flex items-center gap-1.5"
        >
          <RefreshCw size={12} class="animate-spin" />
          <span>Refreshing pools...</span>
        </div>
      </div>
    {/if}
  </div>
</div>

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
