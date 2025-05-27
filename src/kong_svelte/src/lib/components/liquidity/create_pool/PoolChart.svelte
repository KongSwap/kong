<script lang="ts">
  import { liquidityStore } from "$lib/stores/liquidityStore";
  import { livePools } from "$lib/stores/poolStore";
  import { fetchPoolBalanceHistory } from "$lib/api/pools";
  import TVLHistoryChart from "./charts/TVLHistoryChart.svelte";
  import PoolBalanceChart from "./charts/PoolBalanceChart.svelte";
  import type { PoolBalanceHistoryItem } from "./charts/chartUtils";
  import Panel from "$lib/components/common/Panel.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  
  // State variables
  let balanceHistory = $state<PoolBalanceHistoryItem[]>([]);
  let isLoading = $state(false);
  let errorMessage = $state('');
  let currentPoolId = $state<number | null>(null);
  
  // Get the pool based on selected tokens
  let currentPool = $derived(
    $liquidityStore.token0 && $liquidityStore.token1 
      ? $livePools.find(p => 
          (p.address_0 === $liquidityStore.token0?.address && p.address_1 === $liquidityStore.token1?.address) ||
          (p.address_1 === $liquidityStore.token0?.address && p.address_0 === $liquidityStore.token1?.address)
        )
      : null
  );
  
  // Format number with commas and decimal places
  function formatNumber(num: number | bigint | undefined | null, decimals: number = 2): string {
    if (num === undefined || num === null) return '0.00';
    const numAsNumber = typeof num === 'bigint' ? Number(num) : num;
    return numAsNumber.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
  
  // Get fee from pool object
  function getPoolFee(pool: any): string {
    if (pool?.lp_fee_bps !== undefined) {
      return (pool.lp_fee_bps / 100).toFixed(2) + '%';
    }
    return '0.00%';
  }
  
  // Get TVL from pool object
  function getPoolTVL(pool: any): number {
    return pool?.tvl_usd ?? pool?.tvl ?? 0;
  }
  
  async function fetchBalanceHistoryData() {
    if (!currentPool) return;
    
    isLoading = true;
    errorMessage = '';
    
    try {
      const poolId = currentPool.pool_id;
      const data = await fetchPoolBalanceHistory(poolId);
      
      if (data && data.length > 0) {
        // Sort data by day_index to ensure chronological order
        balanceHistory = data.sort((a, b) => a.day_index - b.day_index);
      } else {
        console.warn('No balance history data returned for pool ID:', poolId);
        errorMessage = 'No historical data available for this pool';
        balanceHistory = [];
      }
    } catch (error) {
      console.error('Error fetching balance history:', error);
      errorMessage = `Failed to load chart data: ${error.message || 'Unknown error'}`;
      balanceHistory = [];
    } finally {
      isLoading = false;
    }
  }
  
  // Only fetch data when pool changes
  $effect(() => {
    const poolId = currentPool?.pool_id;
    
    // Only fetch if pool ID has changed
    if (poolId !== undefined && poolId !== currentPoolId) {
      currentPoolId = poolId;
      fetchBalanceHistoryData();
    } else if (!currentPool && currentPoolId !== null) {
      // Clear data when no pool is selected
      currentPoolId = null;
      balanceHistory = [];
      errorMessage = '';
    }
  });
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
          <span class="text-sm font-medium text-kong-text-primary">{currentPool.pool_id || '-'}</span>
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