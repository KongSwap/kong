<script lang="ts">
  import { LayoutGrid } from "lucide-svelte";
  import Badge from "$lib/components/common/Badge.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
  import { auth } from "$lib/stores/auth";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
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

  // State
  let errorMessage = $state<string | null>(null);
  let hasInitialized = $state(false);
  let isInitializing = $state(false);
  let isRefreshingLocal = $state(false);

  // Initialize store once when connected
  $effect(() => {
    if ($auth.isConnected && !hasInitialized && !isInitializing) {
      hasInitialized = true;
      isInitializing = true;
      currentUserPoolsStore.initialize()
        .catch(error => {
          console.error("Error loading user pools:", error);
          errorMessage = "Failed to load your liquidity positions.";
        })
        .finally(() => {
          isInitializing = false;
        });
    } else if (!$auth.isConnected) {
      hasInitialized = false;
      isInitializing = false;
      currentUserPoolsStore.reset();
    }
  });

  // Simple refresh handler
  async function handleRefresh() {
    if (isRefreshingLocal) return;
    
    errorMessage = null;
    isRefreshingLocal = true;
    
    try {
      // Use parent refresh if provided, otherwise refresh ourselves
      if (onRefresh) {
        onRefresh();
        // Give parent time to update its state
        setTimeout(() => {
          isRefreshingLocal = false;
        }, 100);
      } else {
        await currentUserPoolsStore.initialize();
        isRefreshingLocal = false;
      }
    } catch (error) {
      console.error("Error refreshing pools:", error);
      errorMessage = "Failed to refresh pools.";
      isRefreshingLocal = false;
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

  // Get APY for a pool
  function getPoolApy(pool: any): string {
    return pool ? formatToNonZeroDecimal(pool.rolling_24h_apy) : "0";
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

  // Simple derived state - use store data when connected
  const usingStoreData = $derived($auth.isConnected);
</script>

<div>
  <!-- Fixed header that doesn't scroll -->
  <WalletListHeader
    title="Your Liquidity Positions"
    isLoading={false}
    isRefreshing={isRefreshingLocal}
    onRefresh={handleRefresh}
  />

  <!-- Scrollable content area -->
  <div
    class="overflow-y-auto scrollbar-thin"
    style="max-height: calc(100vh - 225px);"
  >
    {#if isInitializing || (isLoading && !usingStoreData)}
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
    {:else if hasInitialized && ((usingStoreData && $currentUserPoolsStore.filteredPools.length === 0) || (!usingStoreData && liquidityPools.length === 0))}
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
                    <span class="text-kong-success">{getPoolApy(pool)}% APY</span>
                </div>
              </div>
            </div>
          </div>
        {/each}
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
