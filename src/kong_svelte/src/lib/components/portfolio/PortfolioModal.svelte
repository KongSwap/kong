<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';
  import { onMount } from "svelte";
  import { portfolioValue, tokenStore, getStoredBalances } from "$lib/services/tokens/tokenStore";
  import { liveTokens } from "$lib/services/tokens/tokenStore";
  import { liveUserPools } from "$lib/services/pools/poolStore";
  import { getChartColors, getChartOptions } from './chartConfig';
  import { processPortfolioData, createChartData } from './portfolioDataProcessor';
  import { calculateRiskMetrics } from './riskAnalyzer';
  import { auth } from "$lib/services/auth";
  import { derived } from "svelte/store";

  Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

  // Create a derived store for balances
  const storedBalances = derived(auth, async ($auth) => {
    const walletId = $auth?.account?.owner?.toString() || "anonymous";
    return await getStoredBalances(walletId);
  });

  export let isOpen = false;
  export let onClose = () => {};

  let tokenPercentage = 0;
  let lpPercentage = 0;
  let riskScore = 0;
  let dailyChange = 0;
  let bestPerformer = { symbol: '', change: 0 };
  let highestValue = 0;
  let lowestValue = 0;
  let displayValue = '0.00';
  
  let canvas: HTMLCanvasElement;
  let chart: Chart;
  let currentData: any = null;

  // Update displayValue when portfolioValue changes
  $: {
    Promise.resolve($portfolioValue).then(value => {
      displayValue = value;
    });
  }

  // Add new properties for better organization
  let portfolioStats = {
    totalTokens: 0,
    totalLPPositions: 0,
    dailyChange: 0,
    weeklyChange: 0
  };

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
  $: portfolioData = (async () => {
    const tokens = $liveTokens;
    const balances = await $storedBalances;
    const userPools = $liveUserPools;
    
    const dataKey = safeSerialize({ 
      tokens: tokens.map(t => t.canister_id),
      balances: Object.keys(balances),
      userPools: userPools.map(p => p.id)
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

    Promise.resolve(portfolioData).then(data => {
      if (chart) {
        chart.destroy();
      }

      const isDark = document.documentElement.classList.contains('dark');
      chart = new Chart(canvas, {
        type: 'doughnut',
        data,
        options: getChartOptions(isDark)
      });
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
  $: riskMetrics = (async () => {
    const balances = await $storedBalances;
    const { topPositions, otherPositions } = processPortfolioData(
      $liveTokens,
      balances,
      $liveUserPools
    );
    return calculateRiskMetrics([...topPositions, ...otherPositions]);
  })();

  // Calculate percentages
  $: {
    Promise.all([$portfolioValue, $storedBalances, riskMetrics]).then(([portfolioVal, balances, metrics]) => {
      const totalValue = Number(portfolioVal.replace(/[^0-9.-]+/g, ""));
      const tokenValue = $liveTokens.reduce((acc, token) => {
        const balance = balances[token.canister_id]?.in_usd;
        return acc + (balance ? Number(balance) : 0);
      }, 0);
      const lpValue = totalValue - tokenValue;
      
      tokenPercentage = totalValue ? Math.round((tokenValue / totalValue) * 100) : 0;
      lpPercentage = totalValue ? Math.round((lpValue / totalValue) * 100) : 0;
      riskScore = metrics.diversificationScore;
    });
  }

  // Update the riskScore to diversityScore for clarity
  let diversityScore = 0;

  // Calculate diversity metrics
  $: diversityMetrics = (async () => {
    const balances = await $storedBalances;
    const { topPositions, otherPositions } = processPortfolioData(
      $liveTokens,
      balances,
      $liveUserPools
    );
    return calculateRiskMetrics([...topPositions, ...otherPositions]);
  })();

  // Calculate percentages
  $: {
    Promise.resolve(diversityMetrics).then(metrics => {
      diversityScore = 100 - metrics.diversificationScore;
    });
  }
</script>

<Modal
  {isOpen}
  {onClose}
  width="700px"
  height="auto"
  className="portfolio-modal"
>
  <div slot="title" class="flex items-center justify-between w-full">
    <h2 class="text-xl font-semibold text-kong-text-primary">Portfolio Overview</h2>
    <button
      on:click={handleRefresh}
      class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-kong-text-secondary hover:text-kong-text-primary transition-colors"
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
  
  <div class="portfolio-content p-4 flex flex-col gap-6">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Chart Section -->
      <div class="bg-kong-bg-light rounded-xl p-6 shadow-sm">
        <h3 class="text-sm font-medium text-kong-text-secondary mb-4">Asset Distribution</h3>
        <div 
          class="chart-wrapper flex items-center justify-center" 
          style="position: relative; height:250px; width:100%"
        >
          <canvas bind:this={canvas}></canvas>
        </div>
      </div>

      <!-- Stats Section -->
      <div class="bg-kong-bg-light rounded-xl p-6 shadow-sm flex flex-col justify-between">        
        <div class="space-y-4">
          <!-- Portfolio Value -->
          <div class="text-center mb-4">
            <p class="text-sm font-medium text-kong-text-secondary">Total Portfolio Value</p>
            <p class="text-3xl font-bold text-kong-text-primary">${displayValue}</p>
          </div>

          <!-- Asset Diversity -->
          <div class="stat-group">
            <h4 class="text-xs font-medium text-kong-text-secondary uppercase tracking-wider mb-2">Asset Diversity</h4>
            <div class="flex items-center gap-3">
              <div class="flex-grow h-2 bg-kong-bg-dark rounded-full overflow-hidden">
                <div 
                  class="h-full bg-gradient-to-r from-green-500 to-red-500 transition-all duration-300" 
                  style="width: {diversityScore}%"
                />
              </div>
              <span class="text-sm font-medium">{diversityScore}/100</span>
            </div>
          </div>
          
          <!-- Asset Types -->
          <div class="stat-group">
            <h4 class="text-xs font-medium text-kong-text-secondary uppercase tracking-wider mb-2">Asset Types</h4>
            <div class="grid grid-cols-2 gap-4">
              <div class="stat-item">
                <span class="stat-label">Tokens</span>
                <span class="stat-value">{tokenPercentage}%</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">LP Positions</span>
                <span class="stat-value">{lpPercentage}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</Modal> 

<style>
  .stat-group {
    @apply border-b border-kong-border pb-4 last:border-0 last:pb-0;
  }

  .stat-item {
    @apply flex flex-col p-3 bg-kong-bg-dark rounded-lg;
  }

  .stat-label {
    @apply text-sm text-kong-text-secondary;
  }

  .stat-value {
    @apply text-lg font-semibold text-kong-text-primary;
  }

  .chart-wrapper {
    color: rgb(var(--text-primary));
    position: relative;
    height: auto !important;
    min-height: 200px;
    max-height: 250px;
    width: 100%;
  }

  .chart-wrapper canvas {
    max-height: 250px !important;
  }

  .portfolio-content {
    height: 100%;
    max-height: 100vh;
    overflow-y: auto;
  }

  @media (max-width: 768px) {
    .grid {
      gap: 1rem !important;
    }
    
    .stat-group {
      padding-bottom: 1rem;
    }
  }
</style> 