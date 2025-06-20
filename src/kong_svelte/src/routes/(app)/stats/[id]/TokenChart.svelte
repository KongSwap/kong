<script lang="ts">
  import { browser } from "$app/environment";
  import TradingViewChart from "$lib/components/common/TradingViewChart.svelte";
  import { tokenData } from "$lib/stores/tokenData";

  const {
    token,
    selectedPool,
    isChartDataReady,
    chartInstance,
    height = "100%",
  } = $props<{
    token: Kong.Token | undefined;
    selectedPool: BE.Pool | undefined;
    isChartDataReady: boolean;
    chartInstance: number;
    height?: string;
  }>();

  let chartContainer: HTMLDivElement;
  let prevHeight = height;

  // Helper function for chart symbol display
  function getChartSymbol() {
    if (!token || !selectedPool) return "";

    const quoteSymbol =
      selectedPool.address_0 === token.address
        ? selectedPool.token1?.symbol ||
          selectedPool.symbol_1 ||
          $tokenData?.find((t) => t.address === selectedPool.address_1)
            ?.symbol ||
          "Unknown"
        : selectedPool.token0?.symbol ||
          selectedPool.symbol_0 ||
          $tokenData?.find((t) => t.address === selectedPool.address_0)
            ?.symbol ||
          "Unknown";

    return `${token.symbol}/${quoteSymbol}`;
  }

  // Helper function for quote token in chart
  function getQuoteToken() {
    if (!selectedPool) return undefined;

    if (selectedPool.address_0 === token?.address) {
      return (
        selectedPool.token1 ||
        $tokenData?.find((t) => t.address === selectedPool.address_1)
      );
    } else {
      return (
        selectedPool.token0 ||
        $tokenData?.find((t) => t.address === selectedPool.address_0)
      );
    }
  }

  // Check if height changed and trigger resize
  $effect(() => {
    if (!browser) return;
    if (prevHeight !== height) {
      prevHeight = height;
      // Force re-render of chart when height changes
      setTimeout(() => {
        if (chartContainer) {
          // Update the DOM first
          chartContainer.style.height = height;

          // Then notify TradingView to resize if it exists
          const tvContainer = chartContainer.querySelector(
            ".tv-chart-container",
          );
          if (tvContainer && window.dispatchEvent) {
            window.dispatchEvent(new Event("resize"));
          }
        }
      }, 100);
    }
  });

  // Make sure our container reacts properly to size changes
  $effect(() => {
    if (chartContainer) {
      chartContainer.style.height = height;
    }
  });
</script>

<div
  class="chart-container"
  style="height: {height}"
  bind:this={chartContainer}
>
  {#if isChartDataReady}
    {@const currentBaseToken = token}
    {@const currentQuoteToken = getQuoteToken()}
    {#if currentBaseToken && currentQuoteToken}
      <div class="h-full w-full">
        {#key chartInstance}
          <TradingViewChart
            poolId={selectedPool ? Number(selectedPool.pool_id) : 0}
            symbol={getChartSymbol()}
            quoteToken={currentQuoteToken}
            baseToken={currentBaseToken}
          />
        {/key}
      </div>
    {:else}
      <div class="flex items-center justify-center h-full">
        <div class="loader"></div>
        <div class="ml-3 text-kong-text-secondary">
          Loading token data for chart...
        </div>
      </div>
    {/if}
  {:else}
    <div class="flex items-center justify-center h-full">
      <div class="loader"></div>
    </div>
  {/if}
</div>

<style scoped lang="postcss">
  .chart-container {
    width: 100%;
    position: relative;
    overflow: hidden;
    min-height: 300px;
  }

  .loader {
    border: 4px solid rgba(255, 255, 255, 0.2);
    border-top: 4px solid #ffffff;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
