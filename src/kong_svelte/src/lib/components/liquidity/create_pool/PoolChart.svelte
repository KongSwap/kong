<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { liquidityStore } from "$lib/services/liquidity/liquidityStore";
  import { onMount } from "svelte";
  import Chart from "chart.js/auto";
  import { getTVLChartConfig } from "./charts/tvlChartConfig";
  import { getBalanceChartConfig } from "./charts/balanceChartConfig";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { poolStore } from "$lib/services/pools/poolStore";

  let tvlChartCanvas: HTMLCanvasElement;
  let balanceChartCanvas: HTMLCanvasElement;
  let tvlChart: Chart | null = null;
  let balanceChart: Chart | null = null;

  function createTVLChart() {
    if (!tvlChartCanvas) return;
    if (tvlChart) tvlChart.destroy();
    const ctx = tvlChartCanvas.getContext('2d');
    if (!ctx) return;
    
    const config = getTVLChartConfig();
    tvlChart = new Chart(ctx, config as any);
  }

  function createBalanceChart() {
    if (!balanceChartCanvas) return;
    if (balanceChart) balanceChart.destroy();
    const ctx = balanceChartCanvas.getContext('2d');
    if (!ctx) return;
    
    // Get tokens from the liquidity store
    const token0 = $liquidityStore.token0;
    const token1 = $liquidityStore.token1;
    
    if (!token0 || !token1) return;
    
    const config = getBalanceChartConfig(token0, token1);
    config.options = {
      ...config.options,
      layout: {
        padding: {
          left: 0,
          right: 0,
          top: 0,
          bottom: 0
        }
      },
      maintainAspectRatio: false,
      responsive: true
    };
    balanceChart = new Chart(ctx, config);
  }

  // Get the pool based on selected tokens
  $: currentPool = $liquidityStore.token0 && $liquidityStore.token1 
    ? $poolStore.pools.find(p => 
        (p.address_0 === $liquidityStore.token0?.canister_id && p.address_1 === $liquidityStore.token1?.canister_id) ||
        (p.address_1 === $liquidityStore.token0?.canister_id && p.address_0 === $liquidityStore.token1?.canister_id)
      )
    : null;

  $: if ($liquidityStore.token0 && $liquidityStore.token1) {
    setTimeout(() => {
      createTVLChart();
      createBalanceChart();
    }, 0);
  }

  onMount(() => {
    if ($liquidityStore.token0 && $liquidityStore.token1) {
      createTVLChart();
      createBalanceChart();
    }
  });
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
        {#if $liquidityStore.token0 && $liquidityStore.token1}
          <canvas bind:this={tvlChartCanvas}></canvas>
        {:else}
          <div class="empty-state">
            Select tokens to view TVL distribution
          </div>
        {/if}
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
        {#if $liquidityStore.token0 && $liquidityStore.token1}
          <canvas bind:this={balanceChartCanvas}></canvas>
        {:else}
          <div class="empty-state">
            Select tokens to view pool balance history
          </div>
        {/if}
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

  .empty-state {
    @apply w-full h-full flex items-center justify-center text-kong-text-primary/40 text-sm;
  }

  .chart-container canvas {
    @apply w-full h-full !important;
    image-rendering: crisp-edges;
  }
</style> 