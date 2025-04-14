<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { RefreshCw, BarChart3 } from "lucide-svelte";
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

  // Props
  const props = $props<{
    balanceHistory: PoolBalanceHistoryItem[];
    isLoading: boolean;
    errorMessage: string;
    currentPool: any;
    fetchBalanceHistoryData: () => Promise<void>;
  }>();

  // State variables using runes
  let Chart = $state<any>(null);
  let isChartAvailable = $state(false);
  let isDarkMode = $state(false);
  let observer = $state<MutationObserver | null>(null);
  let tvlChartCanvas = $state<HTMLCanvasElement | null>(null);
  let tvlChartInstance = $state<ChartJS | null>(null);
    let processedTooltipData = $state<Record<number, string>>({});
    let shouldUpdateChart = $state(false);

  // Effect to initialize chart when component mounts
  $effect(() => {
    // Initialize chart asynchronously
    initChartAsync();
    
    // Cleanup on component destruction
    return () => {
      cleanupChart(tvlChartInstance, observer);
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
          if (props.balanceHistory && props.balanceHistory.length > 0) {
            shouldUpdateChart = true;
          }
        }
      });
      
      observer.observe(document.documentElement, { 
        attributes: true,
        attributeFilter: ['class']
      });
    }
    
    // Initial chart creation if data exists
    if (props.balanceHistory && props.balanceHistory.length > 0) {
      // Pre-process tooltip data
      prepareTooltipData();
      initOrUpdateTVLChart();
    }
  }
  
  // Pre-process tooltip data to avoid expensive calculations on hover
  function prepareTooltipData() {
    processedTooltipData = {};
    
    props.balanceHistory.forEach((dayData, index) => {
      let tooltipInfo = `Day Index: ${dayData.day_index}\n`;
      tooltipInfo += `Date: ${dayData.date}\n`;
      tooltipInfo += `Token 0 Balance: ${formatNumber(dayData.token_0_balance)}\n`;
      tooltipInfo += `Token 1 Balance: ${formatNumber(dayData.token_1_balance)}\n`;
      tooltipInfo += `Token 0 Price: $${formatNumber(dayData.token_0_price_usd, 6)}\n`;
      tooltipInfo += `Token 1 Price: $${formatNumber(dayData.token_1_price_usd, 6)}`;
      
      // Calculate changes from previous day if not the first day
      if (index > 0) {
        const prevDay = props.balanceHistory[index - 1];
        const tvlChange = dayData.tvl_usd - prevDay.tvl_usd;
        
        if (Math.abs(tvlChange) > 0.01) {
          const percentChange = (tvlChange / prevDay.tvl_usd) * 100;
          tooltipInfo += `\n\nTVL Change: ${tvlChange > 0 ? '+' : ''}$${formatNumber(Math.abs(tvlChange))} (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(2)}%)`;
        }
      }
      
      processedTooltipData[index] = tooltipInfo;
    });
  }

  function initOrUpdateTVLChart(shouldReinitialize = true) {
    if (!tvlChartCanvas || !props.balanceHistory || props.balanceHistory.length === 0 || !isChartAvailable || !Chart) return;
    
    // If we're just updating without recreating the entire chart
    if (!shouldReinitialize && tvlChartInstance) {
      tvlChartInstance.update('none'); // Minimal animation
      return;
    }
    
    // Clean up existing chart instance if it exists
    if (tvlChartInstance) {
      tvlChartInstance.destroy();
    }
    
    const ctx = tvlChartCanvas.getContext('2d');
    
    // Now using the date field directly
    const labels = props.balanceHistory.map(entry => entry.date);
    
    // Use the TVL in USD value as the primary data point
    const tvlData = props.balanceHistory.map(entry => entry.tvl_usd);
    
    // Find days with significant TVL changes using the shared utility
    const significantChangePoints = calculateSignificantChanges(
      props.balanceHistory, 
      'tvl_usd', 
      'date', 
      0.05 // 5% threshold for significant changes
    );
    
    // Get theme colors
    const colors = getChartThemeColors(isDarkMode);
    
    // Create theme-aware TVL gradient using the shared utility
    const tvlGradient = createChartGradient(ctx, isDarkMode, 'rgba(111, 93, 251, 1)', 300);
    
    // Get common chart options and extend with TVL-specific settings
    const chartOptions = getCommonChartOptions(isDarkMode, {
      callbacks: {
        label: function(context) {
          if (context.parsed.y !== null) {
            return `TVL: $${formatNumber(context.parsed.y)}`;
          }
          return '';
        },
        afterBody: function(context) {
          const index = context[0].dataIndex;
          // Use pre-processed tooltip data
          return processedTooltipData[index] || '';
        }
      },
      maintainAspectRatio: false, // Allow filling the entire container
      responsive: true, // Ensure responsiveness
      devicePixelRatio: 2, // Sharper rendering
    });
    
    // Ensure axes don't add internal padding
    if (!chartOptions.scales) {
      chartOptions.scales = {};
    }
    
    chartOptions.scales.x = {
      ...chartOptions.scales.x,
      grid: {
        display: false,
      },
      ticks: {
        display: false, // Hide x-axis ticks
        padding: 0, // Remove tick padding
      }
    };
    
    chartOptions.scales.y = {
      ...chartOptions.scales.y,
      display: true,
      grid: {
        display: true,
      },
      ticks: {
        display: false, // Hide y-axis ticks
        padding: 0, // Remove tick padding
      }
    };
    
    // Ensure no layout padding
    if (!chartOptions.layout) {
      chartOptions.layout = {};
    }
    chartOptions.layout.padding = 0; // No padding at all
    
    tvlChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'TVL (USD)',
            data: tvlData,
            borderColor: colors.tvlColor,
            backgroundColor: tvlGradient,
            borderWidth: 2,
            fill: true, // Ensure fill is enabled
            pointRadius: (ctx) => {
              // Show a point for each day, with larger points for first, last, and significant changes
              const index = ctx.dataIndex;
              if (index === 0 || index === tvlData.length - 1) return 4; // First and last points
              
              // Check if this is a significant change point
              const isSignificant = significantChangePoints.some(point => 
                point.x === props.balanceHistory[index]?.date
              );
              
              return isSignificant ? 4 : 2; // Show all points, with emphasis on significant ones
            },
            pointBackgroundColor: colors.tvlColor,
            pointBorderColor: colors.pointBorderColor,
            pointBorderWidth: 1.5,
            tension: 0.3,
          }
        ]
      },
      options: chartOptions
    });
    
    // Reset the update flag
    shouldUpdateChart = false;
  }
  
  // Watch for balance history changes
  $effect(() => {
    const balanceHistoryLength = props.balanceHistory?.length || 0;
    if (balanceHistoryLength > 0) {
      shouldUpdateChart = true;
    }
  });
  
  // Separate effect to handle chart updates
  $effect(() => {
    if (shouldUpdateChart && isChartAvailable && Chart) {
      prepareTooltipData();
      initOrUpdateTVLChart();
    }
  });
</script>

<Panel variant="transparent" unpadded={true} className="!overflow-visible">
  <div class="flex flex-col w-full h-full">
    <h3 class="flex items-center justify-between py-3 px-5 text-sm uppercase font-medium text-kong-text-primary/90">
      TVL History
      <div class="flex items-center gap-2">
        <div class="text-kong-text-primary/90">
          {#if typeof props.currentPool?.tvl === 'number'}
            {(props.currentPool.tvl as number).toLocaleString(undefined, {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          {:else}
            $0.00
          {/if}
        </div>
        <button 
          class="text-kong-text-primary/60 hover:text-kong-text-primary transition-colors duration-200"
          on:click={() => props.fetchBalanceHistoryData()} 
          disabled={props.isLoading}
          title="Refresh data">
          <span class:animate-spin={props.isLoading}>
            <RefreshCw class="w-4 h-4" />
          </span>
        </button>
      </div>
    </h3>
    <div class="chart-container w-full h-full">
      {#if props.balanceHistory && props.balanceHistory.length > 0 && isChartAvailable}
        <canvas bind:this={tvlChartCanvas} class="w-full h-full !p-0 !m-0 rounded-b-lg"></canvas>
      {:else}
        <div class="w-full h-full flex flex-col items-center justify-center text-kong-text-primary/60 text-lg font-medium">
          <BarChart3 class="mb-3 w-8 h-8" />
          {#if props.isLoading}
            Loading chart data...
          {:else if props.errorMessage}
            {props.errorMessage}
          {:else if !isChartAvailable}
            Charts unavailable - Could not load Chart.js
          {:else if props.currentPool}
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
  .chart-container {
    @apply relative !p-0 !m-0 overflow-visible transition-all duration-300;
  }
</style> 