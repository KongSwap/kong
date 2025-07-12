<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { RefreshCw, BarChart3 } from "lucide-svelte";
  import { 
    initializeChart, 
    cleanupChart, 
    formatNumber,
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
  let processedTooltipData = $state<Record<number, {
    balances: string[];
    prices: string[];
    changes: string[];
  }>>({});
  let shouldUpdateChart = $state(false);

  // Get theme colors from CSS custom properties
  function getThemeColors() {
    const style = getComputedStyle(document.documentElement);
    
    // Primary brand color for TVL bars
    const primaryRgb = style.getPropertyValue('--brand-primary').trim();
    const primaryColor = primaryRgb ? `rgb(${primaryRgb})` : '#1A8FE3';
    
    // Text colors
    const textPrimaryRgb = style.getPropertyValue('--text-primary').trim();
    const textSecondaryRgb = style.getPropertyValue('--text-secondary').trim();
    const textPrimaryColor = textPrimaryRgb ? `rgb(${textPrimaryRgb})` : '#FFFFFF';
    const textSecondaryColor = textSecondaryRgb ? `rgb(${textSecondaryRgb})` : '#B0B6C5';
    
    // Background colors
    const bgSecondaryRgb = style.getPropertyValue('--bg-secondary').trim();
    const bgSecondaryColor = bgSecondaryRgb ? `rgb(${bgSecondaryRgb})` : '#1A2032';
    
    // Border colors
    const borderRgb = style.getPropertyValue('--ui-border').trim();
    const borderColor = borderRgb ? `rgb(${borderRgb})` : '#1C2028';
    
    return {
      primaryColor,
      textPrimaryColor,
      textSecondaryColor,
      bgSecondaryColor,
      borderColor
    };
  }

  // Create theme-aware gradient
  function createThemeGradient(ctx: CanvasRenderingContext2D): CanvasGradient {
    const colors = getThemeColors();
    const canvasHeight = ctx.canvas.height || 300;
    const gradient = ctx.createLinearGradient(0, canvasHeight, 0, 0);
    
    // Parse RGB values and create gradient with opacity
    const rgbMatch = colors.primaryColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch;
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.05)`);
      gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.25)`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.4)`);
    } else {
      // Fallback gradient
      gradient.addColorStop(0, 'rgba(26, 143, 227, 0.05)');
      gradient.addColorStop(0.7, 'rgba(26, 143, 227, 0.25)');
      gradient.addColorStop(1, 'rgba(26, 143, 227, 0.4)');
    }
    
    return gradient;
  }

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
      const tooltipData = {
        balances: [
          `${props.currentPool.symbol_0} Balance: ${formatNumber(dayData.token_0_balance)}`,
          `${props.currentPool.symbol_1} Balance: ${formatNumber(dayData.token_1_balance)}`
        ],
        prices: [
          `${props.currentPool.symbol_0} Price: $${formatNumber(dayData.token_0_price_usd, 6)}`,
          `${props.currentPool.symbol_1} Price: $${formatNumber(dayData.token_1_price_usd, 6)}`
        ],
        changes: []
      };
      
      // Calculate changes from previous day if not the first day
      if (index > 0) {
        const prevDay = props.balanceHistory[index - 1];
        const tvlChange = dayData.tvl_usd - prevDay.tvl_usd;
        
        if (Math.abs(tvlChange) > 0.01) {
          const percentChange = (tvlChange / prevDay.tvl_usd) * 100;
          const changeSign = tvlChange > 0 ? '+' : '';
          const percentSign = percentChange > 0 ? '+' : '';
          
          tooltipData.changes.push(
            `TVL Change: ${changeSign}$${formatNumber(Math.abs(tvlChange))} (${percentSign}${percentChange.toFixed(2)}%)`
          );
        }
      }
      
      processedTooltipData[index] = tooltipData;
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
    
    // Format dates to shorter format (e.g., "Jan 15")
    const labels = props.balanceHistory.map(entry => {
      const date = new Date(entry.date);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    });
    
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
    const colors = getThemeColors();
    
    // Create theme-aware TVL gradient
    const tvlGradient = createThemeGradient(ctx);
    
    // Get common chart options and extend with TVL-specific settings
    const baseOptions = getCommonChartOptions(isDarkMode, {
      callbacks: {
        label: function(context) {
          if (context.parsed.y !== null) {
            return `TVL: $${formatNumber(context.parsed.y)}`;
          }
          return '';
        },
        afterBody: function(context) {
          const index = context[0].dataIndex;
          const tooltipData = processedTooltipData[index];
          
          if (!tooltipData) return [];
          
          // Create organized tooltip lines
          const tooltipLines = [];
          
          // Add spacing and balances section
          tooltipLines.push('');
          tooltipLines.push(...tooltipData.balances);
          
          // Add spacing and prices section
          tooltipLines.push('');
          tooltipLines.push(...tooltipData.prices);
          
          // Add changes section if there are any
          if (tooltipData.changes.length > 0) {
            tooltipLines.push('');
            tooltipLines.push(...tooltipData.changes);
          }
          
          return tooltipLines;
        }
      }
    });

    // Override chart options with theme colors
    const chartOptions = {
      ...baseOptions,
      maintainAspectRatio: false,
      responsive: true,
      devicePixelRatio: 2,
      scales: {
        x: {
          display: true,
          grid: {
            display: false,
          },
          ticks: {
            display: true,
            color: colors.textSecondaryColor,
            maxTicksLimit: 8,
          }
        },
        y: {
          display: true,
          min: 0,
          grid: {
            display: false,
          },
          ticks: {
            display: true,
            color: colors.textSecondaryColor,
            callback: function(value) {
              const numValue = Number(value);
              if (numValue >= 1000000) {
                return '$' + (numValue / 1000000).toFixed(1) + 'M';
              } else if (numValue >= 1000) {
                return '$' + (numValue / 1000).toFixed(1) + 'K';
              } else {
                return '$' + Math.round(numValue);
              }
            }
          }
        }
      },
      layout: {
        padding: {
          top: 10,
          right: 10,
          bottom: 10,
          left: 10
        }
      },
      plugins: {
        ...baseOptions.plugins,
        tooltip: {
          ...baseOptions.plugins.tooltip,
          backgroundColor: colors.bgSecondaryColor,
          titleColor: colors.textPrimaryColor,
          bodyColor: colors.textPrimaryColor,
          borderColor: colors.borderColor,
        }
      }
    };
    
    tvlChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'TVL (USD)',
            data: tvlData,
            borderColor: colors.primaryColor,
            backgroundColor: colors.primaryColor,
            borderWidth: 1,
            borderRadius: 2,
            borderSkipped: false,
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

<Panel variant="solid" type="secondary" className="!overflow-visible !p-0">
  <div class="flex flex-col w-full h-full">
    <h3 class="flex items-center justify-between p-3 text-lg uppercase font-medium text-kong-text-primary/90">
      TVL
      <div class="flex items-center gap-2">
        <div class="text-kong-text-primary/90">
          {#if props.currentPool?.tvl}
            {(props.currentPool.tvl).toLocaleString(undefined, {
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
          onclick={() => props.fetchBalanceHistoryData()} 
          disabled={props.isLoading}
          title="Refresh data">
          <span class:animate-spin={props.isLoading}>
            <RefreshCw class="w-4 h-4" />
          </span>
        </button>
      </div>
    </h3>
    <div class="chart-container w-full -mx-[1px]" style="min-height: 300px; height: 100%;">
      {#if props.balanceHistory && props.balanceHistory.length > 0 && isChartAvailable}
        <canvas bind:this={tvlChartCanvas} class="w-full h-full !p-0 !m-0"></canvas>
      {:else}
        <div class="w-full flex flex-col items-center justify-center text-kong-text-primary/60 text-lg font-medium" style="min-height: 300px;">
          <BarChart3 class="mb-3 w-8 h-8" />
          {#if props.isLoading}
            <span class="animate-pulse">Loading chart data...</span>
          {:else if props.errorMessage}
            <span class="text-sm">{props.errorMessage}</span>
          {:else if !isChartAvailable}
            <span class="text-sm">Charts unavailable - Could not load Chart.js</span>
          {:else if props.currentPool}
            <span class="text-sm">No chart data available</span>
          {:else}
            <span class="text-sm">No chart data available</span>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</Panel>

<style lang="postcss">
@reference "../../../../../app.css";

  .chart-container {
    @apply relative !p-0 !m-0 overflow-visible transition-all duration-300;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .chart-container canvas {
    display: block !important;
  }
</style> 