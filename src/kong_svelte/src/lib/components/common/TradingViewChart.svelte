<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { writable } from "svelte/store";
  import { KongDatafeed } from "$lib/config/tradingview/datafeed.config";
  import { loadTradingViewLibrary } from "$lib/config/tradingview/widget.config";
  import { getChartConfig } from "$lib/config/tradingview/chart.config";
  import { fetchChartData } from "$lib/api/transactions";
  import { livePools } from "$lib/stores/poolStore";
  import { debounce } from "lodash-es";
  import { themeStore } from "$lib/stores/themeStore";
  import { updateTradingViewPriceScale, findBestPoolForTokens } from "$lib/utils/statsUtils";
  import { applyTradingViewTheme, setTradingViewRootVars } from "$lib/config/tradingview/theme.utils";

  // Props
  const props = $props<{
    poolId?: number;
    symbol?: string;
    quoteToken: Kong.Token;
    baseToken: Kong.Token;
  }>();
  
  // DOM elements and chart state
  let chartContainer: HTMLElement;
  let chartWrapper: HTMLElement;
  const chartStore = writable<any>(null);
  let chart: any;
  chartStore.subscribe(value => chart = value);
  
  // Component state
  let state = $state({
    isLoading: true,
    hasNoData: false,
    isMounted: false,
    isFetchingData: false,
    isInitializingChart: false,
    isUpdatingChart: false,
    selectedPoolId: props.poolId,
    currentTheme: $themeStore,
    currentPrice: 0,
    previousTokenIds: {
      quote: undefined as string | undefined,
      base: undefined as string | undefined
    },
  });

  const pools = $derived($livePools || []) as BE.Pool[];
  const selectedPool = $derived(pools.find(p => Number(p.pool_id) === state.selectedPoolId));
  const routingPath = $derived(selectedPool ? [selectedPool.symbol_0, selectedPool.symbol_1] : []);
  
  // Error handler for TradingView errors
  const handleTradingViewError = (e: ErrorEvent) => {
    if (e.message?.includes('split is not a function')) {
      e.preventDefault();
      e.stopPropagation();
      return true;
    }
  };

  // Function to update TradingView CSS variables when theme changes
  const updateTradingViewTheme = () => applyTradingViewTheme(chart);
  
  $effect(() => {
    state.currentTheme = $themeStore;
    if (typeof document !== 'undefined') {
      // Update theme attributes for rest of app
      document.documentElement.setAttribute('data-theme', state.currentTheme);
      document.body.setAttribute('data-theme', state.currentTheme);

      // Update root vars immediately to avoid flash
      setTradingViewRootVars();
      
      // Update TradingView theme when our theme changes
      if (chart && chart._ready) {
        updateTradingViewTheme();
      }
    }
  });
  
  // Update price from selected pool
  $effect(() => {
    const pool = $livePools.find(p => p.pool_id === state.selectedPoolId);
    state.currentPrice = pool?.price || 0;
    
    // Also update chart price when current price changes
    if (chart?.datafeed && state.currentPrice) {
      chart.datafeed.updateCurrentPrice(state.currentPrice);
      pool?.price && updateTradingViewPriceScale(chart, pool);
    }
  });
  
  // More efficiently handle token/pool changes without full chart recreation
  $effect(() => {
    if (!state.isMounted) return;
    
    const currentQuoteId = props.quoteToken?.address;
    const currentBaseId = props.baseToken?.address;
    const hasTokenChange = 
      currentQuoteId !== state.previousTokenIds.quote || 
      currentBaseId !== state.previousTokenIds.base;
    const hasPoolChange = props.poolId !== state.selectedPoolId;

    if ((hasTokenChange || hasPoolChange) && 
        ((props.quoteToken && props.baseToken) || props.poolId)) {
      
      // Update state tracking
      state.previousTokenIds = { quote: currentQuoteId, base: currentBaseId };
      state.selectedPoolId = props.poolId;

      // Use in-place update if possible
      if (chart && chart._ready && !hasTokenChange) {
        // If only pool changed but tokens are the same, we can do a lightweight update
        state.isUpdatingChart = true;
        updateChartData();
      } else if (chart && hasTokenChange) {
        // If tokens changed, we need to recreate the chart
        chart.remove();
        chartStore.set(null);
        debouncedFetchData();
      } else {
        // Initial load
        debouncedFetchData();
      }
    }
  });

  // Get dimensions for chart
  const checkDimensions = () => 
    new Promise<{width: number, height: number}>((resolve) => {
      const check = () => {
        chartWrapper?.offsetHeight; // Force reflow
        const width = chartWrapper?.clientWidth;
        const height = chartWrapper?.clientHeight;
        
        width && height ? resolve({ width, height }) : requestAnimationFrame(check);
      };
      check();
    });

  // Update chart data without recreating the chart
  const updateChartData = async () => {
    if (!chart || !chart._ready) {
      debouncedFetchData();
      return;
    }
    
    try {
      state.isUpdatingChart = true;
      
      // Find best pool for the current tokens
      let poolId = state.selectedPoolId;
      
      // Update chart symbol if needed
      const newSymbol = props.symbol || `${props.baseToken.symbol}/${props.quoteToken.symbol}`;
      
      // Update price from the new pool
      const pool = $livePools.find(p => p.pool_id === poolId);
      if (pool?.price) {
        chart.datafeed.updateCurrentPrice(pool.price);
        updateTradingViewPriceScale(chart, pool);
      }
      
      // Mark loading as complete
      state.isLoading = false;
      state.hasNoData = false;
      state.isUpdatingChart = false;
    } catch (error) {
      console.error("[Chart] Failed to update chart data:", error);
      state.isUpdatingChart = false;
      state.isLoading = false;
    }
  };

  // Initialize chart
  const initChart = async () => {
    if (state.isInitializingChart || !chartContainer || 
        !props.quoteToken?.id || !props.baseToken?.id) {
      state.isLoading = false;
      state.isInitializingChart = false;
      return;
    }
    
    state.isInitializingChart = true;
    
    try {
      // Ensure colours are in place before loading library to prevent FOUC
      setTradingViewRootVars();

      const dimensions = await checkDimensions();      
      await loadTradingViewLibrary();
      
      // Get current price and configure chart
      const pool = $livePools.find(p => p.pool_id === state.selectedPoolId);
      const price = pool?.price || 1000;
      const quoteDecimals = props.quoteToken.decimals || 8;
      const baseDecimals = props.baseToken.decimals || 8;

      // Create datafeed
      const datafeed = new KongDatafeed(
        props.quoteToken.id, 
        props.baseToken.id,
        price, quoteDecimals, baseDecimals
      );

      // Add error handler and create widget
      window.removeEventListener('error', handleTradingViewError);
      window.addEventListener('error', handleTradingViewError, true);

      const widget = new window.TradingView.widget(getChartConfig({
        symbol: props.symbol || `${props.baseToken.symbol}/${props.quoteToken.symbol}`,
        datafeed,
        container: chartContainer,
        containerWidth: dimensions.width,
        containerHeight: dimensions.height,
        isMobile: window.innerWidth < 768,
        currentPrice: price,
        theme: state.currentTheme,
        quoteTokenDecimals: quoteDecimals,
        baseTokenDecimals: baseDecimals
      }));
      
      widget.datafeed = datafeed;

      widget.onChartReady(() => {
        widget._ready = true;
        chartStore.set(widget);
        state.isLoading = false;
        state.hasNoData = false;
        state.isInitializingChart = false;

        // Update price scale and theme immediately after chart is ready
        pool && updateTradingViewPriceScale(widget, pool);
        updateTradingViewTheme();
      });

      widget.onError = (err) => {
        state.isLoading = state.isInitializingChart = false;
      };
    } catch (error) {
      console.error("[Chart Debug] Failed to initialize:", error);
      state.isLoading = state.isInitializingChart = false;
    }
  };

  // Fetch chart data
  const debouncedFetchData = debounce(async () => {
    if (state.isFetchingData) return;
    state.isFetchingData = true;
    try {
      state.isLoading = true;
      state.hasNoData = false;

      // Make sure we have pools data before trying to find the best pool
      if (pools.length === 0) {
        // Wait briefly for pools to load if they're empty
        if ($livePools.length === 0) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      // Get best pool
      let bestPool: { pool_id: number } | null = null;
      
      if (props.quoteToken && props.baseToken) {
        bestPool = findBestPoolForTokens(
          props.quoteToken, 
          props.baseToken, 
          pools, 
          state.selectedPoolId
        );
        
        if (bestPool?.pool_id) {
          state.selectedPoolId = bestPool.pool_id;
        }
      } else if (state.selectedPoolId) {
        bestPool = { pool_id: state.selectedPoolId };
      }

      if (!bestPool?.pool_id) {
        console.warn("[Chart] No valid pool found for tokens", {
          quoteToken: props.quoteToken?.id,
          baseToken: props.baseToken?.id,
          availablePools: pools.length
        });
        state.hasNoData = true;
        state.isLoading = false;
        state.isFetchingData = false;
        return;
      }

      // Fetch candle data
      state.selectedPoolId = bestPool.pool_id;
      const now = Math.floor(Date.now() / 1000);
      const startTime = now - 90 * 24 * 60 * 60; // 90 days
      
      // Ensure we have valid numeric IDs before fetching
      const quoteTokenNumericId = props.quoteToken?.id;
      const baseTokenNumericId = props.baseToken?.id;

      if (typeof quoteTokenNumericId !== 'number' || typeof baseTokenNumericId !== 'number') {
        state.hasNoData = true;
        state.isLoading = false;
        state.isFetchingData = false;
        return; // Prevent API call with invalid IDs
      }
      
      const candleData = await fetchChartData(
        quoteTokenNumericId, // Pass numeric ID
        baseTokenNumericId,  // Pass numeric ID
        startTime, now, "60" // 1 hour candles
      );

      // Handle no data case
      if (!candleData || candleData.length === 0) {
        console.warn("[Chart] No candle data returned for pool", bestPool.pool_id);
        state.hasNoData = true;
        if (chart?.remove) {
          chart.remove();
          chartStore.set(null);
        }
      } else {
        state.hasNoData = false;
        if (!chart) {
          await initChart();
        } else if (chart && chart._ready && !state.isUpdatingChart) {
          // If chart exists but we fetched new data, update it in place
          updateChartData();
        }
      }
    } catch (error) {
      console.error("[Chart Debug] Failed to fetch data:", error);
      state.hasNoData = true;
      if (chart?.remove) {
        chart.remove();
        chartStore.set(null);
      }
    } finally {
      state.isLoading = false;
      state.isFetchingData = false;
    }
  }, 300);

  // Lifecycle hooks
  onMount(() => {
    state.isMounted = true;
    
    let themeObserver: MutationObserver | undefined;
    
    // Set up a MutationObserver to watch for theme changes on the document element
    if (typeof window !== 'undefined') {
      themeObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && 
              (mutation.attributeName === 'data-theme' || 
               mutation.attributeName === 'class')) {
            // Theme changed externally, update chart theme
            if (chart && chart._ready) {
              updateTradingViewTheme();
            }
          }
        });
      });
      
      // Start observing the document element for attribute changes
      themeObserver.observe(document.documentElement, { 
        attributes: true, 
        attributeFilter: ['data-theme', 'class'] 
      });
    }
    
    // Initialize the chart with data
    const initializeChart = async () => {
      // await ensurePoolsLoaded();
      
      if ((props.quoteToken && props.baseToken) || props.poolId) {
        state.selectedPoolId = props.poolId;
        debouncedFetchData();
      }
    };
    
    // Call initialization
    initializeChart();
    
    // Cleanup function
    return () => {
      if (themeObserver) {
        themeObserver.disconnect();
      }
    };
  });

  onDestroy(() => {
    if (!chart) return;
    
    try {
      window.removeEventListener('error', handleTradingViewError);
      
      if (chart._ready && chart.chart) {
        try {
          const chartObj = chart.chart();
          if (chartObj?.clearUndoHistory) {
            chartObj.clearUndoHistory();
          }
          
          setTimeout(() => {
            try { 
              chart.remove(); 
            } catch (e) { 
              console.warn("[Chart] Error during removal:", e); 
            } finally { 
              chartStore.set(null); 
            }
          }, 10);
        } catch (e) {
          chart.remove();
          chartStore.set(null);
        }
      } else {
        chart.remove();
        chartStore.set(null);
      }
    } catch (e) {
      console.warn("[Chart] Error during cleanup:", e);
      chartStore.set(null);
    }
    
    debouncedFetchData.cancel();
  });
</script>

<div class="chart-wrapper-inside h-full" bind:this={chartWrapper}>
  <div class="chart-container h-full w-full relative" bind:this={chartContainer}>
    {#if state.hasNoData}
      <div class="absolute inset-0 bg-transparent flex flex-col items-center justify-center p-4 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-12 w-12 mb-3 text-kong-text-secondary"
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
        <p class="text-lg font-medium text-kong-text-secondary">
          No Trading Data Available
        </p>
        <p class="text-sm text-kong-text-disabled mt-1">
          This trading pair hasn't had any trading activity yet.
        </p>
      </div>
    {:else if state.isLoading}
      <div class="absolute inset-0 bg-transparent flex items-center justify-center">
        <svg
          class="animate-spin h-8 w-8 text-kong-primary"
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
      <div class="absolute top-0 left-0 p-2 bg-kong-bg-primary bg-opacity-50 text-kong-text-primary text-sm rounded m-2">
        Note: Showing chart for {routingPath[0]} → {routingPath[1]} pool
      </div>
    {/if}
  </div>
</div>

<style scoped lang="postcss">
  .chart-wrapper-inside {
    position: relative;
    display: flex;
    width: 100%;
    height: 500px;
    background: var(--bg-dark);
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

  /* Update loading and no-data states to use theme colors */
  .chart-wrapper-inside :global(.loading-indicator) {
    @apply text-kong-text-primary;
  }

  .chart-wrapper-inside :global(.no-data-message) {
    @apply text-kong-text-secondary;
  }
</style>
