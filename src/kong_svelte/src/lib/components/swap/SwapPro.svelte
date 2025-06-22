<script lang="ts">
  import Swap from "./Swap.svelte";
  import TradingViewChart from "$lib/components/common/TradingViewChart.svelte";
  import { livePools } from "$lib/stores/poolStore";
  import { swapState } from "$lib/stores/swapStateStore";
  import TransactionFeed from "$lib/components/stats/TransactionFeed.svelte";
  import TokenInfoEnhanced from "./TokenInfoEnhanced.svelte";
  import { app } from "$lib/state/app.state.svelte";
  import { DEFAULT_TOKENS } from "$lib/constants/canisterConstants";

  let { initialFromToken, initialToToken } = $props<{ initialFromToken: Kong.Token | null, initialToToken: Kong.Token | null }>();

  let activeToken = $state($swapState.receiveToken || initialToToken); //initialize to toToken

  let fromToken = $derived($swapState.payToken || initialFromToken);
  let toToken = $derived($swapState.receiveToken || initialToToken);
  
  let isMobile = $derived(app.isMobile);

  // Get the pool based on selected tokens
  let selectedPool = $derived.by(() => {
    if (!fromToken?.address || !toToken?.address) return null;

    let pool = $livePools?.find(p => {
      return (p.address_0 === fromToken.address && p.address_1 === toToken.address) ||
             (p.address_1 === fromToken.address && p.address_0 === toToken.address);
    });

    if (!pool) {
      pool = $livePools?.find(p => {
        return (p.address_0 === DEFAULT_TOKENS.icp && p.address_1 === toToken.address) ||
               (p.address_1 === DEFAULT_TOKENS.icp && p.address_0 === toToken.address);
      });
    }
    
    return pool;
  }); 

  let selectedPoolId = $derived(selectedPool?.pool_id);
  let baseToken = $derived(selectedPool?.address_0 === fromToken?.address ? fromToken : toToken);
  let quoteToken = $derived(selectedPool?.address_0 === toToken?.address ? fromToken : toToken);

  // Mobile view state for swap toggle
  let showSwap = $state(false);
</script>

<div class="swap-pro-container">
  {#if isMobile}
    <!-- Mobile Layout -->
    <div class="mobile-layout">
      <div class="mobile-trade-section">
        <TokenInfoEnhanced fromToken={fromToken} toToken={toToken} bind:activeToken />
        
        <button class="swap-toggle-button" onclick={() => showSwap = !showSwap}>
          {showSwap ? 'Hide' : 'Show'} Swap
        </button>

        {#if showSwap}
          <div class="mobile-swap-wrapper">
            <Swap
              widthFull={true}
            />
          </div>
        {/if}
      </div>
      
      {#if baseToken && quoteToken}
        <TradingViewChart 
          className="mobile-chart-panel"
          poolId={selectedPoolId}
          quoteToken={quoteToken}
          baseToken={baseToken}
        />
      {:else}
        <div class="chart-placeholder">
          Select tokens to view chart
        </div>
      {/if}

      <TransactionFeed token={activeToken} />
    </div>
  {:else}
    <!-- Desktop Grid Layout -->
    <div class="desktop-grid">
      <!-- Chart Panel -->
      <TradingViewChart 
        className="chart-panel !p-0"
        poolId={selectedPoolId}
        quoteToken={quoteToken}
        baseToken={baseToken}
      />


      <TransactionFeed token={activeToken} />

      <!-- Right Column: Token Info + Swap -->
      <div class="trading-section">
        <TokenInfoEnhanced fromToken={fromToken} toToken={toToken} bind:activeToken />
        <Swap
          widthFull={true}
        />
      </div>
    </div>
  {/if}
</div>

<style lang="postcss">
  .swap-pro-container {
    width: 100%;
    height: 100%;
    background: var(--color-background);
    overflow: hidden;
  }

  /* Desktop Grid Layout */
  .desktop-grid {
    display: grid;
    grid-template-columns: 3fr 420px;
    grid-template-rows: 500px 1fr;
    grid-template-areas: 
      "chart trading"
      "feed trading";
    gap: 1rem;
    height: 100%;
    padding: 1rem;
    padding-top: 0;

    @media (max-width: 1120px) {
      grid-template-columns: 3fr 2fr;
    }
  }

  .trading-section {
    grid-area: trading;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow-y: auto;
    padding: 0 0.25rem 0.25rem 0.25rem;
  }

  /* Chart Panel Styling */
  .chart-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgb(var(--text-secondary));
    font-size: 0.9rem;
  }

  /* Mobile Layout */
  .mobile-layout {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: 100%;
    padding: 0.5rem;
    padding-top: 0;
    overflow-y: auto;
  }
  
  :global(.mobile-chart-panel) {
    height: 350px !important;
    min-height: 300px;
    flex-shrink: 0;
  }

  .mobile-trade-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .swap-toggle-button {
    width: 100%;
    padding: 0.75rem;
    background: rgb(var(--primary));
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .swap-toggle-button:hover {
    opacity: 0.9;
  }

  .mobile-swap-wrapper {
    margin-top: 0.5rem;
  }

  @media (max-width: 768px) {
    .desktop-grid {
      display: none;
    }
  }

  @media (min-width: 769px) {
    .mobile-layout {
      display: none;
    }
  }

  /* Height-based responsive adjustments */
  @media (max-height: 700px) {
    .desktop-grid {
      padding: 0.75rem;
      padding-top: 0;
      gap: 0.75rem;
    }
  }
</style>
