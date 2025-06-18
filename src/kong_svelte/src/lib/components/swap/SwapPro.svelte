<script lang="ts">
  import Swap from "./Swap.svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import TradingViewChart from "$lib/components/common/TradingViewChart.svelte";
  import { onMount } from "svelte";
  import { livePools } from "$lib/stores/poolStore";
  import { swapState } from "$lib/stores/swapStateStore";
  import TransactionFeed from "$lib/components/stats/TransactionFeed.svelte";
  import TokenInfoEnhanced from "./TokenInfoEnhanced.svelte";

  export let initialFromToken: Kong.Token | null = null;
  export let initialToToken: Kong.Token | null = null;

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
    if (!fromToken?.address || !toToken?.address) return null;
    
    return (p.address_0 === fromToken.address && p.address_1 === toToken.address) ||
           (p.address_1 === fromToken.address && p.address_0 === toToken.address);
  });

  let baseToken: Kong.Token | null = null;
  let quoteToken: Kong.Token | null = null;
  $: {
    baseToken = selectedPool?.address_0 === fromToken?.address ? fromToken : toToken;
    quoteToken = selectedPool?.address_0 === toToken?.address ? fromToken : toToken;
  }

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
          onclick={() => activeTab = 'swap'}
        >
          Swap
        </button>
        <button 
          class="tab-button" 
          class:active={activeTab === 'chart'}
          onclick={() => activeTab = 'chart'}
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
              on:modeChange
              on:tokenChange={handleTokenChange}
            />
          </div>
          <div class="token-info-section">
            <TokenInfoEnhanced fromToken={fromToken} toToken={toToken} />
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
              on:modeChange
              on:tokenChange={handleTokenChange}
            />
          </div>
          
          <!-- Token Info section -->
          <div class="token-info-section">
            <TokenInfoEnhanced fromToken={fromToken} toToken={toToken} />
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
    @apply px-3;
    padding-top: 0;
    overflow: hidden;
  }

  .layout-container {
    height: 100%;
    width: 100%;
  }

  .main-content {
    display: flex;
    gap: 1rem;
    height: 100%;
    width: 100%;
  }

  .left-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    height: 100%;
    min-width: 0; /* Allow shrinking */
  }

  .chart-wrapper {
    display: flex;
    width: 100%;
    height: 100%;
    /* min-height: 400px; */
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
    width: 450px;
    min-width: 450px;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
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
      height: auto;
      padding: 0.5rem;
      overflow: visible;
    }

    :global(.chart-area) {
      flex: none;
      height: 400px !important;
      min-height: 300px;
      max-height: 400px;
      margin-bottom: 1rem;
    }

    :global(.transaction-feed) {
      flex: none;
      height: 300px !important;
      min-height: 200px;
      max-height: 300px;
      overflow-y: auto;
      border-top: 1px solid rgb(var(--border) / 0.8);
      padding-top: 1rem;
    }

    .chart-wrapper {
      height: 100%;
      min-height: 300px;
      margin-bottom: 0;
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
    padding: 0x;
    border-radius: 12px;
    margin-bottom: 0.5rem;
    border: 1px solid rgb(var(--border) / 0.8);
  }

  .tab-button {
    flex: 1;
    padding: 0.4rem;
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
