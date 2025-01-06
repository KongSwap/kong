<script lang="ts">
  import { 
    Chart,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    DoughnutController
  } from 'chart.js';
  
  // Only register what we need for the doughnut chart
  Chart.register(
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    DoughnutController
  );

  import { onMount, onDestroy } from "svelte";
  import { portfolioValue, storedBalancesStore, tokenStore } from "$lib/services/tokens/tokenStore";
  import { liveTokens } from "$lib/services/tokens/tokenStore";
  import { liveUserPools } from "$lib/services/pools/poolStore";
  import { getChartColors, getChartOptions } from '$lib/components/portfolio/chartConfig';
  import { processPortfolioData, createChartData } from '$lib/components/portfolio/portfolioDataProcessor';
  import { calculateRiskMetrics } from '$lib/components/portfolio/riskAnalyzer';
  import PageHeader from "$lib/components/common/PageHeader.svelte";
  import { getPortfolioHistory } from "$lib/services/portfolio/portfolioHistory";
  import { calculatePerformanceMetrics } from "$lib/services/portfolio/performanceMetrics";
  import type { PortfolioHistory } from "$lib/services/portfolio/portfolioHistory";
  import type { PortfolioStats, TokenPosition, TimeRange } from '$lib/services/portfolio/types';
  import { TIME_RANGES } from '$lib/services/portfolio/types';
  import { auth } from "$lib/services/auth";
  import Panel from "$lib/components/common/Panel.svelte";

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
  let historyChart: Chart;
  let historyCanvas: HTMLCanvasElement;
  let portfolioHistory: PortfolioHistory[] = [];
  let performanceMetrics = {
    dailyChange: 0,
    weeklyChange: 0,
    monthlyChange: 0,
    bestPerformer: { symbol: '', change: 0 },
    worstPerformer: { symbol: '', change: 0 }
  };

  // State management
  let isLoading = true;
  let loadingError: string | null = null;
  let selectedPeriod: TimeRange['label'] = '1M';
  let portfolioStats: PortfolioStats = {
    totalAssets: 0,
    activePools: 0,
    bestMonth: 0,
    worstMonth: 0
  };
  let topPositions: TokenPosition[] = [];

  function handleRefresh() {
    if (chart) {
      chart.destroy();
      chart = null;
    }
    updateChart();
  }

  function safeSerialize(obj: any): string {
    return JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
  }

  $: portfolioData = (() => {
    const tokens = $liveTokens;
    const balances = $storedBalancesStore;
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

    console.log('Portfolio data:', { topPositions, otherPositions, chartData });

    currentData = { key: dataKey, data: chartData };
    return chartData;
  })();

  function updateChart() {
    if (!canvas || !portfolioData?.datasets?.[0]?.data?.length) {
      console.log('Missing required data for chart:', { canvas, portfolioData });
      return;
    }

    if (chart) {
      chart.destroy();
    }

    const isDark = document.documentElement.classList.contains('dark');
    
    console.log('Creating doughnut chart with data:', portfolioData);
    
    chart = new Chart(canvas, {
      type: 'doughnut',
      data: portfolioData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: isDark ? '#CBD5E1' : '#1E293B',
              font: {
                family: "'Exo 2', sans-serif",
                size: 12
              }
            }
          }
        }
      }
    });
  }

  $: if (canvas && portfolioData?.datasets?.[0]?.data?.length) {
    console.log('Triggering chart update');
    setTimeout(updateChart, 0);
  }

  $: riskMetrics = (() => {
    const { topPositions, otherPositions } = processPortfolioData(
      $liveTokens,
      $storedBalancesStore,
      $liveUserPools
    );
    return calculateRiskMetrics([...topPositions, ...otherPositions]);
  })();

  $: {
    const totalValue = Number($portfolioValue.replace(/[^0-9.-]+/g, ""));
    const tokenValue = $liveTokens.reduce((acc, token) => {
      const balance = $storedBalancesStore[token.canister_id]?.in_usd;
      return acc + (balance ? Number(balance) : 0);
    }, 0);
    const lpValue = totalValue - tokenValue;
    
    tokenPercentage = totalValue ? Math.round((tokenValue / totalValue) * 100) : 0;
    lpPercentage = totalValue ? Math.round((lpValue / totalValue) * 100) : 0;
    riskScore = riskMetrics.diversificationScore;
  }

  $: {
    if (portfolioHistory.length > 0 && $liveTokens.length > 0) {
      performanceMetrics = calculatePerformanceMetrics(portfolioHistory, $liveTokens);
      dailyChange = performanceMetrics.dailyChange;
      bestPerformer = performanceMetrics.bestPerformer;
      
      const values = portfolioHistory.map(h => h.totalValue);
      highestValue = Math.max(...values);
      lowestValue = Math.min(...values);
    }
  }

  // Calculate portfolio stats
  function calculatePortfolioStats(): PortfolioStats {
    const tokens = Object.keys($storedBalancesStore).filter(id => $storedBalancesStore[id]?.in_usd !== "0").length;
    const pools = $liveUserPools.length;
    
    const monthValues = portfolioHistory
      .filter(h => h.timestamp >= Date.now() - 30 * 24 * 60 * 60 * 1000)
      .map(h => h.totalValue);
    
    return {
      totalAssets: tokens,
      activePools: pools,
      bestMonth: monthValues.length ? Math.max(...monthValues) : 0,
      worstMonth: monthValues.length ? Math.min(...monthValues) : 0
    };
  }

  // Add principal getter
  const getPrincipal = () => {
    const wallet = $auth;
    return wallet?.account?.owner?.toString() || "anonymous";
  };

  // Update handlePeriodChange
  async function handlePeriodChange(period: TimeRange['label']) {
    try {
      isLoading = true;
      selectedPeriod = period;
      
      const principal = getPrincipal();
      if (principal === "anonymous") {
        throw new Error("No wallet connected");
      }

      // Calculate days for YTD
      const days = period === 'YTD' 
        ? Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24))
        : TIME_RANGES.find(r => r.label === period)?.days || 30;
      
      // Destroy existing charts
      if (historyChart) {
        historyChart.destroy();
        historyChart = null;
      }
      if (chart) {
        chart.destroy();
        chart = null;
      }
      
      // Fetch new data
      portfolioHistory = await getPortfolioHistory(principal, days);
      
      // Update charts and stats
      requestAnimationFrame(() => {
        updateChart();
        portfolioStats = calculatePortfolioStats();
      });
    } catch (error) {
      console.error("Failed to update period:", error);
      loadingError = error instanceof Error ? error.message : "Failed to update time period";
    } finally {
      isLoading = false;
    }
  }

  // Update onMount
  onMount(async () => {
    try {
      isLoading = true;
      const principal = getPrincipal();
      if (principal === "anonymous") {
        throw new Error("No wallet connected");
      }
      
      portfolioHistory = await getPortfolioHistory(principal);
      
      // Initialize charts
      updateChart();
      
      // Calculate initial stats
      portfolioStats = calculatePortfolioStats();
    } catch (error) {
      console.error("Failed to load portfolio data:", error);
      loadingError = error instanceof Error ? error.message : "Failed to load portfolio data";
    } finally {
      isLoading = false;
    }
  });


  // Clean up on component destruction
  onDestroy(() => {
    if (chart) chart.destroy();
    if (historyChart) historyChart.destroy();
  });

  $: if($auth.isConnected){
    handlePeriodChange(selectedPeriod);
  }
</script>

<PageHeader title="Portfolio Analysis" />

<div class="container mx-auto px-4 max-w-6xl text-kong-text-primary">
  {#if isLoading}
    <Panel variant="transparent" className="flex items-center justify-center min-h-[200px]">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-kong-primary"></div>
    </Panel>
  {:else if loadingError}
    <Panel variant="transparent">
      <div class="text-kong-accent-red mb-4">{loadingError}</div>
      {#if loadingError === "No wallet connected"}
        <button 
          class="px-4 py-2 bg-kong-primary text-white rounded-lg hover:bg-kong-primary-hover transition-colors"
          on:click={() => {/* Add wallet connection handler */}}
        >
          Connect Wallet
        </button>
      {:else}
        <button 
          class="text-sm text-kong-primary hover:text-opacity-80 transition-colors" 
          on:click={() => handlePeriodChange(selectedPeriod)}
        >
          Try Again
        </button>
      {/if}
    </Panel>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-8">
      <!-- Time period selector -->
      <div class="flex gap-2 mb-4 col-span-full justify-self-end">
        {#each TIME_RANGES as { label }}
          <button 
            class="px-3 py-1 rounded-lg text-sm transition-colors"
            class:bg-kong-primary={selectedPeriod === label}
            class:text-white={selectedPeriod === label}
            class:bg-kong-bg-dark={selectedPeriod !== label}
            on:click={() => handlePeriodChange(label)}
          >
            {label}
          </button>
        {/each}
      </div>

      <!-- Left Column -->
      <div class="space-y-6">
        <!-- Total Value Card with Stats -->
        <Panel variant="transparent" className="p-6">
          <div class="mb-6">
            <h2 class="text-2xl font-bold text-kong-text-primary mb-2">Total Portfolio Value</h2>
            <p class="text-4xl font-bold text-kong-text-primary">${$portfolioValue}</p>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <h4 class="text-sm text-kong-text-secondary">Total Assets</h4>
              <p class="text-lg font-bold">{portfolioStats.totalAssets}</p>
            </div>
            <div>
              <h4 class="text-sm text-kong-text-secondary">Active Pools</h4>
              <p class="text-lg font-bold">{portfolioStats.activePools}</p>
            </div>
          </div>
        </Panel>

        <!-- Performance Metrics -->
        <div class="grid grid-cols-2 gap-4">
          <Panel variant="transparent" className="stat-card">
            <h4 class="text-sm text-kong-text-secondary">24h Change</h4>
            <p class:text-kong-accent-green={performanceMetrics.dailyChange > 0} 
               class:text-kong-accent-red={performanceMetrics.dailyChange < 0}
               class="text-lg font-bold">
              {performanceMetrics.dailyChange > 0 ? '+' : ''}{performanceMetrics.dailyChange.toFixed(2)}%
            </p>
          </Panel>

          <Panel variant="transparent" className="stat-card">
            <h4 class="text-sm text-kong-text-secondary">Best Performer</h4>
            <p class="text-lg font-bold text-kong-accent-green">
              {performanceMetrics.bestPerformer.symbol} 
              ({performanceMetrics.bestPerformer.change > 0 ? '+' : ''}
              {performanceMetrics.bestPerformer.change.toFixed(2)}%)
            </p>
          </Panel>
        </div>

        <!-- Portfolio Composition -->
        <Panel variant="transparent" className="p-6">
          <h3 class="text-xl font-bold mb-4">Portfolio Composition</h3>
          <div class="grid grid-cols-2 gap-4 w-full">
            <Panel variant="transparent" className="composition-card !w-full">
              <h4 class="font-medium mb-2">Asset Types</h4>
              <ul class="space-y-2">
                <li class="flex justify-between">
                  <span>Tokens</span>
                  <span class="font-medium">{tokenPercentage}%</span>
                </li>
                <li class="flex justify-between">
                  <span>LP Positions</span>
                  <span class="font-medium">{lpPercentage}%</span>
                </li>
              </ul>
            </Panel>
          </div>
        </Panel>
      </div>

      <!-- Right Column -->
      <div class="space-y-6">
        <!-- Distribution Chart -->
        <Panel variant="transparent" className="p-6">
          <h3 class="text-xl font-bold mb-4">Asset Distribution</h3>
          <div class="w-full aspect-square">
            <canvas bind:this={canvas}></canvas>
          </div>
          <div class="flex justify-center mt-4">
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
        </Panel>

        <!-- Risk Analysis -->
        <Panel variant="transparent" className="p-6">
          <h3 class="text-xl font-bold mb-4">Risk Analysis</h3>
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <div class="h-2 flex-grow bg-kong-bg-dark rounded">
                <div 
                  class="h-full bg-gradient-to-r from-kong-accent-green to-kong-accent-red" 
                  style="width: {riskScore}%"
                />
              </div>
              <span class="text-sm font-medium">{riskScore}/100</span>
            </div>
            <div class="text-sm text-kong-text-secondary space-y-2">
              {#each riskMetrics.recommendations as recommendation}
                <p>• {recommendation}</p>
              {/each}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  {/if}
</div>

<style>
  .stat-card {
    @apply p-4;
    @apply flex flex-col gap-1;
    @apply transition-all duration-200;
  }

  .composition-card {
    @apply p-4;
  }

  :global(.chart-container) {
    color: rgb(var(--text-primary));
    position: relative;
    width: 100%;
    height: 100%;
  }

  :global(.chart-container canvas) {
    width: 100% !important;
    height: 100% !important;
    max-height: none !important;
  }

  canvas {
    width: 100% !important;
    height: 100% !important;
  }
</style>
