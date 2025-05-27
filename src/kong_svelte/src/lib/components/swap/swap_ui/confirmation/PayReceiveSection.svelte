<script lang="ts">
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { userTokens } from "$lib/stores/userTokens";
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { ChevronRight, ChevronsDown, ArrowDown, Zap } from "lucide-svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import BigNumber from "bignumber.js";

  // Access props directly using $props() instead of destructuring
  const props = $props<{
    payToken: Kong.Token;
    payAmount: string;
    receiveToken: Kong.Token;
    receiveAmount: string;
    routingPath?: string[];
  }>();

  let tokens = $state([]);
  let prevRoutingPath = $state([]);
  let hoveredIndex = $state<number | null>(null);
  let showRoutes = $state(false);
  
  // Format a number for display with commas as thousands separators
  function formatWithCommas(value: string | undefined): string {
    if (!value) return "0";
    
    try {
      // Handle potential existing commas by removing them first
      const cleanValue = value.toString().replace(/,/g, '');
      
      // Split by decimal point
      const parts = cleanValue.split('.');
      
      // Format the integer part with commas
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      
      // Return with decimal part if it exists
      return parts.length > 1 ? parts.join('.') : parts[0];
    } catch (error) {
      console.error("Error formatting with commas:", error);
      return value.toString();
    }
  }
  
  // Format pay and receive amounts
  let formattedPayAmount = $derived(formatWithCommas(props.payAmount));
  let formattedReceiveAmount = $derived(formatWithCommas(props.receiveAmount));
  
  function calculateUsdValue(amount: string | undefined, price: string | undefined): string {
    if (!amount || !price) return "0";
    
    try {
      // Remove commas before parsing
      const cleanAmount = String(amount).replace(/,/g, '');
      const cleanPrice = String(price);
      
      // Calculate directly with JavaScript
      const result = parseFloat(cleanAmount) * parseFloat(cleanPrice);
      if (isNaN(result)) return "0";
      
      // Format and return the result
      return formatToNonZeroDecimal(result.toString());
    } catch (error) {
      console.error("Error calculating USD value:", error);
      return "0";
    }
  }
  
  function calculateExchangeRate(receiveAmount: string | undefined, payAmount: string | undefined): string {
    if (!receiveAmount || !payAmount) return "0";
    
    try {
      // Remove commas before parsing
      const cleanReceiveAmount = String(receiveAmount).replace(/,/g, '');
      const cleanPayAmount = String(payAmount).replace(/,/g, '');
      
      // Calculate directly with JavaScript
      const result = parseFloat(cleanReceiveAmount) / parseFloat(cleanPayAmount);
      if (isNaN(result)) return "0";
      
      // Format and return the result
      return formatToNonZeroDecimal(result.toString());
    } catch (error) {
      console.error("Error calculating exchange rate:", error);
      return "0";
    }
  }
  
  // Calculate USD values and exchange rate
  let payTokenUsdValue = $derived(calculateUsdValue(props.payAmount, props.payToken?.metrics?.price));
  let receiveTokenUsdValue = $derived(calculateUsdValue(props.receiveAmount, props.receiveToken?.metrics?.price));
  let exchangeRate = $derived(calculateExchangeRate(props.receiveAmount, props.payAmount));

  async function updateTokens() {
    const currentRoutingPath = props.routingPath ?? [];
    if (JSON.stringify(prevRoutingPath) === JSON.stringify(currentRoutingPath)) {
      return;
    }

    if (!currentRoutingPath || !$userTokens?.tokens?.length) return;

    try {
      const tokenPromises = currentRoutingPath.map((canisterId) =>
        fetchTokensByCanisterId([canisterId]).then((tokens) => tokens[0]),
      );

      const fetchedTokens = await Promise.all(tokenPromises);
      tokens = fetchedTokens.filter((t): t is Kong.Token => t !== undefined);
      prevRoutingPath = [...currentRoutingPath];
    } catch (error) {
      console.error("Error fetching tokens:", error);
    }
  }

  $effect(() => {
    const currentRoutingPath = props.routingPath ?? [];
    if (JSON.stringify(prevRoutingPath) !== JSON.stringify(currentRoutingPath)) {
      updateTokens();
    }
  });

  onMount(() => {
    updateTokens();
  });
</script>

<div class="swap-info-section">
  <!-- Main Swap Cards Container -->
  <div class="swap-cards-container">
    <!-- Pay Token Card -->
    <div class="token-card from-card">
      <div class="card-label">From</div>
      <div class="card-content">
        <div class="token-display">
          <div class="token-image-wrapper">
            <TokenImages tokens={[props.payToken]} size={44} containerClass="token-img" />
          </div>
          <div class="token-info">
            <div class="token-symbol">{props.payToken?.symbol}</div>
            <div class="token-amount">{formattedPayAmount}</div>
          </div>
        </div>
        <div class="usd-value">${payTokenUsdValue}</div>
      </div>
    </div>

    <!-- Arrow Divider -->
    <div class="arrow-divider">
      <div class="arrow-container">
        <div class="arrow-pulse"></div>
        <div class="arrow-icon">
          <ArrowDown size={20} strokeWidth={2.5} />
        </div>
      </div>
    </div>

    <!-- Receive Token Card -->
    <div class="token-card to-card">
      <div class="card-label">To</div>
      <div class="card-content">
        <div class="token-display">
          <div class="token-image-wrapper">
            <TokenImages tokens={[props.receiveToken]} size={44} containerClass="token-img" />
          </div>
          <div class="token-info">
            <div class="token-symbol">{props.receiveToken?.symbol}</div>
            <div class="token-amount">{formattedReceiveAmount}</div>
          </div>
        </div>
        <div class="usd-value">${receiveTokenUsdValue}</div>
      </div>
    </div>
  </div>

  <!-- Exchange Rate Display -->
  <div class="rate-display">
    <div class="rate-content">
      <span class="rate-label">Rate</span>
      <span class="rate-value">
        1 {props.payToken?.symbol} = {exchangeRate} {props.receiveToken?.symbol}
      </span>
    </div>
  </div>

  <!-- Route Display (if multi-hop) -->
  {#if tokens.length > 2}
    <button 
      class="route-toggle-btn" 
      on:click={() => (showRoutes = !showRoutes)}
      type="button"
    >
      <div class="route-toggle-content">
        <Zap size={16} class="route-icon" />
        <span class="route-text">Route via {tokens.length - 1} pools</span>
      </div>
      <div class="toggle-indicator">{showRoutes ? '−' : '+'}</div>
    </button>

    {#if showRoutes}
      <div class="route-display" transition:slide={{ duration: 200 }}>
        <div class="route-path">
          {#each tokens as token, i}
            <div
              class="route-token"
              class:active={hoveredIndex === i}
              on:mouseenter={() => (hoveredIndex = i)}
              on:mouseleave={() => (hoveredIndex = null)}
              role="button"
              tabindex="0"
            >
              <TokenImages
                tokens={[token]}
                size={24}
                containerClass="route-token-img"
              />
              <span class="route-token-symbol">{token.symbol}</span>
            </div>
            {#if i < tokens.length - 1}
              <ChevronRight size={16} class="route-arrow" />
            {/if}
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style lang="postcss">
  /* Main Section */
  .swap-info-section {
    @apply flex flex-col gap-3;
  }

  /* Swap Cards Container */
  .swap-cards-container {
    @apply relative flex flex-col gap-1;
  }

  /* Token Card Base */
  .token-card {
    @apply relative bg-gradient-to-br from-kong-bg-secondary/50 to-kong-bg-tertiary/30 
           border border-kong-border/20 rounded-2xl p-4 
           transition-all duration-300 hover:border-kong-border/40
           backdrop-blur-sm;
  }

  /* Card specific backgrounds */
  .from-card {
    @apply from-kong-bg-secondary/60 to-kong-bg-tertiary/40;
  }

  .to-card {
    @apply from-kong-bg-tertiary/40 to-kong-bg-secondary/60;
  }

  /* Card Label */
  .card-label {
    @apply absolute -top-2.5 left-4 text-[11px] font-medium text-kong-text-secondary 
           bg-kong-bg-primary px-2 py-0.5 rounded-full border border-kong-border/20;
  }

  /* Card Content */
  .card-content {
    @apply flex items-center justify-between gap-4;
  }

  /* Token Display */
  .token-display {
    @apply flex items-center gap-3 flex-1;
  }

  /* Token Image Wrapper */
  .token-image-wrapper {
    @apply relative p-1 bg-gradient-to-br from-kong-bg-primary/40 to-kong-bg-primary/20 
           rounded-full backdrop-blur-sm;
  }

  .token-img {
    @apply rounded-full;
  }

  /* Token Info */
  .token-info {
    @apply flex flex-col gap-0.5 min-w-0;
  }

  .token-symbol {
    @apply text-sm font-medium text-kong-text-secondary;
  }

  .token-amount {
    @apply text-lg font-semibold text-kong-text-primary truncate;
  }

  /* USD Value */
  .usd-value {
    @apply text-sm text-kong-text-secondary font-medium;
  }

  /* Arrow Divider */
  .arrow-divider {
    @apply relative flex justify-center -my-2 z-10;
  }

  .arrow-container {
    @apply relative;
  }

  .arrow-pulse {
    @apply absolute inset-0 w-10 h-10 bg-kong-primary/20 rounded-full animate-ping;
  }

  .arrow-icon {
    @apply relative flex items-center justify-center w-10 h-10 
           bg-gradient-to-br from-kong-primary to-kong-secondary 
           rounded-full text-white shadow-lg
           border-2 border-kong-bg-primary;
  }

  /* Rate Display */
  .rate-display {
    @apply bg-gradient-to-r from-kong-bg-secondary/30 to-kong-bg-tertiary/30 
           border border-kong-border/15 rounded-xl p-3 backdrop-blur-sm;
  }

  .rate-content {
    @apply flex items-center justify-between;
  }

  .rate-label {
    @apply text-xs text-kong-text-secondary font-medium;
  }

  .rate-value {
    @apply text-sm font-semibold text-kong-text-primary;
  }

  /* Route Toggle Button */
  .route-toggle-btn {
    @apply w-full flex items-center justify-between p-3
           bg-gradient-to-r from-kong-info/10 to-kong-info/5 
           border border-kong-info/20 rounded-xl
           transition-all duration-200 hover:border-kong-info/40
           cursor-pointer;
  }

  .route-toggle-content {
    @apply flex items-center gap-2;
  }

  .route-icon {
    @apply text-kong-info;
  }

  .route-text {
    @apply text-sm text-kong-text-primary font-medium;
  }

  .toggle-indicator {
    @apply w-6 h-6 flex items-center justify-center 
           bg-kong-bg-primary/50 rounded-full 
           text-sm font-semibold text-kong-text-secondary
           border border-kong-border/20;
  }

  /* Route Display */
  .route-display {
    @apply bg-kong-bg-secondary/20 rounded-xl border border-kong-border/10 p-3;
  }

  .route-path {
    @apply flex items-center justify-center flex-wrap gap-2;
  }

  .route-token {
    @apply flex items-center gap-1.5 px-2.5 py-1.5
           bg-kong-bg-primary/40 border border-kong-border/20 
           rounded-lg transition-all duration-200 cursor-pointer;
  }

  .route-token:hover,
  .route-token.active {
    @apply border-kong-primary/40 bg-kong-bg-primary/60 transform scale-105;
  }

  .route-token-img {
    @apply rounded-full;
  }

  .route-token-symbol {
    @apply text-xs font-medium text-kong-text-primary;
  }

  .route-arrow {
    @apply text-kong-text-secondary/60;
  }

  /* Animations */
  @keyframes ping {
    75%, 100% {
      transform: scale(2);
      opacity: 0;
    }
  }

  /* Mobile Responsiveness */
  @media (max-width: 640px) {
    .token-card {
      @apply p-3;
    }

    .token-amount {
      @apply text-base;
    }

    .arrow-icon {
      @apply w-8 h-8;
    }

    .arrow-pulse {
      @apply w-8 h-8;
    }
  }
</style>
