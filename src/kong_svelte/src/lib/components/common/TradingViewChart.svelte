<script lang="ts">
import { onMount, onDestroy } from "svelte";
import { writable, get } from 'svelte/store';
import { KongDatafeed } from '$lib/services/tradingview/datafeed';
import { loadTradingViewLibrary } from '$lib/services/tradingview/widget';
import { fetchChartData, type CandleData } from "$lib/services/indexer/api";
import { poolStore } from "$lib/services/pools";
import { debounce } from 'lodash-es';
import type { FE } from "$lib/types";

// Props
export let poolId: number | undefined;
export let symbol: string;
export let fromToken: FE.Token;
export let toToken: FE.Token;

// Local state
let chartContainer: HTMLElement;
let candleData: CandleData[] = [];
let isLoadingChart = true;
let containerWidth: number;
let containerHeight: number;
let routingPath: string[] = [];
let selectedPoolId: number | undefined = undefined;
let updateTimeout: NodeJS.Timeout;
let previousFromToken: string | undefined;
let previousToToken: string | undefined;
let selectedPool: any = undefined;

// Create a store for the chart
const chartStore = writable<any>(null);

// Subscribe to store changes to update our local variable
let chart: any;
chartStore.subscribe(value => {
  chart = value;
});

// Watch for pool store changes
$: pools = $poolStore?.pools || [];

// Update selected pool when pools or selectedPoolId changes
$: {
  if (pools && selectedPoolId) {
    selectedPool = pools.find(p => Number(p.pool_id) === selectedPoolId);
  } else {
    selectedPool = undefined;
  }
}

// Combine the watchers into a single reactive statement
$: {
  const currentFromId = fromToken?.canister_id;
  const currentToId = toToken?.canister_id;
  const hasTokenChange = currentFromId !== previousFromToken || currentToId !== previousToToken;
  const hasPoolChange = poolId !== undefined && poolId !== selectedPoolId;

  if (hasTokenChange || hasPoolChange) {
    previousFromToken = currentFromId;
    previousToToken = currentToId;
    
    if (chart) {
      chart.remove();
      chartStore.set(null);
    }
    
    if ((fromToken && toToken) || poolId) {
      console.log('Triggering data fetch');
      debouncedFetchData();
    }
  }
}

onDestroy(() => {
  if (updateTimeout) {
    clearTimeout(updateTimeout);
  }
  if (chart) {
    try {
      chart.remove();
      chartStore.set(null);
    } catch (e) {
      console.warn('Error cleaning up chart:', e);
    }
  }
  debouncedFetchData.cancel();
});

// Handle resize
function handleResize() {
  if (chart) {
    chart.resize(containerWidth, containerHeight);
  }
}

const initChart = async () => {  
  if (!chartContainer || !fromToken?.token_id || !toToken?.token_id) {
    console.log('Missing required elements:', { 
      chartContainer, 
      fromTokenId: fromToken?.token_id, 
      toTokenId: toToken?.token_id 
    });
    isLoadingChart = false;
    return;
  }
  
  try {
    await loadTradingViewLibrary();
    
    const isMobile = window.innerWidth < 768;
    
    const widgetOptions = {
      symbol: symbol || `${fromToken.symbol}/${toToken.symbol}`,
      datafeed: new KongDatafeed(fromToken.token_id, toToken.token_id),
      interval: '240',
      container: chartContainer,
      library_path: '/charting_library/charting_library/',
      width: containerWidth,
      height: isMobile ? 300 : containerHeight,
      locale: 'en',
      fullscreen: false,
      autosize: true,
      theme: 'dark',
      timezone: 'Etc/UTC',
      debug: true,
      disabled_features: [
        'use_localstorage_for_settings',
        'study_templates',
        'header_saveload',
        'header_settings',
        'header_compare',
        'header_symbol_search',
        'header_screenshot',
        'timeframes_toolbar',
        'symbol_info',
        ...(isMobile ? [
          'left_toolbar',
          'volume_force_overlay',
          'create_volume_indicator_by_default'
        ] : [])
      ],
      enabled_features: [
        ...(isMobile ? [] : [
          'create_volume_indicator_by_default',
          'left_toolbar',
          'volume_force_overlay'
        ]),
        'show_chart_property_page',
        'support_multicharts',
        'legend_widget'
      ],
      custom_css_url: '/tradingview-chart.css',
      loading_screen: { 
        backgroundColor: "#131722",
        foregroundColor: "#2962FF"
      },
      overrides: {
        // Chart styling
        "mainSeriesProperties.candleStyle.upColor": "#22c55e",
        "mainSeriesProperties.candleStyle.downColor": "#ef4444",
        "mainSeriesProperties.candleStyle.borderUpColor": "#22c55e",
        "mainSeriesProperties.candleStyle.borderDownColor": "#ef4444",
        "mainSeriesProperties.candleStyle.wickUpColor": "#22c55e",
        "mainSeriesProperties.candleStyle.wickDownColor": "#ef4444",
        
        // Chart background
        "paneProperties.background": "rgba(0,0,0,0)",
        "paneProperties.backgroundType": "solid",
        "paneProperties.vertGridProperties.color": "rgba(30, 41, 59, 0.2)",
        "paneProperties.horzGridProperties.color": "rgba(30, 41, 59, 0.2)",
        
        // Chart area
        "chartProperties.background": "rgba(0,0,0,0)",
        "chartProperties.backgroundType": "solid",
        
        // Price scale formatting
        "mainSeriesProperties.priceFormat.precision": 4, // Limit to 4 decimal places
        "mainSeriesProperties.priceFormat.minMove": 0.0001, // Minimum price movement
        
        // Price axis
        "scalesProperties.backgroundColor": "rgba(0,0,0,0)",
        "scalesProperties.lineColor": "rgba(30, 41, 59, 0.2)",
        "scalesProperties.textColor": "#9ca3af",
        "scalesProperties.fontSize": isMobile ? 10 : 12,
        
        // Time axis
        "timeScale.backgroundColor": "rgba(0,0,0,0)",
        "timeScale.borderColor": "rgba(30, 41, 59, 0.2)",
        "timeScale.textColor": "#9ca3af",
        
        // Volume
        "volumePaneSize": "medium",
        ...(isMobile && {
          'paneProperties.legendProperties.showStudyArguments': false,
          'paneProperties.legendProperties.showStudyTitles': false,
          'scalesProperties.fontSize': 10,
          'timeScale.fontSize': 10,
          "mainSeriesProperties.priceFormat.precision": 3, // Even fewer decimals on mobile
          "mainSeriesProperties.priceFormat.minMove": 0.001
        })
      },
      studies_overrides: {
        "volume.volume.color.0": "#ef4444",
        "volume.volume.color.1": "#22c55e",
        "volume.volume.transparency": 50,
        "volume.volume ma.color": "#2962FF",
        "volume.volume ma.transparency": 30,
        "volume.volume ma.linewidth": 2,
        "volume.show ma": true,
        "volume.ma length": 20
      }
    };

    const widget = new window.TradingView.widget(widgetOptions);
    
    // Wait for widget to be ready
    widget.onChartReady(() => {
      chartStore.set(widget);
      isLoadingChart = false;
    });
  } catch (error) {
    console.error('Failed to initialize chart:', error);
    isLoadingChart = false;
  }
};

// Watch for container size changes
$: if (containerWidth && containerHeight) {
  handleResize();
}

onMount(() => {
  console.log('TradingViewChart mounted', { 
    hasContainer: !!chartContainer, 
    poolId, 
    fromToken, 
    toToken 
  });
  
  // Add resize observer
  const resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      containerWidth = entry.contentRect.width;
      containerHeight = entry.contentRect.height;
    }
  });

  if (chartContainer) {
    resizeObserver.observe(chartContainer);
  }

  // Add window resize listener as backup
  window.addEventListener('resize', handleResize);

  return () => {
    resizeObserver.disconnect();
    window.removeEventListener('resize', handleResize);
    if (chart) {
      try {
        chart.remove();
        chartStore.set(null);
      } catch (e) {
        console.warn('Error cleaning up chart:', e);
      }
    }
  };
});

// Get the best pool for the token pair
async function getBestPool() {
  // If no tokens provided, use the direct pool
  if (!fromToken || !toToken) {
    return selectedPoolId ? { pool_id: selectedPoolId } : null;
  }

  try {
    // Get direct pool from poolStore first
    const directPool = pools.find(p => 
      (p.address_0 === fromToken.canister_id && p.address_1 === toToken.canister_id) ||
      (p.address_1 === fromToken.canister_id && p.address_0 === toToken.canister_id)
    );

    if (directPool) {
      selectedPoolId = Number(directPool.pool_id);
      return { pool_id: selectedPoolId };
    }

    // If no direct pool, use the first pool that contains either token
    const relatedPool = pools.find(p => 
      p.address_0 === fromToken.canister_id || 
      p.address_1 === fromToken.canister_id ||
      p.address_0 === toToken.canister_id || 
      p.address_1 === toToken.canister_id
    );

    if (relatedPool) {
      selectedPoolId = Number(relatedPool.pool_id);
      return { pool_id: selectedPoolId };
    }
    
    selectedPoolId = undefined;
    return null;
  } catch (error) {
    console.error('Failed to get pool info:', error);
    selectedPoolId = undefined;
    return null;
  }
}

// Update the chart data fetching logic
const debouncedFetchData = debounce(async () => {
  isLoadingChart = true;
  try {
    console.log('Fetching data with tokens:', { fromToken, toToken, selectedPoolId });
    
    const bestPool = fromToken && toToken ? await getBestPool() : { pool_id: selectedPoolId };
    console.log('Best pool found:', bestPool);
    
    if (!bestPool?.pool_id) {
      console.log('No suitable pool found for chart');
      isLoadingChart = false;
      return;
    }

    selectedPoolId = bestPool.pool_id;
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - (2 * 365 * 24 * 60 * 60);
    
    // Get token IDs from the pool using token_id instead of id
    const payTokenId = fromToken?.token_id || 1;
    const receiveTokenId = toToken?.token_id || 10;
    
    console.log('Fetching chart data with params:', {
      payTokenId,
      receiveTokenId,
      startTime: new Date(startTime * 1000).toISOString(),
      endTime: new Date(now * 1000).toISOString()
    });
    
    candleData = await fetchChartData(
      payTokenId,
      receiveTokenId,
      startTime,
      now,
      '240'
    );
    
    console.log('Received candle data:', candleData);

    if (candleData.length > 0 && chartContainer && !chart) {
      console.log('Initializing chart with data');
      await initChart();
    } else {
      console.log('Not initializing chart because:', {
        hasCandleData: candleData.length > 0,
        hasContainer: !!chartContainer,
        hasExistingChart: !!chart
      });
      isLoadingChart = false;
    }
  } catch (error) {
    console.error('Failed to fetch chart data:', error);
    isLoadingChart = false;
  }
}, 300);
</script>

<div 
  class="relative w-full h-full !p-0"
  bind:this={chartContainer}
>
  {#if isLoadingChart}
    <div class="absolute inset-0 bg-[#14161A] flex items-center justify-center">
      <svg class="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>
  {:else if routingPath.length > 1}
    <div class="absolute top-0 left-0 p-2 bg-black bg-opacity-50 text-white text-sm rounded m-2">
      Note: Showing chart for {routingPath[0]} → {routingPath[1]} pool
    </div>
  {/if}

  <!-- LP Info Header -->
  {#if selectedPoolId && fromToken && toToken}
    <div class="absolute top-0 left-0 right-0 p-2 md:p-4 bg-black bg-opacity-50 text-white z-10">
      <!-- Mobile Header -->
      <div class="flex flex-col gap-2 md:hidden">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs">
              {fromToken.symbol[0]}
            </div>
            <div class="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs -ml-2">
              {toToken.symbol[0]}
            </div>
            <span class="font-bold text-sm">{fromToken.symbol}/{toToken.symbol}</span>
          </div>
          {#if selectedPool}
            <a 
              href={`/pool/${selectedPool.pool_id}`} 
              class="px-2 py-1 bg-blue-500 hover:bg-blue-600 rounded text-xs transition-colors"
            >
              View Pool
            </a>
          {/if}
        </div>
        {#if selectedPool}
          <div class="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span class="text-gray-400">TVL</span>
              <div class="font-medium">${selectedPool.tvl?.toLocaleString() || '0'}</div>
            </div>
            <div>
              <span class="text-gray-400">24h Vol</span>
              <div class="font-medium">${selectedPool.volume_24h}</div>
            </div>
            <div>
              <span class="text-gray-400">APR</span>
              <div class="font-medium">{selectedPool.apr || '0'}%</div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Desktop Header -->
      <div class="hidden md:flex justify-between items-center">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs">
              {fromToken.symbol[0]}
            </div>
            <div class="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs -ml-2">
              {toToken.symbol[0]}
            </div>
            <span class="font-bold">{fromToken.symbol}/{toToken.symbol}</span>
          </div>
          {#if selectedPool}
            <div class="flex gap-4 text-sm">
              <div>
                <span class="text-gray-400">TVL:</span>
                <span class="ml-1">${selectedPool.tvl?.toLocaleString() || '0'}</span>
              </div>
              <div>
                <span class="text-gray-400">24h Volume:</span>
                <span class="ml-1">${selectedPool.volume_24h}</span>
              </div>
              <div>
                <span class="text-gray-400">APR:</span>
                <span class="ml-1">{selectedPool.apr || '0'}%</span>
              </div>
            </div>
          {/if}
        </div>
        <div class="flex gap-2">
          {#if selectedPool}
            <a 
              href={`/pool/${selectedPool.pool_id}`} 
              class="px-3 py-1 bg-blue-500 hover:bg-blue-600 rounded text-sm transition-colors"
            >
              View Pool
            </a>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(.tv-lightweight-charts) {
    font-family: inherit !important;
  }

  /* Make chart container responsive */
  div {
    width: 100%;
    height: 100%;
    position: relative;
  }

  /* Ensure chart fills container */
  :global(.tradingview-widget-container),
  :global(.tradingview-widget-container > div) {
    width: 100% !important;
    height: 100% !important;
  }

  /* Mobile-specific styles */
  @media (max-width: 768px) {
    div {
      min-height: 300px !important;
    }

    :global(.tradingview-widget-container),
    :global(.tradingview-widget-container > div) {
      min-height: 300px !important;
    }

    /* Adjust chart elements for mobile */
    :global(.chart-page .chart-container) {
      height: calc(100% - 35px) !important;
    }

    :global(.chart-page .chart-container .pane) {
      height: calc(100% - 20px) !important;
    }

    /* Make toolbar buttons more touch-friendly */
    :global(.chart-page .group-wWM3zP_M-) {
      padding: 8px !important;
    }

    :global(.chart-page .button-1SxT0q7p-) {
      min-width: 32px !important;
      min-height: 32px !important;
    }
  }

  /* Ensure the chart container accounts for the header */
  .relative {
    padding-top: 80px; /* Increased for mobile header */
  }

  @media (min-width: 768px) {
    .relative {
      padding-top: 64px;
    }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style> 