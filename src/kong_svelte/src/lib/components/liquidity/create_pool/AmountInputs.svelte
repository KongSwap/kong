<script lang="ts">
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { handleFormattedNumberInput } from "$lib/utils/formUtils";
  import Panel from "$lib/components/common/Panel.svelte";
  import { BigNumber } from "bignumber.js";

  export let token0: Kong.Token | null;
  export let token1: Kong.Token | null;
  export let amount0: string;
  export let amount1: string;
  export let token0Balance: string;
  export let token1Balance: string;
  export let onAmountChange: (index: 0 | 1, value: string) => void;
  export let onPercentageClick: (percentage: number) => void;
  export let onToken1PercentageClick: (percentage: number) => void;

  let input0Element: HTMLInputElement;
  let input1Element: HTMLInputElement;
  let displayValue0 = "";
  let displayValue1 = "";
  let inputDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  const DEBOUNCE_DELAY = 50; // Reduce debounce delay for more responsiveness

  function handleFormattedInput(index: 0 | 1, event: Event) {
    const input = event.target as HTMLInputElement;
    const cursorPosition = input.selectionStart || 0;

    const result = handleFormattedNumberInput(
      input.value,
      cursorPosition,
      index === 0 ? displayValue0 : displayValue1,
    );

    // Update the display value immediately for visual feedback
    if (index === 0) {
      displayValue0 = result.formattedValue;
    } else {
      displayValue1 = result.formattedValue;
    }

    // Don't update the input value during typing - avoid unnecessary DOM manipulation
    // input.value = result.formattedValue;
    
    // Maintain cursor position
    requestAnimationFrame(() => {
      input.setSelectionRange(
        result.newCursorPosition,
        result.newCursorPosition,
      );
    });

    // Debounce the callback to parent component
    if (inputDebounceTimer) {
      clearTimeout(inputDebounceTimer);
    }

    inputDebounceTimer = setTimeout(() => {
      if (index === 0) {
        onAmountChange(0, result.rawValue);
      } else {
        onAmountChange(1, result.rawValue);
      }
      inputDebounceTimer = null;
    }, DEBOUNCE_DELAY);
  }

  // Update these reactive statements to optimize performance
  $: if (amount0 !== displayValue0.replace(/,/g, '')) {
    // Only update if the underlying value actually changed
    const rawAmount0 = amount0.replace(/,/g, '');
    displayValue0 = formatWithCommas(rawAmount0);
    if (input0Element && !input0Element.matches(':focus')) {
      // Only update DOM when input is not focused
      input0Element.value = displayValue0;
    }
  }

  $: if (amount1 !== displayValue1.replace(/,/g, '')) {
    // Only update if the underlying value actually changed
    const rawAmount1 = amount1.replace(/,/g, '');
    displayValue1 = formatWithCommas(rawAmount1);
    if (input1Element && !input1Element.matches(':focus')) {
      // Only update DOM when input is not focused
      input1Element.value = displayValue1;
    }
  }

  // Helper function to format with commas
  function formatWithCommas(value: string): string {
    if (!value) return "";
    const parts = value.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }
</script>

<Panel variant="transparent" className="!p-4">
  <div class="flex flex-col gap-4">
    <div class="token-input-container">
      <!-- Token 0 Input -->
      <div class="relative flex-grow mb-2">
        <div class="input-with-token">
          {#if token0}
            <img src={token0.logo_url} alt={token0.symbol} class="token-logo" />
          {/if}
          <input
            bind:this={input0Element}
            type="text"
            inputmode="decimal"
            pattern="[0-9]*"
            placeholder="0"
            class="amount-input"
            value={displayValue0}
            on:input={(e) => handleFormattedInput(0, e)}
            disabled={!token0}
          />
        </div>
      </div>
      <div class="balance-info">
        <span class="text-kong-text-primary/50">
          Available: {token0 ? formatBalance(token0Balance, token0.decimals) : "0.00"}
          {token0?.symbol || ""}
        </span>
        <div class="percentage-buttons">
          {#if token0 && parseFloat(token0Balance) > 0}
            <button on:click={() => onPercentageClick(25)}>25%</button>
            <button on:click={() => onPercentageClick(50)}>50%</button>
            <button on:click={() => onPercentageClick(75)}>75%</button>
            <button on:click={() => onPercentageClick(100)}>MAX</button>
          {:else}
            <button disabled>25%</button>
            <button disabled>50%</button>
            <button disabled>75%</button>
            <button disabled>MAX</button>
          {/if}
        </div>
      </div>
    </div>

    <div class="token-input-container">
      <!-- Token 1 Input -->
      <div class="relative flex-grow mb-2">
        <div class="input-with-token">
          {#if token1}
            <img src={token1.logo_url} alt={token1.symbol} class="token-logo" />
          {/if}
          <input
            bind:this={input1Element}
            type="text"
            inputmode="decimal"
            pattern="[0-9]*"
            placeholder="0"
            class="amount-input"
            value={displayValue1}
            on:input={(e) => handleFormattedInput(1, e)}
            disabled={!token1}
          />
        </div>
      </div>
      <div class="balance-info">
        <span class="text-kong-text-primary/50">
          Available: {token1 ? formatBalance(token1Balance, token1.decimals) : "0.00"}
          {token1?.symbol || ""}
        </span>
        <div class="percentage-buttons">
          {#if token1 && parseFloat(token1Balance) > 0}
            <button on:click={() => onToken1PercentageClick(25)}>25%</button>
            <button on:click={() => onToken1PercentageClick(50)}>50%</button>
            <button on:click={() => onToken1PercentageClick(75)}>75%</button>
            <button on:click={() => onToken1PercentageClick(100)}>MAX</button>
          {:else}
            <button disabled>25%</button>
            <button disabled>50%</button>
            <button disabled>75%</button>
            <button disabled>MAX</button>
          {/if}
        </div>
      </div>
    </div>
  </div>
</Panel>

<style scoped lang="postcss">
  .token-input-container {
    @apply bg-kong-bg-light rounded-xl p-3;
    @apply border border-kong-border backdrop-blur-md;
    @apply transition-all duration-200;
    @apply hover:border-kong-border-light hover:bg-kong-bg-light/75;
  }

  .amount-input {
    @apply w-full min-w-0 bg-transparent border-none;
    @apply text-[clamp(1.5rem,4vw,2.5rem)] font-medium tracking-tight;
    @apply relative z-10 p-0;
    @apply opacity-100 focus:outline-none focus:text-kong-text-primary;
    @apply disabled:text-kong-text-primary/70 placeholder:text-kong-text-primary/30;
  }

  .balance-info {
    @apply flex flex-wrap justify-between mt-2 gap-2;
    @apply text-[clamp(0.75rem,2vw,0.875rem)] text-kong-text-primary/50;
  }

  .input-with-token {
    @apply flex items-center gap-3;
  }

  .token-logo {
    @apply w-6 h-6 rounded-full bg-kong-bg-dark/20 object-contain flex-shrink-0;
    @apply border border-kong-border;
  }

  .percentage-buttons {
    @apply flex flex-wrap gap-1;
  }

  .percentage-buttons button {
    @apply px-1.5 py-0.5 text-xs rounded-md bg-kong-bg-light text-kong-text-primary/70
           hover:bg-kong-bg-light/75 hover:text-kong-text-primary transition-all duration-200
           disabled:opacity-40 disabled:hover:bg-kong-bg-light disabled:hover:text-kong-text-primary/70;
    @apply border border-kong-border;
  }
</style> 