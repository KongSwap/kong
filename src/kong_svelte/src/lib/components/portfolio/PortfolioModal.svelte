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

    // Make sure userPools are included in the position calculations
    const { topPositions, otherPositions } = processPortfolioData(
      tokens, 
      balances, 
      userPools
    );

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
      // Calculate token value
      const tokenValue = Object.values(balances).reduce((acc, balance) => {
        const usdValue = balance?.in_usd ? Number(balance.in_usd) : 0;
        return acc + usdValue;
      }, 0);
      
      // Calculate LP value from userPools
      const lpValue = $liveUserPools.reduce((acc, pool) => {
        const poolValue = Number(pool.usd_balance) || 0;
        return acc + poolValue;
      }, 0);
      
      // Calculate total value as sum of token and LP values
      const calculatedTotal = tokenValue + lpValue;
      
      // Calculate percentages using the calculated total to ensure they add up to 100%
      tokenPercentage = calculatedTotal > 0 ? Math.round((tokenValue / calculatedTotal) * 100) : 0;
      lpPercentage = calculatedTotal > 0 ? Math.round((lpValue / calculatedTotal) * 100) : 0;
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
    const allPositions = [...topPositions, ...otherPositions].filter(pos => pos.value > 0);    
    const metrics = calculateRiskMetrics(allPositions);
    return metrics;
  })();

  // Calculate percentages
  $: {
    Promise.resolve(diversityMetrics).then(metrics => {
      diversityScore = metrics?.diversificationScore || 0;
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
  
  <div class="portfolio-content p-4 flex flex-col gap-8">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <!-- Chart Section -->
      <div class="bg-kong-bg-light rounded-xl p-4 shadow-lg border border-kong-border/10 hover:border-kong-border/20 transition-all">
        <h3 class="text-sm font-medium text-kong-text-secondary mb-4">Asset Distribution</h3>
        <div 
          class="chart-wrapper flex items-center justify-center" 
          style="position: relative; height:300px; width:100%"
        >
          <canvas bind:this={canvas}></canvas>
        </div>
      </div>

      <!-- Stats Section -->
      <div class="bg-kong-bg-light rounded-xl p-4 shadow-lg border border-kong-border/10 hover:border-kong-border/20 transition-all">        
        <div class="space-y-6 flex flex-col justify-between h-full">
          <!-- Portfolio Value -->
          <div class="mb-6">
            <h4 class="text-sm font-medium text-kong-text-secondary mb-2">Total Portfolio Value</h4>
            <p class="text-4xl font-bold text-kong-text-primary">${displayValue}</p>
          </div>

          <!-- Asset Types -->
          <div class="stat-group">
            <h4 class="text-sm font-medium text-kong-text-secondary mb-4">Asset Types</h4>
            <div class="grid grid-cols-2 gap-6">
              <div class="stat-item">
                <span class="stat-value text-center">{tokenPercentage}%</span>
                <span class="stat-label text-center">Tokens</span>
              </div>
              <div class="stat-item">
                <span class="stat-value text-center">{lpPercentage}%</span>
                <span class="stat-label text-center">LP Positions</span>
              </div>
            </div>
          </div>

          <!-- Asset Diversity -->
          <div class="stat-group">
            <h4 class="text-sm font-medium text-kong-text-secondary mb-4">Asset Diversity</h4>
            <div class="flex items-center gap-4">
              <div class="flex-grow h-3 bg-kong-bg-dark rounded-full overflow-hidden">
                <div 
                  class="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-300" 
                  style="width: {diversityScore}%"
                />
              </div>
              <span class="text-base font-semibold min-w-[60px] text-right">{diversityScore || 0}/100</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</Modal> 

<style>
  .stat-group {
    @apply pb-6 last:pb-0;
  }

  .stat-item {
    @apply flex flex-col p-4 bg-kong-bg-dark rounded-xl border border-kong-border/10 hover:border-kong-border/20 transition-all;
  }

  .stat-label {
    @apply text-sm font-medium text-kong-text-secondary mt-1;
  }

  .stat-value {
    @apply text-2xl font-bold text-kong-text-primary;
  }

  .chart-wrapper {
    color: rgb(var(--text-primary));
    position: relative;
    height: auto !important;
    min-height: 300px;
    max-height: 300px;
    width: 100%;
  }

  .chart-wrapper canvas {
    max-height: 300px !important;
  }

  .portfolio-content {
    height: 100%;
    max-height: 100vh;
    overflow-y: auto;
  }

  @media (max-width: 768px) {
    .grid {
      gap: 1.5rem !important;
    }
    
    .stat-group {
      padding-bottom: 1.5rem;
    }
  }
</style> 