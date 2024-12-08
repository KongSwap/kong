<script lang="ts">
  /// <reference path="../../../types/frontend.d.ts" />
  /// <reference path="../../../types/pools.d.ts" />

  import { onMount, onDestroy } from "svelte";
  import { writable, get } from "svelte/store";
  import { KongDatafeed } from "$lib/services/tradingview/datafeed";
  import { loadTradingViewLibrary } from "$lib/services/tradingview/widget";
  import { getChartConfig } from "$lib/services/tradingview/config";
  import { fetchChartData } from "$lib/services/indexer/api";
  import { poolStore } from "$lib/services/pools";
  import { debounce } from "lodash-es";

  // Props
  export let poolId: number | undefined;
  export let symbol: string;
  export let fromToken: FE.Token;
  export let toToken: FE.Token;

  // Local state
  let chartContainer: HTMLElement;
  let isLoading = true;
  let hasNoData = false;
  let selectedPoolId: number | undefined = undefined;
  let updateTimeout: NodeJS.Timeout;
  let routingPath: string[] = [];
  let previousFromTokenId: string | undefined;
  let previousToTokenId: string | undefined;
  let chartWrapper: HTMLElement;

  // Create a store for the chart
  const chartStore = writable<any>(null);

  // Subscribe to store changes to update our local variable
  let chart: any;
  chartStore.subscribe((value) => {
    chart = value;
  });

  // Watch for pool store changes and type the pools array
  $: pools = ($poolStore?.pools || []) as BE.Pool[];

  // Update selected pool and routing path when pools or selectedPoolId changes
  $: selectedPool = pools.find((p) => Number(p.pool_id) === selectedPoolId) as
    | BE.Pool
    | undefined;
  $: if (selectedPool) {
    routingPath = [selectedPool.symbol_0, selectedPool.symbol_1];
  }

  // Watch for token or pool changes and reinitialize chart
  $: {
    const currentFromId = fromToken?.canister_id;
    const currentToId = toToken?.canister_id;
    const hasTokenChange =
      currentFromId !== previousFromTokenId ||
      currentToId !== previousToTokenId;
    const hasPoolChange = poolId !== selectedPoolId;

    if (
      (hasTokenChange || hasPoolChange) &&
      ((fromToken && toToken) || poolId) &&
      (!chart || (chart && hasTokenChange))
    ) {
      previousFromTokenId = currentFromId;
      previousToTokenId = currentToId;

      if (chart) {
        chart.remove();
        chartStore.set(null);
      }
      debouncedFetchData();
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
        console.warn("Error cleaning up chart:", e);
      }
    }
    debouncedFetchData.cancel();
  });

  const initChart = async () => {
    if (!chartContainer || !fromToken?.token_id || !toToken?.token_id) {
      isLoading = false;
      return;
    }

    try {
      await loadTradingViewLibrary();

      const isMobile = window.innerWidth < 768;
      const datafeed = new KongDatafeed(fromToken.token_id, toToken.token_id);

      // Add a callback to handle no data state
      datafeed.onNoData = () => {
        hasNoData = true;
        isLoading = false;
      };

      const chartConfig = getChartConfig({
        symbol: symbol || `${fromToken.symbol}/${toToken.symbol}`,
        datafeed,
        container: chartContainer,
        isMobile,
        autosize: true,
        disabled_features: [
          "header_widget",
          "left_toolbar",
          "context_menus",
          "control_bar",
          "timeframes_toolbar",
        ],
        enabled_features: ["hide_left_toolbar_by_default"],
      });

      const widget = new window.TradingView.widget(chartConfig);

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
    if (!fromToken || !toToken) {
      return selectedPoolId ? { pool_id: selectedPoolId } : null;
    }

    try {
      const directPool = pools.find(
        (p) =>
          (p.address_0 === fromToken.canister_id &&
            p.address_1 === toToken.canister_id) ||
          (p.address_1 === fromToken.canister_id &&
            p.address_0 === toToken.canister_id),
      );

      if (directPool) {
        selectedPoolId = Number(directPool.pool_id);
        return { pool_id: selectedPoolId };
      }

      const relatedPool = pools.find(
        (p) =>
          p.address_0 === fromToken.canister_id ||
          p.address_1 === fromToken.canister_id ||
          p.address_0 === toToken.canister_id ||
          p.address_1 === toToken.canister_id,
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
        fromToken && toToken
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

      const payTokenId = fromToken?.token_id || 1;
      const receiveTokenId = toToken?.token_id || 10;

      const candleData = await fetchChartData(
        payTokenId,
        receiveTokenId,
        startTime,
        now,
        "240",
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

  onMount(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (chart) {
          chart.resize(width, height);
        }
      }
    });

    if (chartWrapper) {
      resizeObserver.observe(chartWrapper);
      // Initial data fetch when component mounts
      if ((fromToken && toToken) || poolId) {
        debouncedFetchData();
      }
    }

    return () => {
      resizeObserver.disconnect();
      if (chart) {
        try {
          chart.remove();
          chartStore.set(null);
        } catch (e) {
          console.warn("Error cleaning up chart:", e);
        }
      }
    };
  });
</script>

<div class="chart-wrapper" bind:this={chartWrapper}>
  <div
    class="chart-container relative w-full h-full !p-0"
    bind:this={chartContainer}
  >
    {#if hasNoData}
      <div
        class="absolute inset-0 bg-[#14161A] flex flex-col items-center justify-center p-4 text-center"
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
        class="absolute inset-0 bg-[#14161A] flex items-center justify-center"
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

<style lang="postcss">
  .chart-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 400px;
    background: var(--bg-card);
    border-radius: 12px;
    overflow: hidden;
  }

  .chart-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10;
  }

  .loading {
    color: white;
    font-size: 1.1em;
    padding: 1em;
    text-align: center;
  }

  .no-data-message {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--bg-card);
    padding: 1rem;
    text-align: center;
  }

  .error-message {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--bg-card);
    padding: 1rem;
    text-align: center;
  }

  :global(.tradingview-widget-container) {
    width: 100% !important;
    height: 100% !important;
  }

  :global(.tv-lightweight-charts) {
    width: 100% !important;
    height: 100% !important;
    font-family: inherit !important;
  }
</style>
