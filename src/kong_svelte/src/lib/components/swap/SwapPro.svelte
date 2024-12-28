<script lang="ts">
  import Swap from "./Swap.svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import TradingViewChart from "$lib/components/common/TradingViewChart.svelte";
  import { onMount } from "svelte";
  import { poolStore } from "$lib/services/pools";
  import { swapState } from "$lib/services/swap/SwapStateService";
  import TransactionFeed from "$lib/components/stats/TransactionFeed.svelte";

  export let initialFromToken: FE.Token | null = null;
  export let initialToToken: FE.Token | null = null;
  export let currentMode: "normal" | "pro" = "pro";

  let fromToken = initialFromToken;
  let toToken = initialToToken;
  let isChartMinimized = false;
  let isMobile: boolean;

  // Initialize tokens from swapState immediately when component loads
  $: {
    fromToken = $swapState.payToken || initialFromToken;
    toToken = $swapState.receiveToken || initialToToken;
  }

  // Watch for swapState changes
  $: {
    if ($swapState.payToken) fromToken = $swapState.payToken;
    if ($swapState.receiveToken) toToken = $swapState.receiveToken;
  }

  // Get the pool based on selected tokens
  $: selectedPool = $poolStore?.pools?.find(p => {
    if (!fromToken?.canister_id || !toToken?.canister_id) return null;
    
    return (p.address_0 === fromToken.canister_id && p.address_1 === toToken.canister_id) ||
           (p.address_1 === fromToken.canister_id && p.address_0 === toToken.canister_id);
  });

  let baseToken: FE.Token | null = null;
  let quoteToken: FE.Token | null = null;
  $: {
    baseToken = selectedPool?.address_0 === fromToken?.canister_id ? fromToken : toToken;
    quoteToken = selectedPool?.address_0 === toToken?.canister_id ? fromToken : toToken;
  }
  // Create the symbol from the pool tokens
  $: chartSymbol = baseToken && quoteToken ? `${quoteToken?.symbol}/${baseToken?.symbol}` : '';

  // Handle token selection changes
  function handleTokenChange(event: CustomEvent) {
    const { fromToken: newFromToken, toToken: newToToken } = event.detail;
    fromToken = newFromToken;
    toToken = newToToken;
  }

  // Initialize on mount
  onMount(() => {
    // Initialize tokens from swapState if available
    if ($swapState.payToken) fromToken = $swapState.payToken;
    if ($swapState.receiveToken) toToken = $swapState.receiveToken;

    const mediaQuery = window.matchMedia("(max-width: 768px)");
    isMobile = mediaQuery.matches;

    const handleResize = (e: MediaQueryListEvent) => {
      isMobile = e.matches;
    };

    mediaQuery.addEventListener("change", handleResize);

    return () => {
      mediaQuery.removeEventListener("change", handleResize);
    };
  });
</script>

<div class="swap-pro-container">
  <div class="layout-container">
    <div class="main-content" class:mobile={isMobile}>
      <!-- Chart Area -->
      <Panel
        variant="transparent"
        type="main"
        className={`chart-area !p-0 max-h-[30rem]`}
        width="100%"
      >
        <div
          class="chart-wrapper !p-0"
          class:minimized={isChartMinimized}
        >
          {#if baseToken && quoteToken}
            <TradingViewChart 
              poolId={selectedPool ? Number(selectedPool.pool_id) : undefined}
              quoteToken={quoteToken}
              baseToken={baseToken}
            />
          {:else}
            <div class="flex items-center justify-center h-full text-white">
              Select tokens to view chart
            </div>
          {/if}
        </div>
      </Panel>

      <!-- Right side panels -->
      <div class="right-panels" class:mobile={isMobile}>
        <div class="swap-section">
          <Swap
            initialFromToken={fromToken}
            initialToToken={toToken}
            {currentMode}
            on:modeChange
            on:tokenChange={handleTokenChange}
          />
        </div>

        <!-- Transaction History Section -->
        <TransactionFeed token={toToken} />
      </div>
    </div>
  </div>
</div>

<style lang="postcss">
  .swap-pro-container {
    width: 100%;
    max-width: 100%;
    display: flex;
    flex-direction: column;
    background: var(--color-background);
    position: relative;
    padding: 0 1rem;
    height: calc(100vh - 98px);
    overflow-y: auto; /* Allow container to scroll */
    -webkit-overflow-scrolling: touch; /* Smooth scrolling on iOS */
  }

  .layout-container {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .main-content {
    display: flex;
    gap: 0.5rem;
    flex: 1;
    min-height: 0;
  }

  .chart-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    transition: all 0.3s ease;
  }

  /* TODO will be different for pixel */
  .right-panels {
    display: flex;
    flex-direction: column;
    min-width: 500px;
    width: 500px;
    flex: 0 0 auto;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    gap: 0.25rem;
  }

  .swap-section {
    flex: 0 0 auto;
  }

  :global(#tradingview_chart),
  :global(.tradingview-widget-container) {
    width: 100% !important;
    height: 100% !important;
  }

  :global(.tradingview-widget-container > div) {
    width: 100% !important;
    height: 100% !important;
  }

  /* Mobile styles */
  .main-content.mobile {
    flex-direction: column;
    gap: 1rem;
    overflow-y: visible;
  }

  .right-panels.mobile {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    flex: 0 0 auto;
    overflow: visible;
  }

  .right-panels.mobile :global(.flex-1) {
    height: 1200px !important; /* Double the height on mobile */
  }

  .main-content.mobile :global(.chart-area) {
    height: 60vh;
    min-height: 300px;
    max-height: 500px;
  }

  @media (min-width: 1920px) {
    .right-panels {
      max-width: 600px;
    }
  }

  @media (max-width: 1200px) {
    .right-panels {
      width: 400px;
      flex: 0 0 400px;
    }
  }
</style>
