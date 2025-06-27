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
  import { panelRoundness } from "$lib/stores/derivedThemeStore";

  // Props
  const { poolId, symbol, quoteToken, baseToken, className } = $props<{
    poolId?: number;
    symbol?: string;
    quoteToken: Kong.Token;
    baseToken: Kong.Token;
    className?: string;
  }>();
  
  // DOM elements and chart state
  let chartContainer: HTMLElement;
  let chartWrapper: HTMLElement;
  const chartStore = writable<any>(null);
  let chart: any;
  chartStore.subscribe(value => chart = value);
  
  // Component state 
  // @ts-ignore
  let state = $state({
    isLoading: true,
    hasNoData: false,
    isMounted: false,
    isProcessing: false, // Combined fetching/initializing/updating flags
    currentTheme: $themeStore,
    currentPrice: 0,
  });

  // Track previous values for change detection
  let previousState = $state({
    poolId: undefined as number | undefined,
    quoteAddress: undefined as string | undefined,
    baseAddress: undefined as string | undefined,
  });

  // Derived values (after state declarations)
  const pools = $derived($livePools || []) as BE.Pool[];
  const selectedPool = $derived(pools.find(p => Number(p.pool_id) === poolId));
  const routingPath = $derived(selectedPool ? [selectedPool.symbol_0, selectedPool.symbol_1] : []);
  
  // Detect meaningful changes that require chart updates
  const shouldUpdateChart = $derived(() => {
    const currentPoolId = poolId;
    const currentQuoteAddress = quoteToken?.address;
    const currentBaseAddress = baseToken?.address;
    
    return state.isMounted && (
      currentPoolId !== previousState.poolId ||
      currentQuoteAddress !== previousState.quoteAddress ||
      currentBaseAddress !== previousState.baseAddress
    ) && (currentPoolId || (quoteToken && baseToken));
  });

  // Determine if we need full chart recreation vs update
  const needsChartRecreation = $derived(() => {
    return quoteToken?.address !== previousState.quoteAddress || 
           baseToken?.address !== previousState.baseAddress;
  });

  // Error handler for TradingView errors
  const handleTradingViewError = (e: ErrorEvent) => {
    if (e.message?.includes('split is not a function')) {
      e.preventDefault();
      e.stopPropagation();
      return true;
    }
  };
  
  // Effects
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
        applyTradingViewTheme(chart);
      }
    }
  });

  // Update price from selected pool
  $effect(() => {
    const pool = $livePools.find(p => p.pool_id === poolId);
    state.currentPrice = pool?.price || 0;
    
    // Also update chart price when current price changes
    if (chart?.datafeed && state.currentPrice) {
      chart.datafeed.updateCurrentPrice(state.currentPrice);
      pool?.price && updateTradingViewPriceScale(chart, pool);
    }
  });

    // Handle chart updates when tokens/pool change
  $effect(() => {
    if (!shouldUpdateChart) return;
    
    // Update tracking state first to prevent re-triggering
    previousState.poolId = poolId;
    previousState.quoteAddress = quoteToken?.address;
    previousState.baseAddress = baseToken?.address;

    if (needsChartRecreation && chart) {
      chart.remove();
      chartStore.set(null);
    }
    
    fetchAndUpdateChart();
  });

  // Streamlined fetch and update logic
  const fetchAndUpdateChart = debounce(async () => {
    if (state.isProcessing || !state.isMounted) return;
    
    state.isProcessing = true;
    state.isLoading = true;

    try {
      // Early exit if no valid pool/tokens
      if (!poolId || !quoteToken?.id || !baseToken?.id) {
        state.hasNoData = true;
        return;
      }

      // Fetch chart data
      const now = Math.floor(Date.now() / 1000);
      const candleData = await fetchChartData(
        quoteToken.id, baseToken.id, 
        now - 90 * 24 * 60 * 60, now, "60"
      );

      if (!candleData?.length) {
        state.hasNoData = true;
        chart?.remove();
        chartStore.set(null);
        return;
      }

      state.hasNoData = false;
      
      // Initialize or update chart
      if (!chart || needsChartRecreation) {
        await initChart();
      } else if (chart._ready) {
        updateChartData();
      }
      
    } catch (error) {
      console.error("[Chart] Update failed:", error);
      state.hasNoData = true;
      chart?.remove();
      chartStore.set(null);
    } finally {
      state.isLoading = false;
      state.isProcessing = false;
    }
  }, 300);

  // Update chart data without recreating the chart
  const updateChartData = async () => {
    if (!chart?._ready) return;
    
    const pool = $livePools.find(p => p.pool_id === poolId);
    if (pool?.price) {
      chart.datafeed.updateCurrentPrice(pool.price);
      updateTradingViewPriceScale(chart, pool);
    }
  };

  // Initialize chart
  const initChart = async () => {
    if (!chartContainer || !quoteToken?.id || !baseToken?.id) {
      console.warn("[Chart] Missing required data:", { chartContainer: !!chartContainer, quoteTokenId: quoteToken?.id, baseTokenId: baseToken?.id });
      return;
    }
    
    // Check if the container is visible before initializing
    if (chartContainer.offsetParent === null) {
      console.log("[Chart] Container not visible, deferring initialization");
      // Try again after a delay
      setTimeout(() => {
        if (state.isMounted && !chart) {
          fetchAndUpdateChart();
        }
      }, 500);
      return;
    }
    
    try {
      console.log("[Chart] Starting initialization with:", { 
        quoteToken: quoteToken.symbol, 
        baseToken: baseToken.symbol, 
        poolId 
      });
      
      setTradingViewRootVars();
      
      // Load library first before checking dimensions
      try {
        await loadTradingViewLibrary();
        console.log("[Chart] TradingView library loaded, window.TradingView:", !!window.TradingView);
      } catch (libError) {
        console.error("[Chart] Failed to load TradingView library:", libError);
        throw libError;
      }
      
      let dimensions;
      try {
        dimensions = await checkDimensions();
        console.log("[Chart] Container dimensions:", dimensions);
      } catch (dimError) {
        console.error("[Chart] Failed to get dimensions:", dimError);
        // Use fallback dimensions
        dimensions = { width: 800, height: 600 };
      }
      
      const pool = $livePools.find(p => p.pool_id === poolId);
      const price = pool?.price || 1000;
      console.log("[Chart] Pool data:", { poolId, price, poolFound: !!pool });
      
      const datafeed = new KongDatafeed(
        quoteToken.id, baseToken.id, price, 
        quoteToken.decimals || 8, baseToken.decimals || 8
      );

      window.removeEventListener('error', handleTradingViewError);
      window.addEventListener('error', handleTradingViewError, true);

      const config = getChartConfig({
        symbol: symbol || `${baseToken.symbol}/${quoteToken.symbol}`,
        datafeed, container: chartContainer,
        containerWidth: dimensions.width, containerHeight: dimensions.height,
        isMobile: window.innerWidth < 768, currentPrice: price,
        theme: state.currentTheme,
        quoteTokenDecimals: quoteToken.decimals || 8,
        baseTokenDecimals: baseToken.decimals || 8
      });
      console.log("[Chart] Widget config:", config);

      const widget = new window.TradingView.widget(config);
      
      widget.datafeed = datafeed;

      widget.onChartReady(() => {
        console.log("[Chart] Chart ready!");
        widget._ready = true;
        chartStore.set(widget);
        pool && updateTradingViewPriceScale(widget, pool);
        applyTradingViewTheme(widget);
      });

    } catch (error) {
      console.error("[Chart] Initialization failed:", error);
      console.error("[Chart] Error stack:", error.stack);
    }
  };

  // Get dimensions for chart
  const checkDimensions = () => 
    new Promise<{width: number, height: number}>((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 20; // Reduced from 50 to 20 attempts
      
      const check = () => {
        attempts++;
        
        if (!chartWrapper) {
          console.error("[Chart] chartWrapper is null");
          reject(new Error("Chart wrapper not found"));
          return;
        }
        
        // Check if element is visible
        const isVisible = chartWrapper.offsetParent !== null;
        if (!isVisible && attempts < 5) {
          // If not visible yet, wait longer between checks
          setTimeout(check, 100);
          return;
        }
        
        chartWrapper?.offsetHeight; // Force reflow
        const width = chartWrapper?.clientWidth;
        const height = chartWrapper?.clientHeight;
        
        // Only log every 5th attempt to reduce console spam
        if (attempts % 5 === 0 || (width && height)) {
          console.log(`[Chart] Dimension check attempt ${attempts}:`, { width, height, isVisible });
        }
        
        if (width && height && width > 0 && height > 0) {
          resolve({ width, height });
        } else if (attempts >= maxAttempts) {
          console.warn("[Chart] Using fallback dimensions after", maxAttempts, "attempts");
          // Use parent container dimensions as fallback
          const parentWidth = chartWrapper.parentElement?.clientWidth || 800;
          const parentHeight = chartWrapper.parentElement?.clientHeight || 600;
          resolve({ width: parentWidth, height: Math.max(400, parentHeight) });
        } else {
          // Use setTimeout for first few attempts, then RAF
          if (attempts < 5) {
            setTimeout(check, 50);
          } else {
            requestAnimationFrame(check);
          }
        }
      };
      check();
    });

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
              applyTradingViewTheme(chart);
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
    if ((quoteToken && baseToken) || poolId) {
      fetchAndUpdateChart();
    }
    
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
      });
</script>

<div class="panel !{$panelRoundness} {className}">
  <div class="flex h-full" bind:this={chartWrapper}>
    <div class="flex h-full w-full relative" bind:this={chartContainer}>
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
</div>

<style scoped lang="postcss">
  .panel {
    @apply relative text-kong-text-primary flex flex-col;
    @apply bg-kong-bg-secondary backdrop-blur-md;
    @apply border border-kong-border/50;
    height: 100%;
  }

  /* Update loading and no-data states to use theme colors */
  .chart-wrapper-inside :global(.loading-indicator) {
    @apply text-kong-text-primary;
  }

  .chart-wrapper-inside :global(.no-data-message) {
    @apply text-kong-text-secondary;
  }
</style>
