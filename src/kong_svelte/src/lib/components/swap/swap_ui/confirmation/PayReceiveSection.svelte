<script lang="ts">
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { userTokens } from "$lib/stores/userTokens";
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { ChevronRight, ChevronsDown } from "lucide-svelte";
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
  <div class="tokens-container">
    <Panel unpadded={false} variant="transparent">
      <div class="token-info">
        <div class="flex items-center gap-3">
          <TokenImages
            tokens={[props.payToken]}
            size={40}
            containerClass="token-image"
          />
          <div class="token-details">
            <span class="type">You Pay</span>
            <div class="amount-container">
              <span class="amount">{formattedPayAmount} {props.payToken?.symbol}</span>
            </div>
            <span class="usd-value"
              >${payTokenUsdValue}</span
            >
          </div>
        </div>
      </div>
    </Panel>

    <div class="arrow-container">
      <ChevronsDown color="rgb(var(--text-secondary))" />
    </div>

    <Panel unpadded={false} variant="transparent">
      <div class="token-info">
        <div class="flex items-center gap-3">
          <TokenImages
            tokens={[props.receiveToken]}
            size={40}
            containerClass="token-image"
          />
          <div class="token-details">
            <span class="type">You Receive</span>
            <div class="amount-container">
              <span class="amount">{formattedReceiveAmount} {props.receiveToken?.symbol}</span>
            </div>
            <span class="usd-value"
              >${receiveTokenUsdValue}</span
            >
          </div>
        </div>
      </div>
    </Panel>

    <div class="exchange-rate text-right mt-1 mr-2">
      1 {props.payToken?.symbol} = {exchangeRate}
      {props.receiveToken?.symbol}
    </div>
  </div>

  {#if tokens.length > 0}
    <div
      class="route-toggle"
      on:click={() => (showRoutes = !showRoutes)}
      role="button"
      tabindex="0"
    >
      <div class="flex items-center gap-2">
        <span class="text-sm text-kong-text-secondary">View Route</span>
        <span class="hop-count"
          >{tokens.length - 1} hop{tokens.length > 2 ? "s" : ""}</span
        >
      </div>
      <span class="text-kong-text-secondary text-lg"
        >{showRoutes ? "−" : "+"}</span
      >
    </div>

    {#if showRoutes}
      <div transition:slide={{ duration: 200 }}>
        <div class="route-line py-2">
          {#each tokens as token, i}
            <div
              class="token-group"
              on:mouseenter={() => (hoveredIndex = i)}
              on:mouseleave={() => (hoveredIndex = null)}
            >
              <div
                class="token-block"
                class:active={hoveredIndex === i}
                role="button"
                tabindex="0"
              >
                <div class="token-inner">
                  <TokenImages
                    tokens={[token]}
                    size={24}
                    containerClass="token-image bg-kong-text-primary/10 rounded-full"
                  />
                  <div class="token-symbol">{token.symbol}</div>
                </div>
              </div>
              {#if i < tokens.length - 1}
                <ChevronRight color="rgb(var(--text-secondary))" size={16} />
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style lang="postcss" scoped>
  .section {
    @apply p-4;
  }

  .tokens-container {
    @apply flex flex-col gap-1;
  }

  .token-info {
    @apply flex-1 min-w-0;
  }

  .token-details {
    @apply flex flex-col gap-1;
  }

  .type {
    @apply text-sm text-kong-text-secondary;
  }

  .amount-container {
    @apply flex items-center;
  }

  .amount {
    @apply text-xl font-medium text-kong-text-primary;
  }

  .usd-value {
    @apply text-sm text-kong-text-secondary;
  }

  .arrow-container {
    @apply flex flex-col items-center justify-center py-1 gap-1;
  }
  .exchange-rate {
    @apply text-sm text-kong-text-secondary;
  }

  .route-toggle {
    @apply flex items-center justify-between p-2 mt-2 cursor-pointer rounded-lg 
           hover:bg-kong-bg-dark/50 transition-colors duration-200;
  }

  .hop-count {
    @apply text-xs text-kong-text-secondary px-1.5 py-0.5 rounded-lg;
  }

  .route-line {
    @apply flex items-center flex-wrap justify-center gap-2 overflow-visible py-2;
    max-width: 100%;
  }

  .token-group {
    @apply flex items-center gap-2;
  }

  .token-block {
    @apply bg-kong-bg-dark/50 border border-kong-border/50 rounded-lg px-3 py-2 transition-all duration-200;
  }

  .token-block.active {
    @apply border-kong-primary bg-kong-bg-dark transform -translate-y-px;
  }

  .token-inner {
    @apply flex items-center gap-2 whitespace-nowrap flex-col w-[42px];
  }

  .token-symbol {
    @apply text-sm text-kong-text-primary;
  }

  @media (max-width: 640px) {
    .section {
      @apply p-3;
    }

    .amount {
      @apply text-lg;
    }

    .type,
    .usd-value,
    .exchange-rate {
      @apply text-xs;
    }

    .token-block {
      @apply px-2 py-1.5;
    }

    .token-symbol {
      @apply text-xs;
    }

    .route-toggle {
      @apply p-1.5;
    }
  }
</style>
