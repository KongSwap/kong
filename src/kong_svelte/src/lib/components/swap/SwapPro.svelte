<script lang="ts">
  import Swap from "./Swap.svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import TradingViewChart from "$lib/components/common/TradingViewChart.svelte";
  import { onMount } from "svelte";
  import { livePools } from "$lib/services/pools/poolStore";
  import { swapState } from "$lib/services/swap/SwapStateService";
  import TransactionFeed from "$lib/components/stats/TransactionFeed.svelte";
  import TokenInfo from "./TokenInfo.svelte";

  export let initialFromToken: FE.Token | null = null;
  export let initialToToken: FE.Token | null = null;
  export let currentMode: "normal" | "pro" = "pro";

  let fromToken = initialFromToken;
  let toToken = initialToToken;
  let isChartMinimized = false;
  let isMobile: boolean;

  // Add new state for mobile tabs
  let activeTab: 'swap' | 'chart' = 'swap';

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
  $: selectedPool = $livePools?.find(p => {
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
    {#if isMobile}
      <!-- Mobile Tab Navigation -->
      <div class="mobile-tabs">
        <button 
          class="tab-button" 
          class:active={activeTab === 'swap'}
          on:click={() => activeTab = 'swap'}
        >
          Swap
        </button>
        <button 
          class="tab-button" 
          class:active={activeTab === 'chart'}
          on:click={() => activeTab = 'chart'}
        >
          Chart
        </button>
      </div>

      <!-- Mobile Tab Content -->
      {#if activeTab === 'chart'}
        <div class="mobile-chart-section">
          <Panel
            variant="transparent"
            type="main"
            className="chart-area !p-0"
            width="100%"
          >
            <div class="chart-wrapper !p-0" class:minimized={isChartMinimized}>
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
          <TransactionFeed token={toToken} className="transaction-feed !p-0" />
        </div>
      {:else}
        <div class="mobile-swap-section">
          <div class="swap-section">
            <Swap
              initialFromToken={fromToken}
              initialToToken={toToken}
              {currentMode}
              on:modeChange
              on:tokenChange={handleTokenChange}
            />
          </div>
          <div class="token-info-section">
            <TokenInfo token={toToken} />
          </div>
        </div>
      {/if}
    {:else}
      <!-- Existing desktop layout -->
      <div class="main-content">
        <div class="left-section">
          <!-- Chart Area -->
          <Panel
            variant="transparent"
            type="main"
            className="chart-area !p-0"
            width="100%"
          >
            <div class="chart-wrapper !p-0" class:minimized={isChartMinimized}>
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

          <!-- Transaction Feed -->
          <TransactionFeed token={toToken} className="transaction-feed !p-0" />
        </div>

        <div class="right-section">
          <!-- Swap interface -->
          <div class="swap-section">
            <Swap
              initialFromToken={fromToken}
              initialToToken={toToken}
              {currentMode}
              on:modeChange
              on:tokenChange={handleTokenChange}
            />
          </div>
          
          <!-- Token Info section -->
          <div class="token-info-section">
            <TokenInfo token={toToken} />
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style lang="postcss">
  .swap-pro-container {
    width: 100%;
    height: 100%;
    background: var(--color-background);
    position: relative;
    @apply px-4;
    padding-top: 0;
    margin-top: -1rem;
    overflow: hidden;
  }

  .layout-container {
    height: 100%;
    width: 100%;
  }

  .main-content {
    display: flex;
    gap: 1.5rem;
    height: 100%;
    width: 100%;
  }

  .left-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: 100%;
    min-width: 0; /* Allow shrinking */
  }

  .chart-wrapper {
    width: 100%;
    height: 100%;
    min-height: 400px;
  }

  :global(.chart-area) {
    flex: 2;
    min-height: 300px;
  }

  :global(.transaction-feed) {
    flex: 1;
    min-height: 200px;
  }

  .right-section {
    width: 500px;
    min-width: 500px;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow-y: auto;
  }

  .swap-section {
    flex-shrink: 0;
  }

  .token-info-section {
    flex-shrink: 0;
  }

  /* Mobile styles */
  @media (max-width: 768px) {
    .swap-pro-container {
      padding: 0.5rem;
      padding-top: 0;
      height: 100%;
      overflow: auto;
    }

    .main-content {
      flex-direction: column;
      gap: 1rem;
      height: auto;
    }

    .left-section {
      gap: 1rem;
    }

    :global(.chart-area) {
      height: 60vh !important;
      min-height: 300px;
      max-height: 450px;
    }

    :global(.transaction-feed) {
      height: calc(40vh - 120px) !important;
      min-height: 200px;
      max-height: 300px;
    }

    .right-section {
      width: 100%;
      min-width: 0;
      height: auto;
      overflow: visible;
    }

    .mobile-chart-section {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      height: calc(100vh - 120px);
    }

    :global(.chart-area) {
      flex: 1;
      height: 60vh !important;
      min-height: 300px;
      max-height: 450px;
    }

    .chart-wrapper {
      height: 100%;
      min-height: 300px;
    }
  }

  /* Desktop adjustments */
  @media (min-width: 1920px) {
    .right-section {
      width: 600px;
      min-width: 600px;
    }
  }

  @media (max-width: 1200px) and (min-width: 769px) {
    .right-section {
      width: 400px;
      min-width: 400px;
    }
  }

  /* Height-based responsive adjustments */
  @media (max-height: 800px) {
    .swap-pro-container {
      padding: 1rem;
      padding-top: 0;
    }

    .main-content {
      gap: 1rem;
    }

    :global(.chart-area) {
      min-height: 250px;
    }

    :global(.transaction-feed) {
      min-height: 150px;
    }
  }

  /* Very short screens */
  @media (max-height: 600px) {
    :global(.chart-area) {
      min-height: 200px;
    }

    :global(.transaction-feed) {
      min-height: 120px;
    }
  }

  /* Update mobile tab styles */
  .mobile-tabs {
    display: flex;
    gap: 2px;
    background: rgb(var(--bg-light) / 0.5);
    padding: 3px;
    border-radius: 12px;
    margin-bottom: 0.5rem;
    border: 1px solid rgb(var(--border) / 0.8);
  }

  .tab-button {
    flex: 1;
    padding: 0.625rem;
    text-align: center;
    background: rgb(var(--bg-dark));
    color: rgb(var(--text-secondary));
    border: none;
    border-radius: 10px;
    transition: all 0.2s ease;
    font-size: 0.9375rem;
    font-weight: 500;
    opacity: 0.9;
  }

  .tab-button:hover {
    background: rgb(var(--bg-light));
    color: rgb(var(--text-primary));
    opacity: 1;
  }

  .tab-button.active {
    background: rgb(var(--primary));
    color: rgb(var(--text-primary));
    font-weight: 600;
    opacity: 1;
    box-shadow: 0 2px 8px rgb(var(--primary) / 0.3);
    transform: scale(1.02);
  }

  .mobile-chart-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 00px;
  }

  .mobile-swap-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
