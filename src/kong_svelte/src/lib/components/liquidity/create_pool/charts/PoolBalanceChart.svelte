<script lang="ts">
  import { onMount } from 'svelte';
  import Panel from "$lib/components/common/Panel.svelte";
  import { BarChart3 } from "lucide-svelte";
  import { 
    initializeChart, 
    cleanupChart, 
    getChartThemeColors, 
    formatNumber,
    createChartGradient,
    getCommonChartOptions,
    calculateSignificantChanges,
    type PoolBalanceHistoryItem 
  } from "./chartUtils";
  import type { Chart as ChartJS } from 'chart.js/auto';
  import { liquidityStore } from "$lib/stores/liquidityStore";

  export let balanceHistory: PoolBalanceHistoryItem[] = [];
  export let isLoading = false;
  export let errorMessage = '';
  export let currentPool: any = null;

  // Chart.js related variables
  let Chart: any;
  let isChartAvailable = false;
  let isDarkMode = false;
  let observer: MutationObserver | null = null;
  let balanceChartCanvas: HTMLCanvasElement;
  let balanceChartInstance: ChartJS | null = null;
  
  // Pre-process data for tooltips to avoid calculations on hover
  let processedTooltipData: Record<number, string> = {};

  onMount(() => {
    // Initialize chart asynchronously
    initChartAsync();
    
    // Return cleanup function
    return () => {
      cleanupChart(balanceChartInstance, observer);
    };
  });
  
  // Separate async initialization
  async function initChartAsync() {
    // Initialize chart components
    const { Chart: ChartJS, isChartAvailable: chartAvailable, isDarkMode: darkMode, observer: themeObserver } = 
      await initializeChart();
    
    Chart = ChartJS;
    isChartAvailable = chartAvailable;
    isDarkMode = darkMode;
    observer = themeObserver;
    
    // Set up theme change observer
    if (observer) {
      observer.disconnect();
      observer = new MutationObserver(() => {
        const newDarkMode = document.documentElement.classList.contains('dark');
        if (newDarkMode !== isDarkMode) {
          isDarkMode = newDarkMode;
          // Update chart if the theme changes
          if (balanceHistory && balanceHistory.length > 0) {
            initOrUpdateBalanceChart();
          }
        }
      });
      
      observer.observe(document.documentElement, { 
        attributes: true,
        attributeFilter: ['class']
      });
    }
    
    // Initial chart creation if data exists
    if (balanceHistory && balanceHistory.length > 0) {
      prepareTooltipData();
      initOrUpdateBalanceChart();
    }
  }
  
  // Pre-process tooltip data to avoid expensive calculations on hover
  function prepareTooltipData() {
    processedTooltipData = {};
    
    balanceHistory.forEach((dayData, index) => {
      if (index === 0) return; // Skip first day for change calculations
      
      const prevDay = balanceHistory[index - 1];
      const token0Change = dayData.token_0_balance - prevDay.token_0_balance;
      const token1Change = dayData.token_1_balance - prevDay.token_1_balance;
      const lpChange = dayData.lp_token_supply - prevDay.lp_token_supply;
      
      let tooltipInfo = `Day Index: ${dayData.day_index}\n`;
      tooltipInfo += `LP Token Supply: ${formatNumber(dayData.lp_token_supply)}`;
      
      if (Math.abs(token0Change) > 0.0001 || Math.abs(token1Change) > 0.0001 || Math.abs(lpChange) > 0.0001) {
        tooltipInfo += '\n\nChanges from previous day:';
        
        if (Math.abs(token0Change) > 0.0001) {
          const percentChange = (token0Change / prevDay.token_0_balance) * 100;
          tooltipInfo += `\nToken 0: ${token0Change > 0 ? '+' : ''}${formatNumber(token0Change)} (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(2)}%)`;
        }
        
        if (Math.abs(token1Change) > 0.0001) {
          const percentChange = (token1Change / prevDay.token_1_balance) * 100;
          tooltipInfo += `\nToken 1: ${token1Change > 0 ? '+' : ''}${formatNumber(token1Change)} (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(2)}%)`;
        }
        
        if (Math.abs(lpChange) > 0.0001) {
          const percentChange = (lpChange / prevDay.lp_token_supply) * 100;
          tooltipInfo += `\nLP Supply: ${lpChange > 0 ? '+' : ''}${formatNumber(lpChange)} (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(2)}%)`;
        }
      }
      
      processedTooltipData[index] = tooltipInfo;
    });
  }
  
  // Update the chart when token selection changes
  $: if ($liquidityStore.token0 || $liquidityStore.token1) {
    if (balanceChartInstance) {
      initOrUpdateBalanceChart(false); // Just update the labels
    }
  }
  
  // Update chart when balance history changes
  $: if (balanceHistory && balanceHistory.length > 0 && isChartAvailable && Chart) {
    prepareTooltipData();
    initOrUpdateBalanceChart();
  }

  function initOrUpdateBalanceChart(shouldReinitialize = true) {
    if (!balanceChartCanvas || !balanceHistory || balanceHistory.length === 0 || !isChartAvailable || !Chart) return;
    
    // If we're just updating labels but not recreating the entire chart
    if (!shouldReinitialize && balanceChartInstance) {
      balanceChartInstance.data.datasets[0].label = $liquidityStore.token0?.symbol || 'Token 0';
      balanceChartInstance.data.datasets[1].label = $liquidityStore.token1?.symbol || 'Token 1';
      balanceChartInstance.update('none'); // Minimal animation
      return;
    }
    
    // If the chart exists and we're updating data but not labels
    if (balanceChartInstance && shouldReinitialize && balanceHistory) {
      // Update data without recreating the chart
      balanceChartInstance.data.labels = balanceHistory.map(entry => entry.date);
      balanceChartInstance.data.datasets[0].data = balanceHistory.map(entry => entry.token_0_balance);
      balanceChartInstance.data.datasets[1].data = balanceHistory.map(entry => entry.token_1_balance);
      
      // Update significant change points more efficiently
      const token0Changes = calculateSignificantChanges(balanceHistory, 'token_0_balance');
      const token1Changes = calculateSignificantChanges(balanceHistory, 'token_1_balance');
      
      // Combine both token changes into a single dataset
      const significantChangePoints = [...token0Changes, ...token1Changes].filter((v, i, a) => 
        a.findIndex(t => t.x === v.x) === i
      );
      
      balanceChartInstance.data.datasets[2].data = significantChangePoints;
      
      balanceChartInstance.update('none'); // Minimal animation
      return;
    }
    
    // Clean up existing chart instance if it exists
    if (balanceChartInstance) {
      balanceChartInstance.destroy();
    }
    
    const ctx = balanceChartCanvas.getContext('2d');
    
    // Format dates for chart labels - dates are in YYYY-MM-DD format
    const labels = balanceHistory.map(entry => entry.date);
    
    // Get the values directly from the API response
    const token0Data = balanceHistory.map(entry => entry.token_0_balance);
    const token1Data = balanceHistory.map(entry => entry.token_1_balance);
    
    // Find days with significant balance changes using the shared utility
    const token0Changes = calculateSignificantChanges(balanceHistory, 'token_0_balance');
    const token1Changes = calculateSignificantChanges(balanceHistory, 'token_1_balance');
    
    // Combine both token changes into a single dataset, removing duplicates
    const significantChangePoints = [...token0Changes, ...token1Changes].filter((v, i, a) => 
      a.findIndex(t => t.x === v.x) === i
    );
    
    // Check if token values are significantly different in scale
    const token0Max = Math.max(...token0Data);
    const token1Max = Math.max(...token1Data);
    
    // Use a larger threshold (10x difference) to determine when to use dual axes
    const needsDualAxis = token0Max > token1Max * 10 || token1Max > token0Max * 10;
    
    // Get theme colors
    const colors = getChartThemeColors(isDarkMode);
    
    // Create theme-aware gradients using the shared utility
    const token0Gradient = createChartGradient(ctx, isDarkMode, colors.token0Color);
    const token1Gradient = createChartGradient(ctx, isDarkMode, colors.token1Color);
    
    // Get common chart options and extend with pool-specific settings
    const chartOptions = getCommonChartOptions(isDarkMode, {
      callbacks: {
        label: function(context) {
          let label = context.dataset.label || '';
          if (label) {
            label += ': ';
          }
          
          // Special handling for significant change markers
          if (label.includes('Significant Changes')) {
            return 'Significant balance change';
          }
          
          if (context.parsed.y !== null) {
            // Format large numbers with commas for better readability
            label += formatNumber(context.parsed.y);
          }
          return label;
        },
        afterBody: function(context) {
          const index = context[0].dataIndex;
          // Use pre-processed tooltip data instead of calculating on hover
          return processedTooltipData[index] || '';
        }
      }
    });
    
    // Extend the common options with dual-axis specific settings if needed
    if (needsDualAxis) {
      chartOptions.scales = {
        ...chartOptions.scales,
        y: {
          ...chartOptions.scales.y,
          position: 'left',
          title: {
            display: false,
            text: $liquidityStore.token0?.symbol || 'Token 0',
            color: colors.token0Color
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          beginAtZero: false,
          grid: {
            display: false,
          },
          ticks: {
            display: false,
            color: colors.tickColor,
            callback: function(value: number) {
              if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
              if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
              return value.toString();
            }
          },
          title: {
            display: false,
            text: $liquidityStore.token1?.symbol || 'Token 1',
            color: colors.token1Color
          }
        }
      };
    }
    
    balanceChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: $liquidityStore.token0?.symbol || 'Token 0',
            data: token0Data,
            borderColor: colors.token0Color,
            backgroundColor: token0Gradient,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 5,
            pointBackgroundColor: colors.token0Color,
            pointBorderColor: colors.pointBorderColor,
            pointBorderWidth: 1.5,
            tension: 0.3,
            fill: true,
            yAxisID: needsDualAxis ? 'y' : 'y'
          },
          {
            label: $liquidityStore.token1?.symbol || 'Token 1',
            data: token1Data,
            borderColor: colors.token1Color,
            backgroundColor: token1Gradient,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 5,
            pointBackgroundColor: colors.token1Color,
            pointBorderColor: colors.pointBorderColor,
            pointBorderWidth: 1.5,
            tension: 0.3,
            fill: true,
            yAxisID: needsDualAxis ? 'y1' : 'y'
          },
          // Highlight significant change points
          {
            label: 'Significant Changes',
            data: significantChangePoints,
            borderColor: colors.changePointColor,
            backgroundColor: colors.changePointColor,
            borderWidth: 0,
            pointRadius: 6,
            pointStyle: 'rectRot',
            pointBorderColor: colors.pointBorderColor,
            pointBorderWidth: 1.5,
            showLine: false
          }
        ]
      },
      options: chartOptions
    });
  }
</script>

<Panel variant="transparent" className="!p-0 !overflow-visible">
  <div class="flex flex-col">
    <h3 class="chart-title flex items-start justify-between py-3 px-5">
      Pool Balance
      <div class="text-kong-text-primary/90 flex items-center gap-2">
        {#if currentPool && $liquidityStore.token0 && $liquidityStore.token1}
          <div class="flex items-center gap-1">
            <span>{typeof currentPool.balance_0 === 'number' ? 
              formatNumber(currentPool.balance_0) : '0.00'}</span>
            <span class="text-kong-primary/80 text-sm mt-1">{$liquidityStore.token0.symbol}</span>
          </div>
          <div class="flex items-center gap-1">
            <span>{typeof currentPool.balance_1 === 'number' ? 
              formatNumber(currentPool.balance_1) : '0.00'}</span>
            <span class="text-kong-text-accent-green/80 text-sm mt-1">{$liquidityStore.token1.symbol}</span>
          </div>
        {:else}
          <div class="flex items-center gap-1">
            <span>0.00</span>
            <span class="text-kong-text-accent-green/80 text-sm mt-1">{$liquidityStore.token0?.symbol || '-'}</span>
          </div>
          <div class="flex items-center gap-1">
            <span>0.00</span>
            <span class="text-kong-primary/80 text-sm mt-1">{$liquidityStore.token1?.symbol || '-'}</span>
          </div>
        {/if}
      </div>
    </h3>
    <div class="chart-container w-full" style="height: 220px;">
      {#if balanceHistory && balanceHistory.length > 0 && isChartAvailable}
        <canvas bind:this={balanceChartCanvas}></canvas>
      {:else}
        <div class="coming-soon">
          <BarChart3 class="mb-3 w-8 h-8" />
          {#if isLoading}
            Loading chart data...
          {:else if errorMessage}
            {errorMessage}
          {:else if !isChartAvailable}
            Charts unavailable - Could not load Chart.js
          {:else if currentPool}
            No chart data available
          {:else}
            Charts Coming Soon
          {/if}
        </div>
      {/if}
    </div>
  </div>
</Panel>

<style lang="postcss">
  .chart-title {
    @apply text-sm uppercase font-medium text-kong-text-primary/90;
  }

  .chart-container {
    @apply relative m-0 overflow-visible transition-all duration-300;
  }
  
  .chart-container canvas {
    @apply rounded-lg transition-all duration-300;
  }

  .coming-soon {
    @apply w-full h-full flex flex-col items-center justify-center text-kong-text-primary/60 text-lg font-medium;
  }
</style> 