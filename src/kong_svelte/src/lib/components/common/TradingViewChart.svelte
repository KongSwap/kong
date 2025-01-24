<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { writable } from "svelte/store";
  import { KongDatafeed } from "$lib/services/tradingview/datafeed";
  import { loadTradingViewLibrary } from "$lib/services/tradingview/widget";
  import { getChartConfig } from "$lib/services/tradingview/config";
  import { fetchChartData } from "$lib/services/indexer/api";
  import { livePools } from "$lib/services/pools/poolStore";
  import { debounce } from "lodash-es";

  // Convert props to runes syntax
  const props = $props<{
    poolId?: number;
    symbol?: string;
    quoteToken: FE.Token;
    baseToken: FE.Token;
  }>();

  // Local state
  let chartContainer: HTMLElement;
  let isLoading = $state(true);
  let hasNoData = $state(false);
  let selectedPoolId: number | undefined = $state(undefined);
  let updateTimeout: NodeJS.Timeout;
  let routingPath = $state<string[]>([]);
  let previousQuoteTokenId = $state<string | undefined>(undefined);
  let previousBaseTokenId = $state<string | undefined>(undefined);
  let chartWrapper: HTMLElement;

  // Create a store for the chart
  const chartStore = writable<any>(null);

  // Subscribe to store changes to update our local variable
  let chart: any;
  chartStore.subscribe((value) => {
    chart = value;
  });

  // Watch for pool store changes and type the pools array
  const pools = $derived(($livePools || []) as BE.Pool[]);

  // Update selected pool and routing path when pools or selectedPoolId changes
  const selectedPool = $derived(pools.find((p) => Number(p.pool_id) === selectedPoolId) as BE.Pool | undefined);

  // Update routing path when selected pool changes
  $effect(() => {
    if (selectedPool) {
      routingPath = [selectedPool.symbol_0, selectedPool.symbol_1];
    }
  });

  // Watch for token or pool changes and reinitialize chart
  $effect(() => {
    const currentFromId = props.quoteToken?.canister_id;
    const currentToId = props.baseToken?.canister_id;
    const hasTokenChange =
      currentFromId !== previousQuoteTokenId ||
      currentToId !== previousBaseTokenId;
    const hasPoolChange = props.poolId !== selectedPoolId;

    if (
      (hasTokenChange || hasPoolChange) &&
      ((props.quoteToken && props.baseToken) || props.poolId) &&
      (!chart || (chart && hasTokenChange))
    ) {
      previousQuoteTokenId = currentFromId;
      previousBaseTokenId = currentToId;

      if (chart) {
        chart.remove();
        chartStore.set(null);
      }
      debouncedFetchData();
    }
  });

  onDestroy(() => {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    if (chart) {
      try {
        chart.remove();
        chartStore.set(null);
      } catch (e) {
        console.warn("Error cleaning up chart:", e);
      }
    }
    debouncedFetchData.cancel();
  });

  // Add the derived currentPrice
  const currentPrice = $derived(() => {
    const pool = $livePools.find(p => p.pool_id === selectedPoolId);
    return pool?.price || 1000;
  });

  // Add the price update effect
  $effect(() => {
    if (chart?.datafeed && currentPrice) {
      chart.datafeed.updateCurrentPrice(currentPrice);
    }
  });

  const initChart = async () => {
    if (!chartContainer || !props.quoteToken?.token_id || !props.baseToken?.token_id) {
      console.log('Missing required props for chart initialization');
      isLoading = false;
      return;
    }

    // Wait for next tick and check dimensions
    const checkDimensions = () => {
      return new Promise((resolve) => {
        const check = () => {
          // Force a reflow to ensure dimensions are calculated
          chartWrapper?.offsetHeight;
          const width = chartWrapper?.clientWidth;
          const height = chartWrapper?.clientHeight;
          
          if (width && height) {
            resolve({ width, height });
          } else {
            requestAnimationFrame(check);
          }
        };
        check();
      });
    };

    try {
      const dimensions: { width: number; height: number } = await checkDimensions() as { width: number; height: number };
      await loadTradingViewLibrary();
      const isMobile = window.innerWidth < 768;
      
      // Get current price from poolStore
      const currentPrice = $livePools.find(p => p.pool_id === selectedPoolId)?.price || 1000;

      // Pass current price to datafeed
      const datafeed = new KongDatafeed(
        props.quoteToken.token_id, 
        props.baseToken.token_id,
        currentPrice
      );

      const chartConfig = getChartConfig({
        symbol: props.symbol || `${props.baseToken.symbol}/${props.quoteToken.symbol}`,
        datafeed,
        container: chartContainer,
        containerWidth: dimensions.width,
        containerHeight: dimensions.height,
        isMobile,
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      });

      const widget = new window.TradingView.widget(chartConfig);
      
      // Store datafeed reference
      widget.datafeed = datafeed;

      widget.onChartReady(() => {
        widget._ready = true;
        chartStore.set(widget);
        isLoading = false;
        hasNoData = false;
      });

      widget.onError = (error: string) => {
        console.error("Error creating chart:", error);
        isLoading = false;
      };
    } catch (error) {
      console.error("Failed to initialize chart:", error);
      isLoading = false;
    }
  };

  // Get the best pool for the token pair
  async function getBestPool() {
    if (!props.quoteToken || !props.baseToken) {
      return selectedPoolId ? { pool_id: selectedPoolId } : null;
    }

    try {
      const directPool = pools.find(
        (p) =>
          (p.address_0 === props.quoteToken.canister_id &&
            p.address_1 === props.baseToken.canister_id) ||
          (p.address_1 === props.quoteToken.canister_id &&
            p.address_0 === props.baseToken.canister_id),
      );

      if (directPool) {
        selectedPoolId = Number(directPool.pool_id);
        return { pool_id: selectedPoolId };
      }

      const relatedPool = pools.find(
        (p) =>
          p.address_0 === props.quoteToken.canister_id ||
          p.address_1 === props.quoteToken.canister_id ||
          p.address_0 === props.baseToken.canister_id ||
          p.address_1 === props.baseToken.canister_id,
      );

      if (relatedPool) {
        selectedPoolId = Number(relatedPool.pool_id);
        return { pool_id: selectedPoolId };
      }

      selectedPoolId = undefined;
      return null;
    } catch (error) {
      console.error("Failed to get pool info:", error);
      selectedPoolId = undefined;
      return null;
    }
  }

  const debouncedFetchData = debounce(async () => {
    try {
      isLoading = true;
      hasNoData = false;

      const bestPool =
        props.quoteToken && props.baseToken
          ? await getBestPool()
          : { pool_id: selectedPoolId };

      if (!bestPool?.pool_id) {
        hasNoData = true;
        isLoading = false;
        return;
      }

      selectedPoolId = bestPool.pool_id;
      const now = Math.floor(Date.now() / 1000);
      const startTime = now - 2 * 365 * 24 * 60 * 60;

      const payTokenId = props.quoteToken?.token_id || 1;
      const receiveTokenId = props.baseToken?.token_id || 10;

      const candleData = await fetchChartData(
        payTokenId,
        receiveTokenId,
        startTime,
        now,
        "60",
      );

      if (candleData.length === 0) {
        hasNoData = true;
        if (chart) {
          chart.remove();
          chartStore.set(null);
        }
      } else {
        hasNoData = false;
        if (!chart) {
          await initChart();
        }
      }
    } catch (error) {
      console.error("Failed to fetch chart data:", error);
      hasNoData = true;
      if (chart) {
        chart.remove();
        chartStore.set(null);
      }
    } finally {
      isLoading = false;
    }
  }, 300);

  let initObserver: ResizeObserver;
  let resizeObserver: ResizeObserver;

  onMount(() => {
    // Initial data fetch when component mounts
    if ((props.quoteToken && props.baseToken) || props.poolId) {
      debouncedFetchData();
    }


    return () => {
      if (chart) {
        try {
          chart.remove();
          chartStore.set(null);
        } catch (e) {
          console.warn("Error cleaning up chart:", e);
        }
      }
      debouncedFetchData.cancel();
    };
  });
</script>

<div class="chart-wrapper h-full" bind:this={chartWrapper}>
  <div
    class="chart-container h-full w-full relative"
    bind:this={chartContainer}
  >
    {#if hasNoData}
      <div
        class="absolute inset-0 bg-transparent flex flex-col items-center justify-center p-4 text-center"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-12 w-12 mb-3 text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <p class="text-lg font-medium text-gray-400">
          No Trading Data Available
        </p>
        <p class="text-sm text-gray-500 mt-1">
          This trading pair hasn't had any trading activity yet.
        </p>
      </div>
    {:else if isLoading}
      <div
        class="absolute inset-0 bg-transparent flex items-center justify-center"
      >
        <svg
          class="animate-spin h-8 w-8 text-blue-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>
    {:else if routingPath.length > 1}
      <div
        class="absolute top-0 left-0 p-2 bg-black bg-opacity-50 text-white text-sm rounded m-2"
      >
        Note: Showing chart for {routingPath[0]} → {routingPath[1]} pool
      </div>
    {/if}
  </div>
</div>

<style scoped lang="postcss">

  .chart-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 400px;
    background: transparent;
    border-radius: 12px;
    overflow: hidden;
  }

  .chart-container {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100% !important;
    height: 100% !important;
  }

  :global(.layout__area--top) {
    background: transparent !important;
  }

  :global(.layout__area--left) {
    background: transparent !important;
  }

  :global(.tools-group),
  :global(.button-2ioYhFEY-),
  :global(.button-1VVj8kLG-),
  :global(.toggleButton-3zv4iS2j-),
  :global(.button-2pZNJ24z-) {
    background-color: transparent !important;
  }

  :global(.tools-group:hover),
  :global(.button-2ioYhFEY-:hover),
  :global(.button-1VVj8kLG-:hover),
  :global(.toggleButton-3zv4iS2j-:hover),
  :global(.button-2pZNJ24z-:hover) {
    background-color: theme('colors.kong.border') !important;
  }

  :global(.tools-group.active),
  :global(.button-2ioYhFEY-.active),
  :global(.button-1VVj8kLG-.active),
  :global(.toggleButton-3zv4iS2j-.isActive-3zv4iS2j-),
  :global(.button-2pZNJ24z-.active) {
    background-color: theme('colors.kong.border-light') !important;
  }

  :global(.group-2JyOhh7Z-),
  :global(.inner-2JyOhh7Z-) {
    border: none !important;
    background-color: transparent !important;
  }

  :global(#drawing-toolbar) {
    background: red !important;
  }

  :global(.tradingview-widget-container) {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
  }

  :global(.tv-lightweight-charts) {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    font-family: inherit !important;
  }

  :global(.chart-theme-dark) {
    --tv-color-platform-background: transparent;
    --tv-color-pane-background: transparent;
    --tv-color-toolbar-button-background-hover: theme('colors.kong.border');
    --tv-color-toolbar-button-background-expanded: theme('colors.kong.border-light');
    --tv-color-toolbar-button-background-active: theme('colors.kong.border-light');
    --tv-color-toolbar-button-text: theme('colors.kong.text.primary');
    --tv-color-toolbar-button-text-hover: theme('colors.kong.text.primary');
    --tv-color-toolbar-divider-background: theme('colors.kong.border');
  }

  :global(.chart-theme-light) {
    --tv-color-platform-background: transparent;
    --tv-color-pane-background: transparent;
    --tv-color-toolbar-button-background-hover: rgba(0, 0, 0, 0.1);
    --tv-color-toolbar-button-background-expanded: rgba(0, 0, 0, 0.1);
    --tv-color-toolbar-button-background-active: rgba(0, 0, 0, 0.1);
    --tv-color-toolbar-button-text: theme('colors.kong.text.primary');
    --tv-color-toolbar-button-text-hover: theme('colors.kong.text.primary');
    --tv-color-toolbar-divider-background: rgba(0, 0, 0, 0.1);
  }

  :global(.tradingview-widget-container) {
    --tv-color-platform-background: transparent !important;
  }

  /* Override TradingView's default styles for better theme integration */
  :global(.layout__area--top),
  :global(.layout__area--left) {
    background: transparent !important;
  }

  :global(.chart-container) {
    background: transparent !important;
  }

  /* Update loading and no-data states to use theme colors */
  .chart-wrapper :global(.loading-indicator) {
    @apply text-kong-text-primary;
  }

  .chart-wrapper :global(.no-data-message) {
    @apply text-kong-text-secondary;
  }

  :global(.chart-theme-dark),
  :global(.chart-theme-light) {
    --tv-color-platform-background: transparent;
    --tv-color-pane-background: transparent;
  }

  /* Make chart background transparent */
  :global(.chart-container),
  :global(.tv-lightweight-charts),
  :global(.layout__area--center),
  :global(.chart-markup-table),
  :global(.chart-container-border),
  :global(.chart-gui-wrapper),
  :global(.layout__area--center),
  :global(.chart-markup-table),
  :global(.pane-legend-line.main) {
    background-color: transparent !important;
  }

  /* Override specific TradingView elements */
  :global(.group-wWM3zP_M-),
  :global(.container-wWM3zP_M-) {
    background-color: transparent !important;
  }

  /* Style toolbar buttons */
  :global(.button-2ioYhFEY-),
  :global(.button-1VVj8kLG-),
  :global(.button-2pZNJ24z-) {
    background-color: transparent !important;
  }

  :global(.button-2ioYhFEY-:hover),
  :global(.button-1VVj8kLG-:hover),
  :global(.button-2pZNJ24z-:hover) {
    background-color: theme('colors.kong.border') !important;
  }

  :global(.button-2ioYhFEY-.active),
  :global(.button-1VVj8kLG-.active),
  :global(.button-2pZNJ24z-.active) {
    background-color: theme('colors.kong.border-light') !important;
  }

  /* Additional theme-specific styles */
  :global(.dark) {
    --tv-color-toolbar-button-background-hover: theme('colors.kong.border');
    --tv-color-toolbar-button-background-active: theme('colors.kong.border-light');
    --tv-color-toolbar-button-text: theme('colors.kong.text.primary');
    --tv-color-toolbar-button-text-hover: theme('colors.kong.text.primary');
  }

  :global(.light) {
    --tv-color-toolbar-button-background-hover: rgba(0, 0, 0, 0.1);
    --tv-color-toolbar-button-background-active: rgba(0, 0, 0, 0.2);
    --tv-color-toolbar-button-text: theme('colors.kong.text.primary');
    --tv-color-toolbar-button-text-hover: theme('colors.kong.text.primary');
  }
</style>
