<script lang="ts">
  import { fade, slide } from "svelte/transition";
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
  } from "lucide-svelte";
  import UserPool from "$lib/components/liquidity/pools/UserPool.svelte";
  import { onMount, onDestroy } from "svelte";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
  import { livePools } from "$lib/stores/poolStore";
  import { auth } from "$lib/stores/auth";
    import { goto } from "$app/navigation";

  export let searchQuery = "";

  let expandedPoolId: string | null = null;
  let selectedPool: any = null;
  let showUserPoolModal = false;

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
    const poolKey = pool.address_0 + '-' + pool.address_1;

    const sharePercentage = calculateUserPoolPercentage(
      livePool?.balance_0,
      livePool?.balance_1,
      pool.amount_0,
      pool.amount_1
    );

    const apy = livePool?.rolling_24h_apy
      ? formatToNonZeroDecimal(livePool.rolling_24h_apy)
      : "0";

    const usdValue = formatToNonZeroDecimal(pool.usd_balance);

    const token0UsdValue = calculateTokenUsdValue(pool.amount_0, pool.token0);
    const token1UsdValue = calculateTokenUsdValue(pool.amount_1, pool.token1);

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
    if (expandedPoolId === pool.key) {
      expandedPoolId = null;
    } else {
      expandedPoolId = pool.key;
    }
  }

  function handleAddLiquidity(pool: any, event: Event) {
    event.stopPropagation();
    // Ensure we pass the original pool data structure if UserPool expects it
    const originalPool = $currentUserPoolsStore.filteredPools.find(p => (p.address_0 + '-' + p.address_1) === pool.key);
    selectedPool = { ...(originalPool || pool), initialTab: "add" }; // Fallback to derived pool if needed
    showUserPoolModal = true;
  }

  function handleRemoveLiquidity(pool: any, event: Event) {
    event.stopPropagation();
    const originalPool = $currentUserPoolsStore.filteredPools.find(p => (p.address_0 + '-' + p.address_1) === pool.key);
    selectedPool = { ...(originalPool || pool), initialTab: "remove" };
    showUserPoolModal = true;
  }

  function handleLiquidityActionComplete() {
    showUserPoolModal = false;
    selectedPool = null;
    // Refresh the pools after liquidity is added or removed
    refreshUserPools();
  }
</script>

<div class="">
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
      <div class="p-4 rounded-full bg-kong-primary/5 text-kong-primary/70 mb-2">
        <Droplets size={40} class="" />
      </div>
      {#if searchQuery}
        <p class="text-lg font-medium text-kong-text-primary">
          No pools found matching "<span class="font-semibold text-kong-primary">{searchQuery}</span
          >"
        </p>
        <p class="text-sm text-kong-text-primary/60 max-w-md">
          Try a different search term or check your active positions
        </p>
      {:else}
        <p class="text-lg font-medium text-kong-text-primary">No active liquidity positions</p>
        <p class="text-sm text-kong-text-primary/60 max-w-md">
          Add liquidity to a pool to start earning fees
        </p>
        <button on:click={() => {
          goto("/pools/add");
        }} class="mt-4 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-kong-primary text-white font-medium hover:bg-kong-primary-hover transition-all duration-200">
          <Plus size={16} />
          <span>Add Liquidity</span>
        </button>
      {/if}
    </div>
  {:else}
    <div class="overflow-x-auto w-full">
      <table class="w-full table-auto border-collapse">
        <tbody>
          {#each userPoolsWithDetails as pool (pool.key)}
            <tr
              class="border-b border-white/[0.05] hover:bg-white/[0.04] cursor-pointer transition-colors duration-200 {expandedPoolId === pool.key ? 'bg-white/[0.03] border-b-0' : ''}"
              on:click={() => handlePoolItemClick(pool)}
              on:keydown={(e) => e.key === 'Enter' && handlePoolItemClick(pool)}
              role="button"
              tabindex="0"
              aria-expanded={expandedPoolId === pool.key}
            >
              <td class="py-3 px-4 text-sm text-kong-text-primary">
                <div class="flex items-center gap-3">
                  <TokenImages tokens={[pool.token0, pool.token1]} size={32} />
                  <span class="text-sm font-medium text-kong-text-primary">{pool.symbol_0}/{pool.symbol_1}</span>
                </div>
              </td>
              <td class="text-right py-4 px-4 text-sm text-kong-text-primary">
                <div class="flex items-center justify-end gap-1">
                  <span class="font-medium">{pool.sharePercentage}%</span>
                </div>
              </td>
              <td class="text-right py-4 px-4 text-sm text-kong-text-primary">
                <div class="flex items-center justify-end gap-1 text-kong-text-accent-green">
                  <span class="font-medium text-kong-text-accent-green">{pool.apy}%</span>
                </div>
              </td>
              <td class="text-right font-medium text-kong-primary py-4 px-4 text-sm">
                ${pool.usdValue}
              </td>
              <td class="text-center py-4 px-4 text-sm text-kong-text-primary">
                <button
                  class="p-1 text-kong-text-primary/60 hover:text-kong-primary transition-colors duration-200"
                  aria-label="Toggle pool details"
                  aria-controls="expanded-content-{pool.key}"
                >
                  {#if expandedPoolId === pool.key}
                    <ChevronUp size={18} />
                  {:else}
                    <ChevronDown size={18} />
                  {/if}
                </button>
              </td>
            </tr>

            {#if expandedPoolId === pool.key}
              <tr class="bg-transparent">
                <td colspan="5" class="p-0"> 
                   <div id="expanded-content-{pool.key}" transition:slide={{ duration: 200 }} class="mt-5 pt-5 border-t border-white/[0.04] space-y-5 px-5 py-5 mx-4 mb-4 rounded-lg bg-white/[0.04] border border-white/[0.08] shadow-inner backdrop-blur-sm overflow-hidden">
                      <div class="space-y-4">
                        <div class="mb-3">
                         <h4 class="text-sm font-medium text-kong-text-primary/80 uppercase tracking-wide">Your Tokens</h4>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                          {#each [{ id: "token0", symbol: pool.symbol_0, amount: pool.formattedAmount0, token: pool.token0, usdValue: pool.token0UsdValue }, { id: "token1", symbol: pool.symbol_1, amount: pool.formattedAmount1, token: pool.token1, usdValue: pool.token1UsdValue }] as tokenInfo (tokenInfo.id)}
                            <div class="flex items-center justify-between p-3 rounded-lg bg-black/10 border border-white/[0.06] hover:bg-black/20 transition-colors duration-200">
                              <div class="flex items-center gap-3">
                                <TokenImages tokens={[tokenInfo.token]} size={24} />
                                <div class="flex flex-col min-w-0 max-w-[70%]">
                                  <p class="text-sm font-medium text-kong-text-primary">{tokenInfo.symbol}</p>
                                  <p
                                    class="text-xs text-kong-text-primary/70 overflow-hidden text-ellipsis whitespace-nowrap"
                                    title={tokenInfo.amount}
                                  >
                                    {tokenInfo.amount}
                                  </p>
                                </div>
                              </div>
                              <div class="text-sm font-medium text-kong-primary">
                                ${tokenInfo.usdValue}
                              </div>
                            </div>
                          {/each}
                        </div>

                        <div class="flex gap-3 pt-1">
                          <button
                            class="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm bg-kong-accent-red/10 text-kong-accent-red border border-kong-accent-red/20 hover:bg-kong-accent-red hover:text-white shadow-[0_0_10px_rgba(235,87,87,0.1)]"
                            on:click|stopPropagation={(e) => handleRemoveLiquidity(pool, e)}
                          >
                            <Minus size={16} />
                            <span>Remove Liquidity</span>
                          </button>

                          <button
                            class="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm bg-kong-accent-green/10 text-kong-accent-green border border-kong-accent-green/20 hover:bg-kong-accent-green hover:text-white shadow-[0_0_10px_rgba(39,174,96,0.1)]"
                            on:click|stopPropagation={(e) => handleAddLiquidity(pool, e)}
                          >
                            <Plus size={16} />
                            <span>Add Liquidity</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
            {/if}
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

{#if selectedPool}
  <UserPool
    pool={selectedPool}
    bind:showModal={showUserPoolModal}
    on:liquidityRemoved={handleLiquidityActionComplete}
    on:liquidityAdded={handleLiquidityActionComplete}
  />
{/if}

<style lang="postcss">
  /* Remove all styles */
</style>
