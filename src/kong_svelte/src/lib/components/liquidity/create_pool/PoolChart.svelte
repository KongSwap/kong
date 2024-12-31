<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { liquidityStore } from "$lib/services/liquidity/liquidityStore";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { livePools } from "$lib/services/pools/poolStore";
  import { BarChart3 } from "lucide-svelte";

  // Get the pool based on selected tokens
  $: currentPool = $liquidityStore.token0 && $liquidityStore.token1 
    ? $livePools.find(p => 
        (p.address_0 === $liquidityStore.token0?.canister_id && p.address_1 === $liquidityStore.token1?.canister_id) ||
        (p.address_1 === $liquidityStore.token0?.canister_id && p.address_0 === $liquidityStore.token1?.canister_id)
      )
    : null;
</script>

<div class="charts-container">
  <Panel variant="transparent" className="!p-0 !overflow-visible">
    <div class="flex flex-col">
      <h3 class="chart-title flex items-center justify-between py-3 px-5">
        TVL History
        <div class="text-kong-text-primary/90">
          ${currentPool?.tvl ? formatBalance(currentPool.tvl, 6, 2) : '0.00'}
        </div>
      </h3>
      <div class="chart-container" style="height: 250px;">
        <div class="coming-soon">
          <BarChart3 class="mb-3 w-8 h-8" />
          Charts Coming Soon
        </div>
      </div>
    </div>
  </Panel>

  <Panel variant="transparent" className="!p-0 !overflow-visible">
    <div class="flex flex-col">
      <h3 class="chart-title flex items-start justify-between py-3 px-5">
        Pool Balance
        <div class="text-kong-text-primary/90 flex items-center gap-2">
          {#if currentPool && $liquidityStore.token0 && $liquidityStore.token1}
            <div class="flex items-center gap-1">
              <span>{formatBalance(currentPool.balance_0, $liquidityStore.token0.decimals, 2)}</span>
              <span class="text-kong-accent-green/80 text-sm mt-1">{$liquidityStore.token0.symbol}</span>
            </div>
            <div class="flex items-center gap-1">
              <span>{formatBalance(currentPool.balance_1, $liquidityStore.token1.decimals, 2)}</span>
              <span class="text-kong-primary/80 text-sm mt-1">{$liquidityStore.token1.symbol}</span>
            </div>
          {:else}
            <div class="flex items-center gap-1">
              <span>0.00</span>
              <span class="text-kong-accent-green/80 text-sm mt-1">{$liquidityStore.token0?.symbol || '-'}</span>
            </div>
            <div class="flex items-center gap-1">
              <span>0.00</span>
              <span class="text-kong-primary/80 text-sm mt-1">{$liquidityStore.token1?.symbol || '-'}</span>
            </div>
          {/if}
        </div>
      </h3>
      <div class="chart-container pt-4" style="height: 300px;">
        <div class="coming-soon">
          <BarChart3 class="mb-3 w-8 h-8" />
          Charts Coming Soon
        </div>
      </div>
    </div>
  </Panel>
</div>

<style lang="postcss">
  .charts-container {
    @apply flex flex-col w-full gap-6;
  }

  .chart-title {
    @apply text-lg font-medium text-kong-text-primary/90;
  }

  .chart-container {
    @apply relative m-0 overflow-visible;
  }

  .coming-soon {
    @apply w-full h-full flex flex-col items-center justify-center text-kong-text-primary/60 text-lg font-medium;
  }
</style> 