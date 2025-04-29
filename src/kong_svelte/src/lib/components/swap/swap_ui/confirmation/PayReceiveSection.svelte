<script lang="ts">
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { userTokens } from "$lib/stores/userTokens";
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { ChevronRight, ChevronsDown, ArrowDown } from "lucide-svelte";
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

<div class="section">
  <div class="token-swap-container">
    <!-- Pay Token Section -->
    <div class="token-card pay">
      <div class="token-header">You Pay</div>
      <div class="token-content">
        <div class="token-img-container">
          <TokenImages tokens={[props.payToken]} size={42} containerClass="token-image sm:size-10" />
        </div>
        <div class="token-details">
          <div class="token-amount">{formattedPayAmount} {props.payToken?.symbol}</div>
          <div class="token-usd-value">${payTokenUsdValue}</div>
        </div>
      </div>
    </div>

    <!-- Arrow Separator -->
    <div class="arrow-separator">
      <div class="arrow-circle">
        <ArrowDown size={16} strokeWidth={2.5} class="size-4 sm:size-5" />
      </div>
    </div>

    <!-- Receive Token Section -->
    <div class="token-card receive">
      <div class="token-header">You Receive</div>
      <div class="token-content">
        <div class="token-img-container">
          <TokenImages tokens={[props.receiveToken]} size={42} containerClass="token-image sm:size-10" />
        </div>
        <div class="token-details">
          <div class="token-amount">{formattedReceiveAmount} {props.receiveToken?.symbol}</div>
          <div class="token-usd-value">${receiveTokenUsdValue}</div>
        </div>
      </div>
    </div>

    <!-- Exchange Rate Info -->
    <div class="exchange-rate">
      <div class="rate-label">Exchange Rate</div>
      <div class="rate-value">1 {props.payToken?.symbol} = {exchangeRate} {props.receiveToken?.symbol}</div>
    </div>
  </div>

  {#if tokens.length > 0}
    <!-- Route Toggle Button -->
    <button 
      class="route-toggle" 
      on:click={() => (showRoutes = !showRoutes)}
      aria-label="Toggle route view"
    >
      <div class="flex items-center gap-2">
        <span class="route-label">View Route</span>
        <span class="hop-count">{tokens.length - 1} hop{tokens.length > 2 ? "s" : ""}</span>
      </div>
      <span class="toggle-icon">{showRoutes ? "−" : "+"}</span>
    </button>

    <!-- Route Visualization -->
    {#if showRoutes}
      <div class="route-visualization" transition:slide={{ duration: 200 }}>
        <div class="route-path">
          {#each tokens as token, i}
            <div
              class="token-node"
              on:mouseenter={() => (hoveredIndex = i)}
              on:mouseleave={() => (hoveredIndex = null)}
            >
              <div
                class="token-node-content"
                class:active={hoveredIndex === i}
                role="button"
                tabindex="0"
              >
                <TokenImages
                  tokens={[token]}
                  size={20}
                  containerClass="node-image size-5 sm:size-6"
                />
                <div class="node-symbol">{token.symbol}</div>
              </div>
              {#if i < tokens.length - 1}
                <div class="node-connector">
                  <ChevronRight size={14} class="size-3.5 sm:size-4" />
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style lang="postcss">
  /* Main Container */
  .section {
    @apply mt-2 flex flex-col gap-4 sm:gap-3;
  }

  /* Token Swap Container */
  .token-swap-container {
    @apply flex flex-col gap-3 sm:gap-2 w-full;
  }

  /* Token Card Common Styles */
  .token-card {
    @apply relative bg-kong-bg-dark/30 border border-kong-border/20 rounded-xl p-4 transition-all duration-200 hover:border-kong-border/40 sm:p-3;
  }

  /* Token Header */
  .token-header {
    @apply absolute top-2 left-3 text-[10px] font-medium text-kong-text-secondary bg-kong-bg-dark/70 px-2 py-0.5 rounded-lg sm:text-xs sm:top-1.5 sm:left-2 sm:py-0;
  }

  /* Token Content Layout */
  .token-content {
    @apply flex items-center gap-4 pt-4 sm:gap-3 sm:pt-3;
  }

  /* Token Image Container */
  .token-img-container {
    @apply flex-shrink-0 bg-kong-bg-dark/40 rounded-full p-1 sm:p-0.5;
  }

  /* Token Details Layout */
  .token-details {
    @apply flex flex-col gap-1 min-w-0 flex-1 sm:gap-0.5;
  }

  /* Token Amount */
  .token-amount {
    @apply text-lg font-medium text-kong-text-primary truncate sm:text-base;
  }

  /* Token USD Value */
  .token-usd-value {
    @apply text-xs text-kong-text-secondary sm:text-sm;
  }

  /* Arrow Separator */
  .arrow-separator {
    @apply flex justify-center -my-6 sm:-my-4;
  }

  /* Arrow Circle */
  .arrow-circle {
    @apply flex items-center justify-center w-8 h-8 rounded-full bg-kong-bg-dark border border-kong-primary/20 z-10 text-kong-primary sm:w-6 sm:h-6;
    box-shadow: 0 2px 8px rgba(var(--primary), 0.15);
  }

  /* Exchange Rate Container */
  .exchange-rate {
    @apply flex items-center justify-between p-3 bg-kong-bg-dark/20 rounded-lg border border-kong-border/10 sm:p-2;
  }

  /* Rate Label */
  .rate-label {
    @apply text-xs text-kong-text-secondary sm:text-sm;
  }

  /* Rate Value */
  .rate-value {
    @apply text-xs font-medium text-kong-text-primary sm:text-sm;
  }

  /* Route Toggle Button */
  .route-toggle {
    @apply flex items-center justify-between w-full p-3 bg-kong-bg-dark/20 
           border border-kong-border/10 rounded-lg cursor-pointer transition-all duration-200
           hover:bg-kong-bg-dark/40 hover:border-kong-border/30 sm:p-2;
  }

  /* Route Label */
  .route-label {
    @apply text-xs text-kong-text-secondary sm:text-sm;
  }

  /* Hop Count Badge */
  .hop-count {
    @apply text-[10px] bg-kong-primary/20 text-kong-primary px-2 py-0.5 rounded-full sm:text-xs sm:px-1.5 sm:py-0;
  }

  /* Toggle Icon */
  .toggle-icon {
    @apply text-lg leading-none text-kong-text-secondary sm:text-base;
  }

  /* Route Visualization */
  .route-visualization {
    @apply bg-kong-bg-dark/10 rounded-lg border border-kong-border/10 p-3 mt-1 overflow-hidden sm:p-2;
  }

  /* Route Path */
  .route-path {
    @apply flex flex-wrap items-center justify-center gap-1;
  }

  /* Token Node */
  .token-node {
    @apply flex items-center;
  }

  /* Token Node Content */
  .token-node-content {
    @apply flex flex-col items-center gap-1 px-3 py-2 bg-kong-bg-dark/30 
           border border-kong-border/20 rounded-lg transition-all duration-200
           hover:border-kong-primary/30 hover:bg-kong-bg-dark/40 sm:px-2 sm:py-1 sm:gap-0.5;
  }

  /* Node Image */
  .node-image {
    @apply rounded-full bg-kong-bg-dark/40 p-0.5;
  }

  /* Node Symbol */
  .node-symbol {
    @apply text-[10px] text-kong-text-primary sm:text-xs;
  }

  /* Node Connector */
  .node-connector {
    @apply flex items-center justify-center text-kong-text-secondary mx-1 sm:mx-0.5;
  }

  /* Active Token Node */
  .token-node-content.active {
    @apply border-kong-primary/50 bg-kong-bg-dark/50 transform -translate-y-0.5;
    box-shadow: 0 2px 6px rgba(var(--primary), 0.1);
  }

  /* Mobile Responsive Styles */
  @media (max-width: 640px) {
    /* Improve touch targets */
    .route-toggle, .token-node-content {
      @apply active:bg-kong-bg-dark/60;
      -webkit-tap-highlight-color: transparent;
    }

    /* Optimize for smaller screens */
    .token-card {
      @apply border-opacity-30;
    }

    /* Fix any clipping issues */
    .token-swap-container {
      @apply pb-1;
    }
  }
</style>
