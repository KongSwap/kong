<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';
  import { onMount, onDestroy } from "svelte";
  import { portfolioValue, storedBalancesStore } from "$lib/services/tokens/tokenStore";
  import { userPoolListStore } from "$lib/stores/userPoolListStore";
  import { getChartColors, getChartOptions } from './chartConfig';
  import { processPortfolioData, createChartData } from './portfolioDataProcessor';
  import { derived, type Readable } from "svelte/store";
  import { userTokens } from "$lib/stores/userTokens";
  Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

  // Create an AbortController for cleanup
  let abortController = new AbortController();
  let updateTimer: ReturnType<typeof setTimeout>;
  let unsubscribers: (() => void)[] = [];

  export let isOpen = false;
  export let onClose = () => {};

  let tokenPercentage = 0;
  let lpPercentage = 0;
  let displayValue = '0.00';
  let canvas: HTMLCanvasElement;
  let chart: Chart;
  let currentData: any = null;

  // Memoize chart instance creation
  function createChart(data: any) {
    if (chart) {
      chart.destroy();
    }
    
    const isDark = document.documentElement.classList.contains('dark');
    return new Chart(canvas, {
      type: 'doughnut',
      data,
      options: getChartOptions(isDark) as any
    });
  }

  // Watch for modal open/close
  $: if (!isOpen && chart) {
    chart.destroy();
    chart = null;
    currentData = null;
  }

  // Watch for modal open and canvas ready
  $: if (isOpen && canvas) {
    currentData = null; // Force data refresh
    updateChart(true);
  }

  // Optimized refresh handler
  function handleRefresh() {
    currentData = null; // Force data refresh
    updateChart(true);
  }

  // Helper function to safely serialize data with memoization
  const memoizedSerialize = (() => {
    let lastInput: any = null;
    let lastOutput: string = '';
    
    return (obj: any): string => {
      const isEqual = JSON.stringify(obj) === JSON.stringify(lastInput);
      if (isEqual) return lastOutput;
      
      lastInput = obj;
      lastOutput = JSON.stringify(obj, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value
      );
      return lastOutput;
    };
  })();

  // Optimized portfolio data calculation
  $: portfolioData = (async () => {
    if (abortController.signal.aborted) return null;

    const tokens = $userTokens.tokens;
    const balances = $storedBalancesStore;
    const userPools = $userPoolListStore.processedPools;
    
    const dataKey = memoizedSerialize({ 
      tokens: tokens.map(t => t.canister_id),
      balances: Object.keys(balances),
      userPools: userPools.map(p => p.id)
    });
    
    if (currentData?.key === dataKey) {
      return currentData.data;
    }

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

  // Optimized metrics calculation with cleanup
  async function calculateMetrics() {
    if (abortController.signal.aborted) return;

    try {
      const [portfolioVal, balances] = await Promise.all([
        $portfolioValue,
        $storedBalancesStore
      ]);

      if (abortController.signal.aborted) return;

      // Calculate token value with proper typing
      const tokenValue = Object.values(balances).reduce((acc: number, balance: FE.TokenBalance) => {
        const usdValue = balance?.in_usd ? Number(balance.in_usd) : 0;
        return acc + usdValue;
      }, 0);
      
      // Calculate LP value with proper typing
      const lpValue = $userPoolListStore.processedPools.reduce((acc: number, pool: any) => {
        const poolValue = Number(pool.usd_balance || 0);
        return acc + poolValue;
      }, 0);
      
      const calculatedTotal = Number(tokenValue) + Number(lpValue);
      
      // Update percentages only if we have a total
      if (calculatedTotal > 0) {
        tokenPercentage = Math.round((Number(tokenValue) / calculatedTotal) * 100);
        lpPercentage = Math.round((Number(lpValue) / calculatedTotal) * 100);
      } else {
        tokenPercentage = 0;
        lpPercentage = 0;
      }

      // Calculate diversity score based on portfolio composition
      const positions = [
        ...Object.entries(balances).map(([id, balance]) => ['token', balance]),
        ...$userPoolListStore.processedPools.map(p => ['lp', {
          in_tokens: BigInt(0),
          in_usd: p.usd_balance?.toString() || "0"
        }])
      ] as [string, FE.TokenBalance][];
      
      const totalValue = positions.reduce((acc, [_, balance]) => acc + Number(balance.in_usd || 0), 0);
      
      if (totalValue > 0) {
        const weights = positions.map(([_, balance]) => Number(balance.in_usd || 0) / totalValue);
        const concentration = weights.reduce((acc, w) => acc + w * w, 0);
        diversityScore = Math.round((1 - concentration) * 100);
      } else {
        diversityScore = 0;
      }

    } catch (error) {
      if (!abortController.signal.aborted) {
        console.error('Failed to calculate metrics:', error);
      }
    }
  }

  let lastUpdateTime = 0;
  const UPDATE_THROTTLE = 2000; // Only update every 2 seconds at most

  // Optimized chart update with cleanup and throttling
  function updateChart(forceUpdate = false) {
    if (!canvas || !isOpen || abortController.signal.aborted) return;

    const now = Date.now();
    if (!forceUpdate && now - lastUpdateTime < UPDATE_THROTTLE) {
      clearTimeout(updateTimer);
      updateTimer = setTimeout(() => updateChart(), UPDATE_THROTTLE - (now - lastUpdateTime));
      return;
    }

    clearTimeout(updateTimer);
    updateTimer = setTimeout(async () => {
      try {
        const data = await portfolioData;
        if (!abortController.signal.aborted && data && (!chart || !isEqual(chart.data, data))) {
          chart = createChart(data);
          lastUpdateTime = Date.now();
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error('Failed to update chart:', error);
        }
      }
    }, 0);
  }

  // Deep equality check for chart data
  function isEqual(data1: any, data2: any): boolean {
    if (!data1 || !data2) return false;
    return JSON.stringify(data1) === JSON.stringify(data2);
  }

  // Setup cleanup
  onMount(() => {
    userPoolListStore.initialize();
    let lastPortfolioValue = '';
    let lastBalancesKey = '';

    // Subscribe to all relevant stores for updates
    unsubscribers.push(
      portfolioValue.subscribe(async (value) => {
        if (!abortController.signal.aborted && value !== lastPortfolioValue) {
          lastPortfolioValue = value;
          displayValue = value;
          await calculateMetrics();
          updateChart();
        }
      }),

      // Subscribe to balances and tokens for metrics
      derived(
        [storedBalancesStore, userTokens, userPoolListStore], 
        ([$balances, $tokens, $pools]) => {
          const key = memoizedSerialize({
            balances: Object.keys($balances),
            tokens: $tokens.tokens.map(t => t.canister_id),
            pools: $pools.processedPools.map(p => p.id)
          });
          return { 
            key, 
            balances: $balances, 
            tokens: $tokens, 
            pools: $pools.processedPools
          };
        }
      ).subscribe(async ({ key, balances, tokens, pools }) => {
        if (!abortController.signal.aborted && key !== lastBalancesKey) {
          lastBalancesKey = key;
          await calculateMetrics();
          updateChart();
        }
      })
    );

    // Initial calculation and chart
    calculateMetrics();
    updateChart(true);
  });

  onDestroy(() => {
    // Cleanup all resources
    abortController.abort();
    clearTimeout(updateTimer);
    if (chart) {
      chart.destroy();
      chart = null;
    }
    unsubscribers.forEach(unsub => unsub());
    currentData = null;
  });

  let diversityScore = 0;
</script>

<Modal
  {isOpen}
  {onClose}
  width="700px"
  height="auto"
  className="portfolio-modal pb-6"
>
  <div slot="title" class="flex items-center justify-between w-full">
    <h2 class="text-lg font-semibold text-kong-text-primary">Portfolio Overview</h2>
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
  
  <div class="portfolio-content px-2 flex flex-col gap-8 mt-1">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <!-- Chart Section -->
      <div class="bg-kong-bg-light rounded-xl p-4 shadow-lg border border-kong-border/10 hover:border-kong-border/20 transition-all">
        <h3 class="text-sm font-medium text-kong-text-secondary mb-4">Asset Distribution</h3>
        <div 
          class="chart-wrapper flex items-center justify-center" 
          style="position: relative; height:100%; width:100%"
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