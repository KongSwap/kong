<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { writable } from "svelte/store";
  import { KongDatafeed } from "$lib/config/tradingview/datafeed.config";
  import { loadTradingViewLibrary } from "$lib/config/tradingview/widget.config";
  import { getChartConfig } from "$lib/config/tradingview/chart.config";
  import { fetchChartData } from "$lib/api/transactions";
  import { livePools } from "$lib/services/pools/poolStore";
  import { debounce } from "lodash-es";

  // Generate a unique ID for this chart instance
  const chartInstanceId = Math.random().toString(36).substring(2, 15);
  
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
  // Add a flag to track if data fetch is in progress
  let isFetchingData = $state(false);
  // Add a flag to track if chart initialization is in progress
  let isInitializingChart = $state(false);
  // Add a flag to track if component is mounted
  let isMounted = $state(false);

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

  // Helper function to update price scale precision
  const updatePriceScalePrecision = (widget: any, precision: number, minMove: number) => {
    if (!widget || !widget.chart || !widget.chart()) return;
    
    try {
      console.log(`[Chart ${chartInstanceId}] Updating price scale precision to ${precision} with minMove ${minMove}`);
      
      // Apply precision settings using the correct property paths
      widget.applyOverrides({
        "mainSeriesProperties.priceFormat.precision": precision,
        "mainSeriesProperties.priceFormat.minMove": minMove
      });
      
      // Force chart to redraw
      setTimeout(() => {
        try {
          widget.chart().executeActionById("chartReset");
        } catch (e) {
          console.warn(`[Chart ${chartInstanceId}] Error resetting chart:`, e);
        }
      }, 100);
    } catch (e) {
      console.warn(`[Chart ${chartInstanceId}] Error updating price scale precision:`, e);
    }
  };

  // Watch for token or pool changes and reinitialize chart
  $effect(() => {
    // Skip if not mounted yet
    if (!isMounted) return;
    
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
      console.log(`[Chart ${chartInstanceId}] Token or pool change detected: 
        - Token change: ${hasTokenChange} (${previousQuoteTokenId} -> ${currentFromId}, ${previousBaseTokenId} -> ${currentToId})
        - Pool change: ${hasPoolChange} (${selectedPoolId} -> ${props.poolId})
      `);
      
      previousQuoteTokenId = currentFromId;
      previousBaseTokenId = currentToId;
      selectedPoolId = props.poolId;

      if (chart) {
        console.log(`[Chart ${chartInstanceId}] Removing existing chart before reinitializing`);
        chart.remove();
        chartStore.set(null);
      }
      
      // Use debounced fetch to prevent multiple rapid fetches
      debouncedFetchData();
    }
  });

  onDestroy(() => {
    console.log(`[Chart ${chartInstanceId}] Component being destroyed, cleaning up resources`);
    
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    if (chart) {
      try {
        // Remove the error event listener first
        window.removeEventListener('error', handleTradingViewError);
        
        // Safely remove the chart with proper cleanup
        if (chart._ready && chart.chart) {
          // First clear any active drawings or tools
          try {
            const chartObj = chart.chart();
            if (chartObj) {
              // Try to clear active drawings
              chartObj.clearUndoHistory();
            }
          } catch (e) {
            console.warn(`[Chart ${chartInstanceId}] Error clearing chart state:`, e);
          }
          
          // Small delay to ensure chart is ready for removal
          setTimeout(() => {
            try {
              chart.remove();
            } catch (e) {
              console.warn(`[Chart ${chartInstanceId}] Error during chart removal:`, e);
            } finally {
              chartStore.set(null);
            }
          }, 10);
        } else {
          chart.remove();
          chartStore.set(null);
        }
      } catch (e) {
        console.warn(`[Chart ${chartInstanceId}] Error cleaning up chart:`, e);
        chartStore.set(null);
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
      
      // When price updates, also update precision if needed
      const pool = $livePools.find(p => p.pool_id === selectedPoolId);
      if (pool?.price) {
        const getPrecision = (price: number) => {
          // Adjust price based on token decimals
          const adjustedPrice = price * Math.pow(10, pool.token1.decimals - pool.token0.decimals);
          
          if (adjustedPrice >= 1000) return 5;
          if (adjustedPrice >= 1) return 8;
          return 8;
        };

        const getMinMove = (price: number) => {
          // Adjust price based on token decimals
          const adjustedPrice = price * Math.pow(10, pool.token1.decimals - pool.token0.decimals);
          
          if (adjustedPrice >= 1000) return 0.00001;
          if (adjustedPrice >= 1) return 0.0000001;
          return 0.00000001;
        };
        
        const precision = getPrecision(pool.price);
        const minMove = getMinMove(pool.price);
        
        // Update price scale precision when price changes
        updatePriceScalePrecision(chart, precision, minMove);
      }
    }
  });

  // Define the error handler function outside to be able to remove it later
  const handleTradingViewError = (e) => {
    if (e.message?.includes('split is not a function')) {
      console.warn(`[Chart ${chartInstanceId}] Caught TradingView formatting error, will attempt to recover`);
      // The error is related to price formatting, we can safely ignore it
      e.preventDefault();
      e.stopPropagation();
      return true;
    }
  };

  const initChart = async () => {
    // Prevent multiple initializations
    if (isInitializingChart) {
      console.log(`[Chart ${chartInstanceId}] Chart initialization already in progress, skipping`);
      return;
    }
    
    isInitializingChart = true;
    
    if (!chartContainer || !props.quoteToken?.token_id || !props.baseToken?.token_id) {
      console.log(`[Chart ${chartInstanceId}] Missing required props for chart initialization`);
      isLoading = false;
      isInitializingChart = false;
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
      console.log(`[Chart ${chartInstanceId}] Starting chart initialization`);
      
      const dimensions: { width: number; height: number } = await checkDimensions() as { width: number; height: number };
      await loadTradingViewLibrary();
      const isMobile = window.innerWidth < 768;
      
      // Get current price from poolStore
      const pool = $livePools.find(p => p.pool_id === selectedPoolId);
      const currentPrice = pool?.price || 1000;

      // Pass current price and token decimals to datafeed
      const datafeed = new KongDatafeed(
        props.quoteToken.token_id, 
        props.baseToken.token_id,
        currentPrice,
        props.quoteToken.decimals || 8,
        props.baseToken.decimals || 8
      );

      // Force higher precision based on price
      const chartConfig = getChartConfig({
        symbol: props.symbol || `${props.baseToken.symbol}/${props.quoteToken.symbol}`,
        datafeed,
        container: chartContainer,
        containerWidth: dimensions.width,
        containerHeight: dimensions.height,
        isMobile,
        currentPrice,
        theme: document.documentElement.classList.contains('plain-black') 
          ? 'plain-black' 
          : document.documentElement.classList.contains('dark') 
            ? 'dark' 
            : 'light',
        quoteTokenDecimals: props.quoteToken.decimals || 8,
        baseTokenDecimals: props.baseToken.decimals || 8
      });

      // Add global error handler for TradingView errors
      window.removeEventListener('error', handleTradingViewError); // Remove any existing handler
      window.addEventListener('error', handleTradingViewError, true);

      const widget = new window.TradingView.widget(chartConfig);
      
      // Store datafeed reference
      widget.datafeed = datafeed;

      widget.onChartReady(() => {
        console.log(`[Chart ${chartInstanceId}] Chart is ready`);
        widget._ready = true;
        chartStore.set(widget);
        isLoading = false;
        hasNoData = false;
        isInitializingChart = false;
        
        // Force price scale update after chart is ready
        setTimeout(() => {
          try {
            // Get the precision and minMove from the chart config
            const configPrecision = chartConfig.overrides["mainSeriesProperties.priceAxisProperties.precision"];
            const configMinMove = chartConfig.overrides["mainSeriesProperties.priceAxisProperties.minMove"];
            
            // Update the price scale precision
            updatePriceScalePrecision(widget, configPrecision || 8, configMinMove || 0.00000001);
          } catch (e) {
            console.warn(`[Chart ${chartInstanceId}] Error updating price scale:`, e);
          }
        }, 500);
      });

      widget.onError = (error: string) => {
        console.error(`[Chart ${chartInstanceId}] Error creating chart:`, error);
        isLoading = false;
        isInitializingChart = false;
      };
    } catch (error) {
      console.error(`[Chart ${chartInstanceId}] Failed to initialize chart:`, error);
      isLoading = false;
      isInitializingChart = false;
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
      console.error(`[Chart ${chartInstanceId}] Failed to get pool info:`, error);
      selectedPoolId = undefined;
      return null;
    }
  }

  const debouncedFetchData = debounce(async () => {
    // Prevent multiple fetches
    if (isFetchingData) {
      console.log(`[Chart ${chartInstanceId}] Data fetch already in progress, skipping`);
      return;
    }
    
    isFetchingData = true;
    
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
        isFetchingData = false;
        return;
      }

      selectedPoolId = bestPool.pool_id;
      const now = Math.floor(Date.now() / 1000);
      const startTime = now - 90 * 24 * 60 * 60;

      const payTokenId = props.quoteToken?.token_id || 1;
      const receiveTokenId = props.baseToken?.token_id || 10;

      console.log(`[Chart ${chartInstanceId}] Fetching chart data for ${payTokenId}/${receiveTokenId} from ${startTime} to ${now}`);
      
      const candleData = await fetchChartData(
        payTokenId,
        receiveTokenId,
        startTime,
        now,
        "60",
      );

      if (candleData.length === 0) {
        console.log(`[Chart ${chartInstanceId}] No candle data received`);
        hasNoData = true;
        if (chart) {
          chart.remove();
          chartStore.set(null);
        }
      } else {
        console.log(`[Chart ${chartInstanceId}] Received ${candleData.length} candles`);
        hasNoData = false;
        if (!chart) {
          await initChart();
        }
      }
    } catch (error) {
      console.error(`[Chart ${chartInstanceId}] Failed to fetch chart data:`, error);
      hasNoData = true;
      if (chart) {
        chart.remove();
        chartStore.set(null);
      }
    } finally {
      isLoading = false;
      isFetchingData = false;
    }
  }, 300);

  let initObserver: ResizeObserver;
  let resizeObserver: ResizeObserver;

  onMount(() => {
    console.log(`[Chart ${chartInstanceId}] Component mounted`);
    isMounted = true;
    
    // Initial data fetch when component mounts
    if ((props.quoteToken && props.baseToken) || props.poolId) {
      console.log(`[Chart ${chartInstanceId}] Component mounted, triggering initial data fetch`);
      // Set initial pool ID
      selectedPoolId = props.poolId;
      // Trigger data fetch
      debouncedFetchData();
    }

    return () => {
      console.log(`[Chart ${chartInstanceId}] Component unmounting`);
      if (chart) {
        try {
          chart.remove();
          chartStore.set(null);
        } catch (e) {
          console.warn(`[Chart ${chartInstanceId}] Error cleaning up chart:`, e);
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

  :global(.chart-theme-plain-black) {
    --tv-color-platform-background: transparent;
    --tv-color-pane-background: transparent;
    --tv-color-toolbar-button-background-hover: #222222;
    --tv-color-toolbar-button-background-expanded: #333333;
    --tv-color-toolbar-button-background-active: #333333;
    --tv-color-toolbar-button-text: #CCCCCC;
    --tv-color-toolbar-button-text-hover: #FFFFFF;
    --tv-color-toolbar-divider-background: #222222;
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

  :global(.plain-black) {
    --tv-color-toolbar-button-background-hover: #222222;
    --tv-color-toolbar-button-background-active: #333333;
    --tv-color-toolbar-button-text: #CCCCCC;
    --tv-color-toolbar-button-text-hover: #FFFFFF;
  }

  :global(.light) {
    --tv-color-toolbar-button-background-hover: rgba(0, 0, 0, 0.1);
    --tv-color-toolbar-button-background-active: rgba(0, 0, 0, 0.2);
    --tv-color-toolbar-button-text: theme('colors.kong.text.primary');
    --tv-color-toolbar-button-text-hover: theme('colors.kong.text.primary');
  }
</style>
