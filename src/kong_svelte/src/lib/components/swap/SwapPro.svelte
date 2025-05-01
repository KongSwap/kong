<script lang="ts">
  import Swap from "./Swap.svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import TradingViewChart from "$lib/components/common/TradingViewChart.svelte";
  import { onMount } from "svelte";
  import { livePools } from "$lib/stores/poolStore";
  import { swapState } from "$lib/services/swap/SwapStateService";
  import TransactionFeed from "$lib/components/stats/TransactionFeed.svelte";
  import TokenInfo from "./TokenInfo.svelte";

  export let initialFromToken: Kong.Token | null = null;
  export let initialToToken: Kong.Token | null = null;
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
    if (initialFromToken) $swapState.payToken = initialFromToken;
    if (initialToToken) $swapState.receiveToken = initialToToken;

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
    height: 85vh;
    background: var(--color-background);
    position: relative;
    @apply px-4;
    padding-top: 0.5rem;
    overflow: hidden;
  }

  .layout-container {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
  }

  .main-content {
    display: flex;
    gap: 1.5rem;
    height: 100%;
    width: 100%;
    overflow: hidden;
  }

  .left-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: 100%;
    min-width: 0; /* Allow shrinking */
    overflow: hidden;
  }

  .chart-wrapper {
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  :global(.chart-area) {
    flex: 2;
    min-height: 0;
    overflow: hidden;
  }

  :global(.transaction-feed) {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .right-section {
    width: 450px;
    min-width: 450px;
    max-width: 450px;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    overflow: hidden;
    padding-right: 0;
  }

  .swap-section {
    flex-shrink: 0;
    width: 100%;
  }

  .token-info-section {
    flex: 1;
    overflow: hidden;
    margin-top: 0;
    width: 100%;
  }

  /* Fix for swap button and panels */
  :global(.right-section .swap-button) {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 auto !important;
  }

  :global(.right-section .swap-panel) {
    width: 100% !important;
    max-width: 100% !important;
  }
  
  /* Override for direction change button */
  :global(.right-section .direction-button),
  :global(.right-section .swap-direction-button) {
    width: auto !important;
    min-width: auto !important;
    max-width: fit-content !important;
  }
  
  /* Fix for circular buttons */
  :global(.right-section button.icon-button),
  :global(.right-section button.circular-button),
  :global(.right-section button.round-button) {
    width: auto !important;
    min-width: auto !important;
    max-width: fit-content !important;
  }
  
  :global(.token-info-panel) {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 1rem !important;
  }
  
  :global(.token-info-panel .token-info-content) {
    width: 100% !important;
  }
  
  :global(.token-info-panel .stats-grid) {
    width: 100% !important;
    grid-template-columns: repeat(2, 1fr) !important;
  }
  
  :global(.right-section button.enter-amount-button) {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 auto !important;
    border-radius: 8px !important;
  }
  
  :global(.right-section .swap-form) {
    width: 100% !important;
  }
  
  :global(.right-section .swap-container) {
    width: 100% !important;
  }

  :global(.right-section .action-button),
  :global(.right-section .enter-amount-button),
  :global(.right-section .swap-action-button) {
    width: 100% !important;
    max-width: 100% !important;
  }
  
  :global(.right-section .token-selector) {
    width: 100% !important;
  }
  
  :global(.right-section .input-container) {
    width: 100% !important;
  }

  /* Mobile styles */
  @media (max-width: 768px) {
    .swap-pro-container {
      padding: 0.5rem;
      padding-top: 0.5rem;
      height: 85vh;
      overflow: hidden;
    }

    .main-content {
      flex-direction: column;
      gap: 1rem;
      height: 100%;
    }

    .left-section {
      gap: 1rem;
      overflow: hidden;
    }

    .right-section {
      width: 100%;
      min-width: 0;
      height: auto;
      overflow: hidden;
      padding-right: 0;
    }

    .swap-section, 
    .token-info-section {
      width: 100%;
    }

    .mobile-chart-section {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      height: 100%;
      padding: 0;
      overflow: hidden;
    }

    :global(.chart-area) {
      flex: 2;
      height: auto !important;
      min-height: 0;
      max-height: none;
      margin-bottom: 0.5rem;
    }

    :global(.transaction-feed) {
      flex: 1;
      height: auto !important;
      min-height: 0;
      max-height: none;
      overflow: hidden;
      border-top: 1px solid rgb(var(--border) / 0.8);
      padding-top: 0.5rem;
    }

    .chart-wrapper {
      height: 100%;
      min-height: 0;
      margin-bottom: 0;
    }
  }

  /* Desktop adjustments */
  @media (min-width: 1920px) {
    .right-section {
      width: 500px;
      min-width: 500px;
      max-width: 500px;
    }
  }

  @media (max-width: 1200px) and (min-width: 769px) {
    .right-section {
      width: 400px;
      min-width: 400px;
      max-width: 400px;
    }
  }

  /* Height-based responsive adjustments */
  @media (max-height: 800px) {
    .swap-pro-container {
      padding: 0.5rem;
      padding-top: 0.5rem;
    }

    .main-content {
      gap: 0.5rem;
    }

    :global(.chart-area) {
      flex: 2;
    }

    :global(.transaction-feed) {
      flex: 1;
    }
  }

  /* Very short screens */
  @media (max-height: 600px) {
    .swap-pro-container {
      height: 85vh;
      min-height: 85vh;
    }
    
    .main-content {
      height: 100%;
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
