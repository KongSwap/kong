<script lang="ts">
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
    type PoolBalanceHistoryItem,
  } from "./chartUtils";
  import type { Chart as ChartJS } from "chart.js/auto";
  import { liquidityStore } from "$lib/stores/liquidityStore";

  // Props
  const props = $props<{
    balanceHistory: PoolBalanceHistoryItem[];
    isLoading: boolean;
    errorMessage: string;
    currentPool: any;
  }>();

  // State variables using runes
  let Chart = $state<any>(null);
  let isChartAvailable = $state(false);
  let isDarkMode = $state(false);
  let observer = $state<MutationObserver | null>(null);
  let balanceChartCanvas = $state<HTMLCanvasElement | null>(null);
  let balanceChartInstance = $state<ChartJS | null>(null);
  let processedTooltipData = $state<Record<number, string>>({});
  let shouldUpdateChart = $state(false);
  let shouldUpdateLabels = $state(false);

  // Effect to initialize chart when component mounts
  $effect(() => {
    // Initialize chart asynchronously
    initChartAsync();

    // Cleanup on component destruction
    return () => {
      cleanupChart(balanceChartInstance, observer);
    };
  });

  // Separate async initialization
  async function initChartAsync() {
    // Initialize chart components
    const {
      Chart: ChartJS,
      isChartAvailable: chartAvailable,
      isDarkMode: darkMode,
      observer: themeObserver,
    } = await initializeChart();

    Chart = ChartJS;
    isChartAvailable = chartAvailable;
    isDarkMode = darkMode;
    observer = themeObserver;

    // Set up theme change observer
    if (observer) {
      observer.disconnect();
      observer = new MutationObserver(() => {
        const newDarkMode = document.documentElement.classList.contains("dark");
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
        attributeFilter: ["class"],
      });
    }

    // Initial chart creation if data exists
    if (props.balanceHistory && props.balanceHistory.length > 0) {
      prepareTooltipData();
      initOrUpdateBalanceChart();
    }
  }

  // Pre-process tooltip data to avoid expensive calculations on hover
  function prepareTooltipData() {
    processedTooltipData = {};

    props.balanceHistory.forEach((dayData, index) => {
      if (index === 0) return; // Skip first day for change calculations

      const prevDay = props.balanceHistory[index - 1];
      const token0Change = dayData.token_0_balance - prevDay.token_0_balance;
      const token1Change = dayData.token_1_balance - prevDay.token_1_balance;
      const lpChange = dayData.lp_token_supply - prevDay.lp_token_supply;

      let tooltipInfo = `Day Index: ${dayData.day_index}\n`;
      tooltipInfo += `LP Token Supply: ${formatNumber(dayData.lp_token_supply)}`;

      if (
        Math.abs(token0Change) > 0.0001 ||
        Math.abs(token1Change) > 0.0001 ||
        Math.abs(lpChange) > 0.0001
      ) {
        tooltipInfo += "\n\nChanges from previous day:";

        if (Math.abs(token0Change) > 0.0001) {
          const percentChange = (token0Change / prevDay.token_0_balance) * 100;
          tooltipInfo += `\nToken 0: ${token0Change > 0 ? "+" : ""}${formatNumber(token0Change)} (${percentChange > 0 ? "+" : ""}${percentChange.toFixed(2)}%)`;
        }

        if (Math.abs(token1Change) > 0.0001) {
          const percentChange = (token1Change / prevDay.token_1_balance) * 100;
          tooltipInfo += `\nToken 1: ${token1Change > 0 ? "+" : ""}${formatNumber(token1Change)} (${percentChange > 0 ? "+" : ""}${percentChange.toFixed(2)}%)`;
        }

        if (Math.abs(lpChange) > 0.0001) {
          const percentChange = (lpChange / prevDay.lp_token_supply) * 100;
          tooltipInfo += `\nLP Supply: ${lpChange > 0 ? "+" : ""}${formatNumber(lpChange)} (${percentChange > 0 ? "+" : ""}${percentChange.toFixed(2)}%)`;
        }
      }

      processedTooltipData[index] = tooltipInfo;
    });
  }

  // Watch for token selection changes
  $effect(() => {
    const token0Symbol = $liquidityStore.token0?.symbol;
    const token1Symbol = $liquidityStore.token1?.symbol;

    if ((token0Symbol || token1Symbol) && balanceChartInstance) {
      shouldUpdateLabels = true;
    }
  });

  // Watch for balance history changes
  $effect(() => {
    const balanceHistoryLength = props.balanceHistory?.length || 0;
    if (balanceHistoryLength > 0) {
      shouldUpdateChart = true;
    }
  });

  // Effect to handle chart updates
  $effect(() => {
    if (shouldUpdateLabels && balanceChartInstance) {
      // Just update the labels without recreating the chart
      balanceChartInstance.data.datasets[0].label =
        $liquidityStore.token0?.symbol || "Token 0";
      balanceChartInstance.data.datasets[1].label =
        $liquidityStore.token1?.symbol || "Token 1";
      balanceChartInstance.update("none"); // Minimal animation
      shouldUpdateLabels = false;
    }
  });

  // Separate effect to handle full chart updates
  $effect(() => {
    if (shouldUpdateChart && isChartAvailable && Chart) {
      prepareTooltipData();
      initOrUpdateBalanceChart();
    }
  });

  function initOrUpdateBalanceChart(shouldReinitialize = true) {
    if (
      !balanceChartCanvas ||
      !props.balanceHistory ||
      props.balanceHistory.length === 0 ||
      !isChartAvailable ||
      !Chart
    )
      return;

    // If we're just updating labels but not recreating the entire chart
    if (!shouldReinitialize && balanceChartInstance) {
      balanceChartInstance.data.datasets[0].label =
        $liquidityStore.token0?.symbol || "Token 0";
      balanceChartInstance.data.datasets[1].label =
        $liquidityStore.token1?.symbol || "Token 1";
      balanceChartInstance.update("none"); // Minimal animation
      shouldUpdateLabels = false;
      return;
    }

    // If the chart exists and we're updating data but not labels
    if (balanceChartInstance && shouldReinitialize && props.balanceHistory) {
      // Update data without recreating the chart
      balanceChartInstance.data.labels = props.balanceHistory.map(
        (entry) => entry.date,
      );
      balanceChartInstance.data.datasets[0].data = props.balanceHistory.map(
        (entry) => entry.token_0_balance,
      );
      balanceChartInstance.data.datasets[1].data = props.balanceHistory.map(
        (entry) => entry.token_1_balance,
      );

      // Update significant change points more efficiently
      const token0Changes = calculateSignificantChanges(
        props.balanceHistory,
        "token_0_balance",
      );
      const token1Changes = calculateSignificantChanges(
        props.balanceHistory,
        "token_1_balance",
      );

      // Combine both token changes into a single dataset, removing duplicates
      const significantChangePoints = [...token0Changes, ...token1Changes]
        .filter((v, i, a) => a.findIndex((t) => t.x === v.x) === i)
        // Ensure the points are properly positioned on the chart
        .map(point => {
          // Find the corresponding data point in the original dataset
          const dataIndex = props.balanceHistory.findIndex(item => item.date === point.x);
          if (dataIndex >= 0) {
            // Use the token with the larger value to ensure visibility
            const token0Value = props.balanceHistory[dataIndex].token_0_balance;
            const token1Value = props.balanceHistory[dataIndex].token_1_balance;
            return {
              x: point.x,
              y: Math.max(token0Value, token1Value),
              change: point.change
            };
          }
          return point;
        });

      balanceChartInstance.data.datasets[2].data = significantChangePoints;

      balanceChartInstance.update("none"); // Minimal animation
      shouldUpdateChart = false;
      return;
    }

    // Clean up existing chart instance if it exists
    if (balanceChartInstance) {
      balanceChartInstance.destroy();
    }

    const ctx = balanceChartCanvas.getContext("2d");

    // Get the values directly from the API response
    const token0Data = props.balanceHistory.map(
      (entry) => entry.token_0_balance,
    );
    const token1Data = props.balanceHistory.map(
      (entry) => entry.token_1_balance,
    );

    // Find days with significant balance changes using the shared utility
    const token0Changes = calculateSignificantChanges(
      props.balanceHistory,
      "token_0_balance",
    );
    const token1Changes = calculateSignificantChanges(
      props.balanceHistory,
      "token_1_balance",
    );

    // Combine both token changes into a single dataset, removing duplicates
    const significantChangePoints = [...token0Changes, ...token1Changes]
      .filter((v, i, a) => a.findIndex((t) => t.x === v.x) === i)
      // Ensure the points are properly positioned on the chart
      .map(point => {
        // Find the corresponding data point in the original dataset
        const dataIndex = props.balanceHistory.findIndex(item => item.date === point.x);
        if (dataIndex >= 0) {
          // Use the token with the larger value to ensure visibility
          const token0Value = token0Data[dataIndex];
          const token1Value = token1Data[dataIndex];
          return {
            x: point.x,
            y: Math.max(token0Value, token1Value),
            change: point.change
          };
        }
        return point;
      });

    // Check if token values are significantly different in scale
    const token0Max = Math.max(...token0Data);
    const token1Max = Math.max(...token1Data);

    // Use a larger threshold (10x difference) to determine when to use dual axes
    const needsDualAxis =
      token0Max > token1Max * 10 || token1Max > token0Max * 10;

    // Get theme colors
    const colors = getChartThemeColors(isDarkMode);

    // Create theme-aware gradients using the shared utility
    const token0Gradient = createChartGradient(
      ctx,
      isDarkMode,
      colors.token0Color,
    );
    const token1Gradient = createChartGradient(
      ctx,
      isDarkMode,
      colors.token1Color,
    );

    // Get common chart options and extend with pool-specific settings
    const chartOptions = getCommonChartOptions(isDarkMode, {
      callbacks: {
        label: function (context) {
          let label = context.dataset.label || "";
          if (label) {
            label += ": ";
          }

          // Special handling for significant change markers
          if (label.includes("Significant Changes")) {
            return "Significant balance change";
          }

          if (context.parsed.y !== null) {
            // Format large numbers with commas for better readability
            label += formatNumber(context.parsed.y);
          }
          return label;
        },
        afterBody: function (context) {
          const index = context[0].dataIndex;
          // Use pre-processed tooltip data instead of calculating on hover
          return processedTooltipData[index] || "";
        },
      },
      maintainAspectRatio: false,
      responsive: true,
      devicePixelRatio: 2,
    });

    // Ensure x-axis dates are not displayed
    if (!chartOptions.scales) {
      chartOptions.scales = {};
    }
    
    chartOptions.scales.x = {
      ...chartOptions.scales.x,
      display: false, // Hide entire x-axis
      grid: {
        display: false,
      },
      ticks: {
        display: false,
        padding: 0,
      }
    };

    chartOptions.scales.y = {
      ...chartOptions.scales.y,
      display: false, // Hide entire y-axis
      beginAtZero: true, // Start from zero to fill space
      grid: {
        display: false, // Hide grid lines
      },
      ticks: {
        display: false,
        padding: 0,
      }
    };

    // Make sure no axis labels are displayed
    if (!chartOptions.plugins) {
      chartOptions.plugins = {};
    }

    // Ensure no axis titles are displayed
    chartOptions.plugins = {
      ...chartOptions.plugins,
      title: {
        display: false
      }
    };

    // Ensure no layout padding
    if (!chartOptions.layout) {
      chartOptions.layout = {};
    }
    chartOptions.layout.padding = {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    }; // No padding at all

    // Extend the common options with dual-axis specific settings if needed
    if (needsDualAxis) {
      // Fix the type issue with scales by creating a proper configuration
      const scalesConfig = {
        x: {
          display: false, // Hide entire x-axis
          grid: {
            display: false,
          },
          ticks: {
            display: false,
            padding: 0,
          }
        },
        y: {
          type: "linear" as const,
          display: false, // Hide entire y-axis
          position: "left" as const,
          beginAtZero: true,
          grid: {
            display: false,
          },
          ticks: {
            display: false,
            padding: 0,
          },
        },
        y1: {
          type: "linear" as const,
          display: false, // Hide entire y1-axis
          position: "right" as const,
          beginAtZero: true,
          grid: {
            display: false,
          },
          ticks: {
            display: false,
            padding: 0,
          },
        },
      };

      chartOptions.scales = scalesConfig;
    }

    balanceChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: props.balanceHistory.map(entry => entry.date),
        datasets: [
          {
            label: $liquidityStore.token0?.symbol || "Token 0",
            data: props.balanceHistory.map(entry => entry.token_0_balance),
            borderColor: colors.token0Color,
            backgroundColor: token0Gradient,
            borderWidth: 2,
            pointRadius: 0, // Hide all points for cleaner look
            pointBackgroundColor: colors.token0Color,
            pointBorderColor: colors.pointBorderColor,
            pointBorderWidth: 1.5,
            tension: 0.3,
            fill: true,
            yAxisID: needsDualAxis ? "y" : "y",
            clip: false, // Allow drawing outside the chart area
          },
          {
            label: $liquidityStore.token1?.symbol || "Token 1",
            data: props.balanceHistory.map(entry => entry.token_1_balance),
            borderColor: colors.token1Color,
            backgroundColor: token1Gradient,
            borderWidth: 2,
            pointRadius: 0, // Hide all points for cleaner look
            pointBackgroundColor: colors.token1Color,
            pointBorderColor: colors.pointBorderColor,
            pointBorderWidth: 1.5,
            tension: 0.3,
            fill: true,
            yAxisID: needsDualAxis ? "y1" : "y",
            clip: false, // Allow drawing outside the chart area
          },
        ],
      },
      options: {
        ...chartOptions,
        maintainAspectRatio: false, // Allow filling the entire container
        responsive: true, // Ensure responsiveness
        devicePixelRatio: 2, // Sharper rendering
        plugins: {
          ...chartOptions.plugins,
          tooltip: {
            ...chartOptions.plugins?.tooltip,
            // Ensure tooltips are displayed for all points
            intersect: false,
            mode: 'index'
          }
        }
      },
    });

    // Reset the update flags
    shouldUpdateChart = false;
    shouldUpdateLabels = false;
  }
</script>

<Panel variant="solid" type="secondary" className="!overflow-visible !p-0">
  <div class="flex flex-col w-full h-full">
    <h3 class="chart-title flex items-start justify-between py-3 px-3">
      Pool Balance
      <div class="text-kong-text-primary/90 flex items-center gap-2">
        {#if props.currentPool && $liquidityStore.token0 && $liquidityStore.token1}
          <div class="flex items-center gap-1">
            <span
              >{typeof props.currentPool.balance_0 === "number"
                ? formatNumber(props.currentPool.balance_0)
                : "0.00"}</span
            >
            <span class="text-kong-primary/80 text-sm mt-1"
              >{$liquidityStore.token0.symbol}</span
            >
          </div>
          <div class="flex items-center gap-1">
            <span
              >{typeof props.currentPool.balance_1 === "number"
                ? formatNumber(props.currentPool.balance_1)
                : "0.00"}</span
            >
            <span class="text-kong-success/80 text-sm mt-1"
              >{$liquidityStore.token1.symbol}</span
            >
          </div>
        {:else}
          <div class="flex items-center gap-1">
            <span>0.00</span>
            <span class="text-kong-success/80 text-sm mt-1"
              >{$liquidityStore.token0?.symbol || "-"}</span
            >
          </div>
          <div class="flex items-center gap-1">
            <span>0.00</span>
            <span class="text-kong-primary/80 text-sm mt-1"
              >{$liquidityStore.token1?.symbol || "-"}</span
            >
          </div>
        {/if}
      </div>
    </h3>
    <div class="chart-container w-full" style="min-height: 300px; height: 100%;">
      {#if props.balanceHistory && props.balanceHistory.length > 0 && isChartAvailable}
        <canvas bind:this={balanceChartCanvas} class="w-full h-full !p-0 !m-0"></canvas>
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
            <span class="text-sm">Charts Coming Soon</span>
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
    @apply relative !p-0 !m-0 overflow-hidden transition-all duration-300;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom-left-radius: 0.5rem;
    border-bottom-right-radius: 0.5rem;
  }
  
  .chart-container canvas {
    display: block !important;
  }

</style>
