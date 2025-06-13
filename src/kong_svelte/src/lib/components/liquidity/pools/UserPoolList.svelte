<script lang="ts">
  import { fade, slide } from "svelte/transition";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import {
    formatToNonZeroDecimal,
    calculateTokenUsdValue,
  } from "$lib/utils/numberFormatUtils";
  import {
    Plus,
    Droplets,
    Flame,
  } from "lucide-svelte";
  import { onMount, onDestroy } from "svelte";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
  import { livePools } from "$lib/stores/poolStore";
  import { auth } from "$lib/stores/auth";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { goto } from "$app/navigation";

  export let searchQuery = "";

  // Simple flag for initial load only
  let hasCompletedInitialLoad = false;

  // Subscribe to the store
  // Correct type for searchQueryUnsubscribe should be handled where it's initially declared if needed.
  $: if (searchQuery !== $currentUserPoolsStore.searchQuery && currentUserPoolsStore) {
    currentUserPoolsStore.setSearchQuery(searchQuery);
  }

  let authUnsubscribe: (() => void) | null = null;
  onMount(async () => {
    authUnsubscribe = auth.subscribe(async ($authData) => {
      if ($authData.isConnected) {
        await loadUserPools();
      } else {
        // Optionally clear user pools or handle disconnect state
        hasCompletedInitialLoad = false; // Reset load state if user disconnects
      }
    });
  });

  onDestroy(() => {
    authUnsubscribe?.();
  });

  // Function to load user pools - simpler now
  async function loadUserPools() {
    if (!hasCompletedInitialLoad || !$currentUserPoolsStore.loading) { // Prevent multiple loads
      try {
        await currentUserPoolsStore.initialize();
        hasCompletedInitialLoad = true;
      } catch (error) {
        console.error("Error loading user pools:", error);
        hasCompletedInitialLoad = false; // Allow retry on error
      }
    }
  }

  // Function to refresh pools without showing loading indicator
  async function refreshUserPools() {
    if (hasCompletedInitialLoad && !$currentUserPoolsStore.loading) { // Prevent multiple refreshes
      try {
        // First reset the store to clear all existing data
        currentUserPoolsStore.reset();

        // Small delay to ensure state is cleared - CONSIDER REMOVING if store handles this well
        await new Promise(resolve => setTimeout(resolve, 50)); // Reduced delay

        // Then completely re-initialize the store with fresh data
        await currentUserPoolsStore.initialize();
      } catch (error) {
        console.error("Error refreshing user pools:", error);
      }
    }
  }

  // --- Optimization: Derived State ---
  $: userPoolsWithDetails = $currentUserPoolsStore.filteredPools.map(pool => {
    const livePool = $livePools.find(p => p.address_0 === pool.address_0 && p.address_1 === pool.address_1);
    const poolKey = pool.address_0 + '_' + pool.address_1;

    // Use the pre-calculated pool share percentage that includes fees
    const sharePercentage = pool.poolSharePercentage 
      ? formatToNonZeroDecimal(pool.poolSharePercentage) 
      : "0";

    const apy = livePool?.rolling_24h_apy
      ? formatToNonZeroDecimal(livePool.rolling_24h_apy)
      : "0";

    const usdValue = formatToNonZeroDecimal(pool.usd_balance);

    const token0UsdValue = calculateTokenUsdValue(pool.amount_0.toString(), pool.token0);
    const token1UsdValue = calculateTokenUsdValue(pool.amount_1.toString(), pool.token1);

    return {
      ...pool,
      key: poolKey,
      sharePercentage: sharePercentage,
      apy: apy,
      usdValue: usdValue,
      token0UsdValue: token0UsdValue,
      token1UsdValue: token1UsdValue,
      // Pre-format token amounts if needed frequently, otherwise format inline
      formattedAmount0: formatToNonZeroDecimal(pool.amount_0),
      formattedAmount1: formatToNonZeroDecimal(pool.amount_1),
    };
  });
  // --- End Optimization ---

  function handlePoolItemClick(pool: (typeof userPoolsWithDetails)[0]) {
    // Navigate to the position detail page
    goto(`/pools/${pool.key}/position`);
  }

</script>

<div class="mt-2">
  {#if $currentUserPoolsStore.loading && !hasCompletedInitialLoad}
    <div class="flex flex-col items-center justify-center h-64 gap-4" in:fade={{ duration: 300 }}>
      <div class="flex items-center justify-center">
        <Droplets size={32} class="animate-pulse text-kong-primary" />
      </div>
      <p class="text-base font-medium text-kong-text-primary/70">Loading your liquidity positions...</p>
    </div>
  {:else if $currentUserPoolsStore.error}
    <div class="flex flex-col items-center justify-center h-64 gap-4 text-kong-accent-red" in:fade={{ duration: 300 }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="w-10 h-10"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clip-rule="evenodd"
        />
      </svg>
      <p class="text-base font-medium">{$currentUserPoolsStore.error}</p>
      <button class="px-4 py-2 bg-kong-bg-dark/40 text-kong-text-secondary text-xs font-medium rounded-lg transition-all duration-200 hover:bg-kong-bg-dark/60 hover:text-kong-text-primary border border-kong-border/40 hover:border-kong-accent-blue/30 active:scale-[0.98]" on:click={() => refreshUserPools()}>
        Retry
      </button>
    </div>
  {:else if userPoolsWithDetails.length === 0}
    <div class="flex flex-col items-center justify-center h-64 gap-4 text-center" in:fade={{ duration: 300 }}>
      <div class="relative">
        <div class="absolute inset-0 bg-kong-primary/20 rounded-full blur-2xl animate-pulse"></div>
        <div class="relative p-5 rounded-full bg-gradient-to-br from-kong-primary/10 to-kong-primary/5 border border-kong-primary/20">
          <Droplets size={48} class="text-kong-primary" />
        </div>
      </div>
      {#if searchQuery}
        <div class="space-y-2">
          <p class="text-xl font-semibold text-kong-text-primary">
            No pools found matching "<span class="text-kong-primary">{searchQuery}</span>"
          </p>
          <p class="text-sm text-kong-text-secondary max-w-md">
            Try a different search term or check your active positions
          </p>
        </div>
      {:else}
        <div class="space-y-4">
          <div class="space-y-2">
            <p class="text-xl font-semibold text-kong-text-primary">No active liquidity positions</p>
            <p class="text-sm text-kong-text-secondary max-w-md">
              Add liquidity to a pool to start earning trading fees from swaps
            </p>
          </div>
          <ButtonV2
            theme="primary"
            variant="solid"
            size="lg"
            on:click={() => goto('/pools/add')}
          >
            <div class="flex items-center justify-center gap-2.5">
              <Plus size={18} />
              <span>Add Your First Liquidity</span>
            </div>
          </ButtonV2>
        </div>
      {/if}
    </div>
  {:else}
    <div class="overflow-x-auto w-full">
      <table class="w-full table-auto border-collapse">
        <thead class="sticky top-0 bg-kong-bg-dark/90 backdrop-blur-sm z-10">
          <tr>
            <th class="text-left pl-4 py-3 px-4 text-sm font-medium text-kong-text-secondary border-b border-white/[0.05]">Pool</th>
            <th class="text-right py-3 px-4 text-sm font-medium text-kong-text-secondary border-b border-white/[0.05]">Share</th>
            <th class="text-right py-3 px-4 text-sm font-medium text-kong-text-secondary border-b border-white/[0.05]">APR</th>
            <th class="text-right pr-4 py-3 px-4 text-sm font-medium text-kong-text-secondary border-b border-white/[0.05]">Value</th>
          </tr>
        </thead>
        <tbody>
          {#each userPoolsWithDetails as pool (pool.key)}
            <tr
              class="border-b border-white/[0.05] hover:bg-white/[0.02] cursor-pointer transition-colors duration-200"
              on:click={() => handlePoolItemClick(pool)}
              on:keydown={(e) => e.key === 'Enter' && handlePoolItemClick(pool)}
              role="button"
              tabindex="0"
            >
              <td class="py-3 px-4 text-sm text-kong-text-primary">
                <div class="flex items-center gap-3">
                  <TokenImages tokens={[pool.token0, pool.token1]} size={32} />
                  <span class="text-sm font-medium text-kong-text-primary">{pool.symbol_0}/{pool.symbol_1}</span>
                </div>
              </td>
              <td class="text-right py-4 px-4 text-sm text-kong-text-primary">
                <span class="font-medium">{pool.sharePercentage}%</span>
              </td>
              <td class="text-right py-4 px-4 text-sm text-kong-text-primary">
                <span class="font-medium text-kong-text-accent-green">{pool.apy}%</span>
              </td>
              <td class="text-right font-medium text-kong-primary py-4 px-4 text-sm">
                ${pool.usdValue}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if $currentUserPoolsStore.loading && hasCompletedInitialLoad}
    <div class="fixed bottom-4 right-4 bg-white/10 backdrop-blur-md rounded-full p-2 shadow-lg z-30 border border-white/20" role="status" aria-live="polite">
      <div class="flex items-center justify-center">
        <Droplets size={18} class="animate-pulse text-kong-primary" />
      </div>
      <span class="sr-only">Refreshing pool data</span>
    </div>
  {/if}
</div>


<style lang="postcss">
  /* Remove all styles */
</style>
