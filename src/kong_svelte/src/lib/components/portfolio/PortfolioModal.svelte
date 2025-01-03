<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';
  import { onMount } from "svelte";
  import { portfolioValue, tokenStore } from "$lib/services/tokens/tokenStore";
  import { liveTokens } from "$lib/services/tokens/tokenStore";
  import { liveUserPools } from "$lib/services/pools/poolStore";
  import { getChartColors, getChartOptions } from './chartConfig';
  import { processPortfolioData, createChartData } from './portfolioDataProcessor';
  import { calculateRiskMetrics } from './riskAnalyzer';

  Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

  export let isOpen = false;
  export let onClose = () => {};

  let tokenPercentage = 0;
  let lpPercentage = 0;
  let riskScore = 0;
  let dailyChange = 0;
  let bestPerformer = { symbol: '', change: 0 };
  let highestValue = 0;
  let lowestValue = 0;
  
  let canvas: HTMLCanvasElement;
  let chart: Chart;
  let currentData: any = null;

  function handleRefresh() {
    if (chart) {
      chart.destroy();
      chart = null;
    }
    updateChart();
  }

  // Helper function to safely serialize data
  function safeSerialize(obj: any): string {
    return JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
  }

  // Calculate portfolio data
  $: portfolioData = (() => {
    const tokens = $liveTokens;
    const balances = $tokenStore.balances;
    const userPools = $liveUserPools;
    
    const dataKey = safeSerialize({ 
      tokens: tokens.map(t => t.canister_id),
      balances: Object.keys(balances),
      userPools: userPools.map(p => p.pool_id)
    });
    
    if (currentData?.key === dataKey) {
      return currentData.data;
    }

    const { topPositions, otherPositions } = processPortfolioData(tokens, balances, userPools);
    const { colors, getBorderColors } = getChartColors();
    const borderColors = getBorderColors(colors);
    
    const chartData = createChartData(topPositions, otherPositions, colors, borderColors);

    currentData = { key: dataKey, data: chartData };
    return chartData;
  })();

  function updateChart() {
    if (!canvas || !isOpen) return;

    if (chart) {
      chart.destroy();
    }

    const isDark = document.documentElement.classList.contains('dark');
    chart = new Chart(canvas, {
      type: 'doughnut',
      data: portfolioData,
      options: getChartOptions(isDark)
    });
  }

  $: if (isOpen && canvas) {
    setTimeout(() => updateChart(), 0);
  }

  onMount(() => {
    return () => {
      if (chart) {
        chart.destroy();
        chart = null;
      }
    };
  });

  // Calculate risk metrics
  $: riskMetrics = (() => {
    const { topPositions, otherPositions } = processPortfolioData(
      $liveTokens,
      $tokenStore.balances,
      $liveUserPools
    );
    return calculateRiskMetrics([...topPositions, ...otherPositions]);
  })();

  // Calculate percentages
  $: {
    const totalValue = Number($portfolioValue.replace(/[^0-9.-]+/g, ""));
    const tokenValue = $liveTokens.reduce((acc, token) => {
      const balance = $tokenStore.balances[token.canister_id]?.in_usd;
      return acc + (balance ? Number(balance) : 0);
    }, 0);
    const lpValue = totalValue - tokenValue;
    
    tokenPercentage = totalValue ? Math.round((tokenValue / totalValue) * 100) : 0;
    lpPercentage = totalValue ? Math.round((lpValue / totalValue) * 100) : 0;
    riskScore = riskMetrics.diversificationScore;
  }
</script>

<Modal
  {isOpen}
  {onClose}
  width="500px"
  height="auto"
  minHeight="400px"
>
  <h2 slot="title" class="text-lg font-medium text-kong-text-primary">Portfolio Distribution</h2>
  
  <div class="p-4 flex flex-col gap-4 rounded-lg">
    <div class="text-center mb-4">
      <h3 class="text-lg font-medium text-kong-text-primary">Total Value</h3>
      <p class="text-2xl font-bold text-kong-text-primary">${$portfolioValue}</p>
    </div>
    
    <div 
      class="chart-container flex items-center justify-center" 
      style="position: relative; height:300px; width:100%"
    >
      <canvas bind:this={canvas}></canvas>
    </div>

    <div class="flex justify-center mt-2">
      <button
        on:click={handleRefresh}
        class="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-kong-primary text-white rounded-lg hover:bg-kong-primary-hover transition-colors"
      >
        <svg 
          class="w-4 h-4" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2" 
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        Refresh
      </button>
    </div>

    <div class="grid grid-cols-2 gap-4 mb-4">
      <!-- 24h Change -->
      <div class="stat-card">
        <h4 class="text-sm text-kong-text-secondary">24h Change</h4>
        <p class:text-kong-accent-green={dailyChange > 0} 
           class:text-kong-accent-red={dailyChange < 0}
           class="text-lg font-bold">
          {dailyChange > 0 ? '+' : ''}{dailyChange.toFixed(2)}%
        </p>
      </div>

      <!-- Best Performer -->
      <div class="stat-card">
        <h4 class="text-sm text-kong-text-secondary">Best Performer</h4>
        <p class="text-lg font-bold text-kong-accent-green">
          {bestPerformer.symbol} (+{bestPerformer.change}%)
        </p>
      </div>
    </div>

    <div class="mt-4">
      <h3 class="text-lg font-medium mb-2">Portfolio Composition</h3>
      <div class="grid grid-cols-2 gap-4">
        <!-- Asset Type Distribution -->
        <div class="composition-card">
          <h4>Asset Types</h4>
          <ul class="text-sm">
            <li>Tokens: {tokenPercentage}%</li>
            <li>LP Positions: {lpPercentage}%</li>
          </ul>
        </div>

        <!-- Risk Level -->
        <div class="composition-card">
          <h4 class="text-sm font-medium mb-2">Risk Analysis</h4>
          <div class="flex items-center gap-2 mb-2">
            <div class="h-2 w-full bg-kong-bg-dark rounded">
              <div 
                class="h-full bg-gradient-to-r from-kong-accent-green to-kong-accent-red" 
                style="width: {riskScore}%"
              />
            </div>
            <span class="text-sm">{riskScore}/100</span>
          </div>
          <div class="text-sm text-kong-text-secondary">
            {#each riskMetrics.recommendations as recommendation}
              <p class="mb-1">• {recommendation}</p>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>
</Modal> 

<style>
  .stat-card {
    @apply bg-kong-bg-light p-3 rounded-lg;
    @apply flex flex-col gap-1;
    @apply transition-all duration-200;
    @apply hover:bg-opacity-80;
  }

  .composition-card {
    @apply bg-kong-bg-light p-3 rounded-lg;
    @apply transition-all duration-200;
  }

    :global(.chart-container) {
    color: rgb(var(--text-primary));
    padding: 1rem;
  }

  :global(.text-kong-text-primary) {
    color: rgb(var(--text-primary)) !important;
    font-weight: 500;
  }

  :global(.chart-container canvas) {
    max-height: 300px !important;
  }
</style> 