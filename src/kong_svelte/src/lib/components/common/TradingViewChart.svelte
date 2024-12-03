<script lang="ts">
import { onMount, onDestroy } from "svelte";
import { writable, get } from 'svelte/store';
import { KongDatafeed } from '$lib/services/tradingview/datafeed';
import { loadTradingViewLibrary } from '$lib/services/tradingview/widget';
import { fetchChartData, type CandleData } from "$lib/services/indexer/api";
import { SwapService } from "$lib/services/swap/SwapService";
import { poolStore } from "$lib/services/pools";
import { debounce } from 'lodash-es';

// Props
export let poolId: number | undefined;
export let symbol: string;
export let fromToken: Token | undefined = undefined;
export let toToken: Token | undefined = undefined;

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
  if (!chartContainer || !selectedPoolId) {
    console.log('Missing required elements:', { chartContainer, poolId: selectedPoolId });
    isLoadingChart = false;
    return;
  }
  
  try {
    await loadTradingViewLibrary();
    
    const widgetOptions = {
      symbol: symbol || `Pool ${selectedPoolId}`,
      datafeed: new KongDatafeed(selectedPoolId),
      interval: '60',
      container: chartContainer,
      library_path: '/charting_library/charting_library/',
      width: containerWidth,
      height: containerHeight,
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
        'legend_widget'
      ],
      enabled_features: [
        'create_volume_indicator_by_default',
        'left_toolbar',
        'show_chart_property_page',
        'volume_force_overlay',
        'support_multicharts',
        'drawing_templates'
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
        
        // Price axis
        "scalesProperties.backgroundColor": "rgba(0,0,0,0)",
        "scalesProperties.lineColor": "rgba(30, 41, 59, 0.2)",
        "scalesProperties.textColor": "#9ca3af",
        
        // Time axis
        "timeScale.backgroundColor": "rgba(0,0,0,0)",
        "timeScale.borderColor": "rgba(30, 41, 59, 0.2)",
        "timeScale.textColor": "#9ca3af",
        
        // Volume
        "volumePaneSize": "medium"
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

// Add debounced fetch
const debouncedFetchData = debounce(async () => {
  isLoadingChart = true;
  try {
    const bestPool = fromToken && toToken ? await getBestPool() : { pool_id: selectedPoolId };
    if (!bestPool?.pool_id) {
      console.log('No suitable pool found for chart');
      isLoadingChart = false;
      return;
    }

    selectedPoolId = bestPool.pool_id;
    const now = Math.floor(Date.now() / 1000) * 1000;
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    candleData = await fetchChartData(
      bestPool.pool_id,
      sevenDaysAgo,
      now,
      '60'
    );

    if (candleData.length > 0 && chartContainer && !chart) {
      await initChart();
    } else {
      isLoadingChart = false;
    }
  } catch (error) {
    console.error('Failed to fetch chart data:', error);
    isLoadingChart = false;
  }
}, 300);
</script>

<div 
  class="relative w-full h-full min-h-[400px]"
  bind:this={chartContainer}
>
  {#if isLoadingChart}
    <div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
      <div class="flex flex-col items-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
        <span class="text-white">Loading chart data...</span>
      </div>
    </div>
  {:else if routingPath.length > 1}
    <div class="absolute top-0 left-0 p-2 bg-black bg-opacity-50 text-white text-sm rounded m-2">
      Note: Showing chart for {routingPath[0]} → {routingPath[1]} pool
    </div>
  {/if}

  <!-- LP Info Header -->
  {#if selectedPoolId && fromToken && toToken}
    <div class="absolute top-0 left-0 right-0 p-4 bg-black bg-opacity-50 text-white z-10 flex justify-between items-center">
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
              <span class="ml-1">${selectedPool.volume_24h?.toLocaleString() || '0'}</span>
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
    min-height: 400px;
    position: relative;
  }

  /* Ensure chart fills container */
  :global(.tradingview-widget-container),
  :global(.tradingview-widget-container > div) {
    width: 100% !important;
    height: 100% !important;
  }

  /* Handle mobile styles */
  @media (max-width: 768px) {
    div {
      min-height: 300px;
    }
  }

  img {
    object-fit: cover;
  }
  
  .rounded-full {
    border-radius: 9999px;
  }
  
  /* Ensure the chart container accounts for the header */
  .relative {
    padding-top: 64px; /* Adjust based on header height */
  }
</style> 