<script lang="ts">
  import { liquidityStore } from "$lib/stores/liquidityStore";
  import { livePools } from "$lib/services/pools/poolStore";
  import { fetchPoolBalanceHistory } from "$lib/api/pools";
  import TVLHistoryChart from "./charts/TVLHistoryChart.svelte";
  import PoolBalanceChart from "./charts/PoolBalanceChart.svelte";
  import type { PoolBalanceHistoryItem } from "./charts/chartUtils";
  import Panel from "$lib/components/common/Panel.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  
  // Get the pool based on selected tokens
  $: currentPool = $liquidityStore.token0 && $liquidityStore.token1 
    ? $livePools.find(p => 
        (p.address_0 === $liquidityStore.token0?.canister_id && p.address_1 === $liquidityStore.token1?.canister_id) ||
        (p.address_1 === $liquidityStore.token0?.canister_id && p.address_0 === $liquidityStore.token1?.canister_id)
      )
    : null;
    
  let balanceHistory: PoolBalanceHistoryItem[] = [];
  let isLoading = false;
  let errorMessage = '';
  
  // Track token pair to avoid unnecessary refreshes
  let previousToken0Id = null;
  let previousToken1Id = null;
  
  // Watch for changes in livePools to ensure we have data after page refresh
  $: if ($livePools.length > 0 && currentPool && !balanceHistory.length) {
    fetchBalanceHistoryData();
  }
  
  // Only refresh chart when the pool or token pair changes, not on every amount change
  $: if (currentPool) {
    const token0Id = $liquidityStore.token0?.canister_id || null;
    const token1Id = $liquidityStore.token1?.canister_id || null;
    
    // Only fetch new data if tokens have changed
    if (token0Id !== previousToken0Id || token1Id !== previousToken1Id) {
      previousToken0Id = token0Id;
      previousToken1Id = token1Id;
      fetchBalanceHistoryData();
    }
  }
  
  // Format number with commas and decimal places
  function formatNumber(num: number | bigint | undefined | null, decimals: number = 2): string {
    if (num === undefined || num === null) return '0.00';
    // Convert bigint to number if needed
    const numAsNumber = typeof num === 'bigint' ? Number(num) : num;
    return numAsNumber.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
  
  // Get fee from pool object - using lp_fee_bps
  function getPoolFee(pool: any): string {
    if (pool?.lp_fee_bps !== undefined) {
      // lp_fee_bps is typically in basis points (1/100 of 1%)
      // Convert basis points to percentage (e.g., 30 basis points = 0.3%)
      return (pool.lp_fee_bps / 100).toFixed(2) + '%';
    }
    return '0.00%';
  }
  
  // Get TVL from pool object
  function getPoolTVL(pool: any): number {
    if (pool?.tvl_usd !== undefined) return pool.tvl_usd;
    if (pool?.tvl !== undefined) return pool.tvl;
    return 0;
  }
  
  async function fetchBalanceHistoryData() {
    if (!currentPool) return;
    
    isLoading = true;
    errorMessage = '';
    
    try {
      // First try to get a numeric pool ID
      const poolId = currentPool.pool_id;
      balanceHistory = await fetchPoolBalanceHistory(poolId);
      
      if (balanceHistory && balanceHistory.length > 0) {
        // Sort data by day_index to ensure chronological order
        balanceHistory.sort((a, b) => a.day_index - b.day_index);
      } else {
        console.warn('No balance history data returned for pool ID:', poolId);
        errorMessage = 'No historical data available for this pool';
      }
    } catch (error) {
      console.error('Error fetching balance history:', error);
      errorMessage = `Failed to load chart data: ${error.message || 'Unknown error'}`;
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="flex flex-col w-full gap-4">
  <!-- Pool Information Section -->
  {#if currentPool && $liquidityStore.token0 && $liquidityStore.token1}
    <Panel variant="transparent" className="info-panel">
      <h3 class="text-sm uppercase font-medium text-kong-text-primary/90 mb-4">Pool Information</h3>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div class="flex flex-col">
          <span class="text-xs text-kong-text-primary/60 mb-1">Pair</span>
          <div class="flex items-center gap-1">
            <TokenImages 
              tokens={[$liquidityStore.token0, $liquidityStore.token1]} 
              size={20} 
              overlap={true}
              containerClass="mr-1"
            />
            <span class="text-sm font-medium text-kong-text-primary">{$liquidityStore.token0.symbol}/{$liquidityStore.token1.symbol}</span>
          </div>
        </div>
        
        <div class="flex flex-col">
          <span class="text-xs text-kong-text-primary/60 mb-1">Fee Tier</span>
          <span class="text-sm font-medium text-kong-text-primary">{getPoolFee(currentPool)}</span>
        </div>
        
        <div class="flex flex-col">
          <span class="text-xs text-kong-text-primary/60 mb-1">TVL</span>
          <span class="text-sm font-medium text-kong-text-primary">${formatNumber(getPoolTVL(currentPool))}</span>
        </div>
        
        <div class="flex flex-col">
          <span class="text-xs text-kong-text-primary/60 mb-1">Pool ID</span>
          <span class="text-sm font-medium text-kong-text-primary">{currentPool.id || currentPool.pool_id || '-'}</span>
        </div>
        
        <div class="flex flex-col">
          <span class="text-xs text-kong-text-primary/60 mb-1">{$liquidityStore.token0.symbol} Balance</span>
          <span class="text-sm font-medium text-kong-text-primary">{formatNumber(currentPool.balance_0)} {$liquidityStore.token0.symbol}</span>
        </div>
        
        <div class="flex flex-col">
          <span class="text-xs text-kong-text-primary/60 mb-1">{$liquidityStore.token1.symbol} Balance</span>
          <span class="text-sm font-medium text-kong-text-primary">{formatNumber(currentPool.balance_1)} {$liquidityStore.token1.symbol}</span>
        </div>
        
        {#if currentPool.lp_token_supply !== undefined}
        <div class="flex flex-col">
          <span class="text-xs text-kong-text-primary/60 mb-1">LP Token Supply</span>
          <span class="text-sm font-medium text-kong-text-primary">{formatNumber(currentPool.lp_token_supply)}</span>
        </div>
        {/if}
        
        {#if 'created_at' in currentPool}
        <div class="flex flex-col">
          <span class="text-xs text-kong-text-primary/60 mb-1">Created</span>
          <span class="text-sm font-medium text-kong-text-primary">{new Date(currentPool.created_at as number | string).toLocaleDateString()}</span>
        </div>
        {/if}
      </div>
    </Panel>
  {:else if $liquidityStore.token0 && $liquidityStore.token1}
    <Panel variant="transparent" className="info-panel empty-state">
      <h3 class="text-sm uppercase font-medium text-kong-text-primary/90 mb-4">Pool Information</h3>
      <div class="flex items-center justify-center gap-2 py-2">
        <TokenImages 
          tokens={[$liquidityStore.token0, $liquidityStore.token1]} 
          size={20} 
          overlap={true}
          containerClass="mr-1"
        />
        <p class="text-sm text-kong-text-primary/70 text-center py-2 my-0">No pool exists for {$liquidityStore.token0.symbol}/{$liquidityStore.token1.symbol}. Create the first liquidity position!</p>
      </div>
    </Panel>
  {:else}
    <Panel variant="transparent" className="info-panel empty-state">
      <h3 class="text-sm uppercase font-medium text-kong-text-primary/90 mb-4">Pool Information</h3>
      <p class="text-sm text-kong-text-primary/70 text-center py-2">Select tokens to view pool information</p>
    </Panel>
  {/if}

  <TVLHistoryChart 
    {balanceHistory}
    {isLoading}
    {errorMessage}
    {currentPool}
    {fetchBalanceHistoryData}
  />

  <PoolBalanceChart
    {balanceHistory}
    {isLoading}
    {errorMessage}
    {currentPool}
  />
</div> 