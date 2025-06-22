<script lang="ts">
  import { goto } from "$app/navigation";
  import { onDestroy } from "svelte";
  import { fade } from "svelte/transition";
  import Panel from "$lib/components/common/Panel.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { Droplets, ArrowLeft, Plus, Minus, Wallet, Send } from "lucide-svelte";
  import { auth } from "$lib/stores/auth";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
  import { liquidityStore } from "$lib/stores/liquidityStore";
  import { loadBalances } from "$lib/stores/tokenStore";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { livePools, loadPools } from "$lib/stores/poolStore";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import ConfirmLiquidityModal from "$lib/components/liquidity/modals/ConfirmLiquidityModal.svelte";
  import { fetchPoolBalanceHistory } from "$lib/api/pools";
  import TVLHistoryChart from "$lib/components/liquidity/create_pool/charts/TVLHistoryChart.svelte";
  
  // Constants
  const RETRY_DELAYS = {
    storeLoading: { attempts: 20, delay: 100 },
    chartLoading: { attempts: 10, delay: 500 }
  };
  
  const TABS = [
    { 
      id: 'add' as const, 
      label: 'Add', 
      icon: Plus, 
      activeClass: 'bg-kong-accent-green/10 text-kong-accent-green border border-kong-accent-green/20' 
    },
    { 
      id: 'remove' as const, 
      label: 'Remove', 
      icon: Minus, 
      activeClass: 'bg-kong-accent-red/10 text-kong-accent-red border border-kong-accent-red/20' 
    },
    { 
      id: 'send' as const, 
      label: 'Transfer', 
      icon: Send, 
      activeClass: 'bg-white/[0.05] text-kong-text-primary border border-white/[0.1]' 
    }
  ];
  
  // Import tab components
  import AddLiquidity from "$lib/components/liquidity/pools/user-pool/AddLiquidity.svelte";
  import RemoveLiquidity from "$lib/components/liquidity/pools/user-pool/RemoveLiquidity.svelte";
  import SendTokens from "$lib/components/liquidity/pools/user-pool/SendTokens.svelte";
  
  // State variables
  let pool = $state<any>(null);
  let token0 = $state<any>(null);
  let token1 = $state<any>(null);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let activeTab = $state<"add" | "remove" | "send">("add");
  let showConfirmModal = $state(false);
  let hasInitialized = $state(false);
  let loadingPoolId = $state<string | null>(null);
  let isNavigating = $state(false);
  
  // Chart state
  let balanceHistory = $state<any[]>([]);
  let isChartLoading = $state(false);
  let chartErrorMessage = $state('');
  
  // Get data from page load function
  let { data } = $props();
  
  let poolId = $derived(data.poolId);
  let address0 = $derived(data.address0);
  let address1 = $derived(data.address1);
  
  // Helper functions
  async function waitForCondition(
    condition: () => boolean, 
    maxAttempts: number, 
    delayMs: number
  ): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      if (condition()) return true;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return false;
  }
  
  function createMinimalPool(addr0: string, addr1: string) {
    return {
      address_0: addr0,
      address_1: addr1,
      symbol_0: '',
      symbol_1: '',
      ...getUserPoolDefaults()
    };
  }
  
  function getUserPoolDefaults() {
    return {
      balance: 0n,
      amount_0: 0n,
      amount_1: 0n,
      usd_balance: 0,
      poolSharePercentage: 0,
      userFeeShare0: 0n,
      userFeeShare1: 0n
    };
  }
  
  function calculateTotalEarnings() {
    let total = 0;
    if (pool.userFeeShare0 && pool.userFeeShare0 > 0 && token0) {
      // userFeeShare0 is already in decimal format
      const fee0Amount = Number(pool.userFeeShare0);
      const fee0UsdValue = fee0Amount * parseFloat(token0.metrics?.price || 0);
      total += fee0UsdValue;
    }
    if (pool.userFeeShare1 && pool.userFeeShare1 > 0 && token1) {
      // userFeeShare1 is already in decimal format
      const fee1Amount = Number(pool.userFeeShare1);
      const fee1UsdValue = fee1Amount * parseFloat(token1.metrics?.price || 0);
      total += fee1UsdValue;
    }
    return formatToNonZeroDecimal(total.toString());
  }
  
  // Load pool data when component mounts or pool ID changes
  $effect(() => {
    if (!address0 || !address1) return;
    if (!$auth.isConnected) {
      error = "Please connect your wallet to view position details";
      isLoading = false;
      return;
    }
    
    // Check if we're already loading this pool or if it's a new pool
    const newPoolId = `${address0}-${address1}`;
    if (loadingPoolId !== newPoolId && !isNavigating) {
      loadingPoolId = newPoolId;
      // Reset state when switching to a new pool
      pool = null;
      token0 = null;
      token1 = null;
      error = null;
      activeTab = "add";
      showConfirmModal = false;
      balanceHistory = [];
      chartErrorMessage = '';
      isNavigating = true;
      
      loadPoolData();
    }
  });
  
  async function loadPoolData() {
    try {
      isLoading = true;
      error = null;
            
      // Ensure live pools are loaded
      if ($livePools.length === 0) {
        console.log('[loadPoolData] No live pools loaded, fetching...');
        await loadPools();
      }
      
      let userPool = null;
      
      // Only try to get user pool data if connected
      if ($auth.isConnected) {
        
        // Initialize user pools if not already done
        if (!hasInitialized) {
          await currentUserPoolsStore.initialize();
          hasInitialized = true;
        } else if ($currentUserPoolsStore.filteredPools.length === 0 && !$currentUserPoolsStore.loading) {
          // Re-initialize if pools are empty and not loading
          await currentUserPoolsStore.initialize();
        }
        
        // Wait for store to finish loading if it's still loading
        await waitForCondition(
          () => !$currentUserPoolsStore.loading,
          RETRY_DELAYS.storeLoading.attempts,
          RETRY_DELAYS.storeLoading.delay
        );
        
        // Find the specific pool from user's pools
        // Check processedPools instead of filteredPools to include pools with zero balance
        userPool = $currentUserPoolsStore.processedPools.find(
          p => p.address_0 === address0 && p.address_1 === address1
        );
        
        
        // If not found in processedPools, check filteredPools as fallback
        if (!userPool) {
          userPool = $currentUserPoolsStore.filteredPools.find(
            p => p.address_0 === address0 && p.address_1 === address1
          );
        }
      }
      
      // If user has a pool, use it. Otherwise, look for pool in livePools or create minimal object
      if (userPool) {
        pool = userPool;
      } else {
        // Log first few pools to debug
        if ($livePools.length > 0) {
          console.log('[loadPoolData] Sample livePools:', $livePools.slice(0, 3).map(p => ({
            address_0: p.address_0,
            address_1: p.address_1
          })));
        }
        
        const livePoolData = $livePools.find(
          p => p.address_0 === address0 && p.address_1 === address1
        );
        
        if (livePoolData) {
          console.log('[loadPoolData] Live pool data:', {
            symbol_0: livePoolData.symbol_0,
            symbol_1: livePoolData.symbol_1,
            tvl: livePoolData.tvl
          });
        }
        
        pool = livePoolData 
          ? { ...livePoolData, ...getUserPoolDefaults() }
          : createMinimalPool(address0, address1);
          
      }
      
      // Fetch token data
      const tokensData = await fetchTokensByCanisterId([address0, address1]);
      token0 = tokensData.find((t: any) => t.address === address0) || null;
      token1 = tokensData.find((t: any) => t.address === address1) || null;
      
      // Initialize liquidity store with tokens
      if (token0 && token1) {
        liquidityStore.setToken(0, token0);
        liquidityStore.setToken(1, token1);
        
        // Load token balances only if connected
        if ($auth.isConnected && auth.pnp.account?.owner) {
          loadBalances([token0, token1], auth.pnp.account.owner, true);
        }
        
        // Chart data will be loaded by the effect when livePool is available
      }
    } catch (e) {
      console.error("Error loading pool data:", e);
      error = "Failed to load pool data";
      // Clear loading pool ID on error
      loadingPoolId = null;
    } finally {
      isLoading = false;
      isNavigating = false;
    }
  }
  
  // Get live pool data for APR
  let livePool = $derived($livePools.find(
    p => p.address_0 === address0 && p.address_1 === address1
  ));
  
  // Load chart data when livePool becomes available
  $effect(() => {
    if (livePool && pool && !isChartLoading && balanceHistory.length === 0) {
      loadChartData();
    }
  });
  
  // Handle liquidity actions
  function handleShowConfirmModal() {
    showConfirmModal = true;
  }
  
  async function handleLiquidityActionComplete() {
    // Refresh pool data after liquidity action
    await currentUserPoolsStore.initialize();
    // Small delay to ensure data is updated
    await new Promise(resolve => setTimeout(resolve, 100));
    // Only reload if we're not navigating
    if (!isNavigating) {
      loadPoolData();
    }
  }
  
  function resetState() {
    activeTab = "add";
    showConfirmModal = false;
    liquidityStore.resetAmounts();
  }
  
  async function loadChartData() {
    // If livePool is not available yet, wait for it
    if (!livePool) {
      // Try to wait for livePools to load
      await waitForCondition(
        () => !!livePool,
        RETRY_DELAYS.chartLoading.attempts,
        RETRY_DELAYS.chartLoading.delay
      );
      
      // If still no livePool, try to load pools manually
      if (!livePool && $livePools.length === 0) {
        try {
          await loadPools();
          // Wait a bit more for the derived value to update
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (e) {
          console.error('Error loading pools for chart:', e);
        }
      }
      
      // Final check - if still no livePool, return
      if (!livePool) {
        chartErrorMessage = 'Pool data not available for chart';
        return;
      }
    }
    
    isChartLoading = true;
    chartErrorMessage = '';
    
    try {
      const poolId = livePool.pool_id;
      balanceHistory = await fetchPoolBalanceHistory(poolId);
      
      if (balanceHistory && balanceHistory.length > 0) {
        // Sort data by day_index to ensure chronological order
        balanceHistory.sort((a, b) => a.day_index - b.day_index);
      } else {
        chartErrorMessage = 'No historical data available for this pool';
      }
    } catch (error) {
      console.error('Error fetching balance history:', error);
      chartErrorMessage = `Failed to load chart data: ${error.message || 'Unknown error'}`;
    } finally {
      isChartLoading = false;
    }
  }
  
  onDestroy(() => {
    resetState();
    // Clear loading pool ID to ensure fresh load next time
    loadingPoolId = null;
    hasInitialized = false;
    isNavigating = false;
  });
</script>

{#snippet metricPanel(title: string, value: string, details: any, valueClass = "text-kong-primary")}
  <Panel variant="solid" className="p-5">
    <p class="text-xs text-kong-text-secondary mb-3 uppercase tracking-wider font-medium">{title}</p>
    <p class="text-3xl font-bold {valueClass} mb-3">
      {value}
    </p>
    <div class="flex justify-between items-center text-xs">
      {@html details}
    </div>
  </Panel>
{/snippet}

<svelte:head>
  <title>{pool ? `${pool.symbol_0}/${pool.symbol_1}` : 'Position'} - KongSwap</title>
</svelte:head>

{#if isLoading}
  <div class="flex flex-col items-center justify-center min-h-[60vh] gap-4">
    <Droplets size={48} class="animate-pulse text-kong-primary" />
    <p class="text-lg font-medium text-kong-text-primary/70">Loading position...</p>
  </div>
{:else if error}
  <div class="flex flex-col items-center justify-center min-h-[60vh] gap-4">
    <div class="p-4 rounded-full bg-kong-accent-red/10 text-kong-accent-red">
      <Wallet size={48} />
    </div>
    <p class="text-lg font-medium text-kong-text-primary">{error}</p>
    <ButtonV2
      theme="primary"
      size="md"
      onclick={() => goto("/pools")}
    >
      <ArrowLeft size={16} />
      Back to Pools
    </ButtonV2>
  </div>
{:else if pool}
  <div class="flex flex-col max-w-[1300px] mx-auto px-4 pb-8">
    <!-- Header -->
    <div class="pb-8">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <TokenImages tokens={[token0, token1]} size={32} overlap={true} />
          <h1 class="text-2xl font-bold text-kong-text-primary">
            {pool.symbol_0 || token0?.symbol || 'Token'}/{pool.symbol_1 || token1?.symbol || 'Token'} {pool.balance > 0n ? 'Position' : 'Pool'}
          </h1>
        </div>
      </div>
      
      <!-- Key Metrics -->
      <div class="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {@render metricPanel(
          "Position Value",
          `$${formatToNonZeroDecimal(pool.usd_balance.toString())}`,
          `<div class="flex justify-between text-xs w-full">
            <div class="flex items-center gap-1">
              <span class="text-kong-text-secondary">${pool.symbol_0}:</span>
              <span class="text-kong-text-primary font-medium">${formatToNonZeroDecimal(pool.amount_0.toString())}</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-kong-text-secondary">${pool.symbol_1}:</span>
              <span class="text-kong-text-primary font-medium">${formatToNonZeroDecimal(pool.amount_1.toString())}</span>
            </div>
          </div>`
        )}
        
        {@render metricPanel(
          "Pool Share",
          `${formatToNonZeroDecimal(pool.poolSharePercentage.toString())}%`,
          `<div class="flex justify-between items-center text-xs w-full">
            <div class="flex items-center gap-1">
              <span class="text-kong-text-secondary">LP:</span>
              <span class="text-kong-text-primary font-medium">${formatToNonZeroDecimal(pool.balance.toString())}</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-kong-text-secondary">TVL:</span>
              <span class="text-kong-text-primary font-medium">$${formatToNonZeroDecimal((livePool?.tvl || 0).toString())}</span>
            </div>
          </div>`
        )}
        
        {@render metricPanel(
          "Lifetime Earnings",
          `$${calculateTotalEarnings()}`,
          `<div class="flex justify-between items-center text-xs w-full">
            <div class="flex items-center gap-2">
              ${pool.userFeeShare0 && pool.userFeeShare0 > 0 ? `
                <span class="text-kong-text-secondary">${pool.symbol_0}: <span class="text-kong-accent-green font-medium">${formatToNonZeroDecimal(pool.userFeeShare0.toString())}</span></span>
              ` : ''}
              ${pool.userFeeShare1 && pool.userFeeShare1 > 0 ? `
                <span class="text-kong-text-secondary">${pool.symbol_1}: <span class="text-kong-accent-green font-medium">${formatToNonZeroDecimal(pool.userFeeShare1.toString())}</span></span>
              ` : ''}
            </div>
            <div class="flex items-center gap-1">
              <span class="text-kong-text-secondary">APR (24h):</span>
              <span class="text-kong-accent-green font-semibold">${formatToNonZeroDecimal((livePool?.rolling_24h_apy || 0).toString())}%</span>
            </div>
          </div>`,
          "text-kong-accent-green"
        )}
      </div>
    </div>
    
    <!-- Main Content Row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <!-- TVL Chart -->
      <TVLHistoryChart
        {balanceHistory}
        isLoading={isChartLoading}
        errorMessage={chartErrorMessage}
        currentPool={livePool}
        fetchBalanceHistoryData={loadChartData}
      />
      
      <!-- Actions Panel -->
      <Panel variant="solid">
        <!-- Header and Tabs -->
        <div class="-mx-6 -mt-6 px-6 pt-5 pb-4 border-b border-kong-border/20">
          <div class="flex items-center justify-between gap-4">
            <h3 class="text-base font-semibold text-kong-text-primary whitespace-nowrap">Manage</h3>
            
            <!-- Tabs for actions -->
            <div class="flex gap-1.5 flex-1 justify-end">
              {#each TABS as tab}
                <button
                  class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 {activeTab === tab.id ? tab.activeClass : 'text-kong-text-secondary hover:text-kong-text-primary hover:bg-white/[0.02]'}"
                  onclick={() => (activeTab = tab.id)}
                >
                  <tab.icon size={12} />
                  <span>{tab.label}</span>
                </button>
              {/each}
            </div>
          </div>
        </div>
      
        <!-- Tab Content -->
        <div class="mt-6" in:fade={{ duration: 150 }}>
        {#if activeTab === "add"}
          <AddLiquidity 
            {pool} 
            {token0} 
            {token1} 
            onShowConfirmModal={handleShowConfirmModal} 
          />
        {:else if activeTab === "remove"}
          <RemoveLiquidity 
            {pool} 
            {token0} 
            {token1} 
            on:close={() => goto('/pools')} 
            on:liquidityRemoved={handleLiquidityActionComplete} 
          />
        {:else if activeTab === "send"}
          <SendTokens
            {pool}
            {token0}
            {token1}
            on:tokensSent={handleLiquidityActionComplete}
          />
        {/if}
        </div>
      </Panel>
    </div>
  </div>
{/if}

{#if showConfirmModal}
  <ConfirmLiquidityModal
    isCreatingPool={false}
    show={showConfirmModal}
    onClose={() => {
      liquidityStore.resetAmounts();
      showConfirmModal = false;
      resetState();
    }}
    on:liquidityAdded={() => {
      showConfirmModal = false;
      handleLiquidityActionComplete();
    }}
    modalKey={`confirm-liquidity-${pool.address_0}-${pool.address_1}`}
    target="#portal-target"
  />
{/if}
