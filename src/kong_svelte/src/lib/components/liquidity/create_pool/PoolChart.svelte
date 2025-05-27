<script lang="ts">
  import { liquidityStore } from "$lib/stores/liquidityStore";
  import { livePools } from "$lib/stores/poolStore";
  import { fetchPoolBalanceHistory } from "$lib/api/pools";
  import TVLHistoryChart from "./charts/TVLHistoryChart.svelte";
  import PoolBalanceChart from "./charts/PoolBalanceChart.svelte";
  import type { PoolBalanceHistoryItem } from "./charts/chartUtils";

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