<script lang="ts">
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { handleFormattedNumberInput } from "$lib/utils/formUtils";
  import Panel from "$lib/components/common/Panel.svelte";
  import { BigNumber } from "bignumber.js";
  import { Wallet, Plus } from "lucide-svelte";

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

  // Check if amounts are entered
  $: hasAmount0 = amount0 && parseFloat(amount0) > 0;
  $: hasAmount1 = amount1 && parseFloat(amount1) > 0;
  $: hasBalances = token0 && token1 && parseFloat(token0Balance) > 0 && parseFloat(token1Balance) > 0;
</script>

<div class="space-y-3">
  <!-- Token Inputs -->
  <div class="">
    <!-- Token 0 Input -->
    <Panel variant="solid" type="secondary">
      <div class="space-y-3">
        <!-- Token Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            {#if token0}
              <img src={token0.logo_url} alt={token0.symbol} class="token-logo" />
              <span class="text-sm font-medium text-kong-text-primary">{token0.symbol}</span>
            {:else}
              <div class="w-6 h-6 rounded-full bg-kong-bg-secondary border border-kong-border/30"></div>
              <span class="text-sm text-kong-text-primary/40">Select token</span>
            {/if}
          </div>
          
          <div class="flex items-center gap-1 text-xs text-kong-text-primary/50">
            <Wallet class="w-3 h-3" />
            <span>
              {token0 ? formatBalance(token0Balance, token0.decimals) : "0.00"}
            </span>
          </div>
        </div>

        <!-- Amount Input -->
        <div class="amount-input-container">
          <input
            bind:this={input0Element}
            type="text"
            inputmode="decimal"
            pattern="[0-9]*"
            placeholder="0.00"
            class="amount-input"
            value={displayValue0}
            oninput={(e) => handleFormattedInput(0, e)}
            disabled={!token0}
          />
          {#if token0}
            <span class="input-currency">{token0.symbol}</span>
          {/if}
        </div>

        <!-- Percentage Buttons -->
        <div class="flex items-center justify-between">
          <span class="text-xs text-kong-text-primary/60">Quick amounts:</span>
          <div class="percentage-buttons">
            {#if token0 && parseFloat(token0Balance) > 0}
              <button onclick={() => onPercentageClick(25)} class="percentage-btn">25%</button>
              <button onclick={() => onPercentageClick(50)} class="percentage-btn">50%</button>
              <button onclick={() => onPercentageClick(75)} class="percentage-btn">75%</button>
              <button onclick={() => onPercentageClick(100)} class="percentage-btn max-btn">MAX</button>
            {:else}
              <button disabled class="percentage-btn">25%</button>
              <button disabled class="percentage-btn">50%</button>
              <button disabled class="percentage-btn">75%</button>
              <button disabled class="percentage-btn">MAX</button>
            {/if}
          </div>
        </div>
      </div>
    </Panel>

    <!-- Connection Arrow -->
    <div class="flex justify-center -my-3">
      <div class="p-1.5 bg-kong-bg-secondary z-10 rounded-full border border-kong-border/30">
        <Plus class="w-5 h-5 text-kong-text-primary/40" />
      </div>
    </div>

    <!-- Token 1 Input -->
    <Panel variant="solid" type="secondary">
      <div class="space-y-3">
        <!-- Token Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            {#if token1}
              <img src={token1.logo_url} alt={token1.symbol} class="token-logo" />
              <span class="text-sm font-medium text-kong-text-primary">{token1.symbol}</span>
            {:else}
              <div class="w-6 h-6 rounded-full bg-kong-bg-secondary border border-kong-border/30"></div>
              <span class="text-sm text-kong-text-primary/40">Select token</span>
            {/if}
          </div>
          
          <div class="flex items-center gap-1 text-xs text-kong-text-primary/50">
            <Wallet class="w-3 h-3" />
            <span>
              {token1 ? formatBalance(token1Balance, token1.decimals) : "0.00"}
            </span>
          </div>
        </div>

        <!-- Amount Input -->
        <div class="amount-input-container">
          <input
            bind:this={input1Element}
            type="text"
            inputmode="decimal"
            pattern="[0-9]*"
            placeholder="0.00"
            class="amount-input"
            value={displayValue1}
            oninput={(e) => handleFormattedInput(1, e)}
            disabled={!token1}
          />
          {#if token1}
            <span class="input-currency">{token1.symbol}</span>
          {/if}
        </div>

        <!-- Percentage Buttons -->
        <div class="flex items-center justify-between">
          <span class="text-xs text-kong-text-primary/60">Quick amounts:</span>
          <div class="percentage-buttons">
            {#if token1 && parseFloat(token1Balance) > 0}
              <button onclick={() => onToken1PercentageClick(25)} class="percentage-btn">25%</button>
              <button onclick={() => onToken1PercentageClick(50)} class="percentage-btn">50%</button>
              <button onclick={() => onToken1PercentageClick(75)} class="percentage-btn">75%</button>
              <button onclick={() => onToken1PercentageClick(100)} class="percentage-btn max-btn">MAX</button>
            {:else}
              <button disabled class="percentage-btn">25%</button>
              <button disabled class="percentage-btn">50%</button>
              <button disabled class="percentage-btn">75%</button>
              <button disabled class="percentage-btn">MAX</button>
            {/if}
          </div>
        </div>
      </div>
    </Panel>
  </div>

  <!-- Status and Summary -->
  {#if hasAmount0 && hasAmount1 && token0 && token1}
    <div class="space-y-3">
      <!-- Status -->
      <div class="flex justify-between items-center">
        <span class="text-sm text-kong-text-primary/70">Summary</span>
        <span class="text-xs text-kong-success bg-kong-success/10 px-2 py-1 rounded-full">
          Amounts Set
        </span>
      </div>
      
      <!-- Summary Information -->
      <Panel variant="solid" type="secondary" className="!p-3 bg-kong-bg-tertiary/30">
        <div class="text-xs text-kong-text-primary/70 space-y-1">
          <div class="flex justify-between">
            <span>Total {token0.symbol}:</span>
            <span class="font-medium text-kong-text-primary">{displayValue0}</span>
          </div>
          <div class="flex justify-between">
            <span>Total {token1.symbol}:</span>
            <span class="font-medium text-kong-text-primary">{displayValue1}</span>
          </div>
        </div>
      </Panel>
    </div>
  {/if}
</div>

<style scoped lang="postcss">
  .token-logo {
    @apply w-6 h-6 rounded-full bg-kong-bg-primary/10 object-contain flex-shrink-0;
    @apply border border-kong-border/30;
  }

  .amount-input-container {
    @apply relative flex items-center;
    @apply bg-kong-bg-secondary/30 border border-kong-border/30;
    @apply rounded-kong-roundness transition-all duration-200;
    @apply hover:border-kong-border/50 focus-within:border-kong-primary/50;
    @apply focus-within:bg-kong-bg-secondary/50;
  }

  .amount-input {
    @apply flex-1 px-4 py-4 bg-transparent border-none;
    @apply text-xl font-semibold text-kong-text-primary placeholder-kong-text-primary/30;
    @apply focus:outline-none;
    @apply disabled:text-kong-text-primary/40;
    @apply transition-colors duration-200;
  }

  .input-currency {
    @apply px-3 py-2 text-sm font-medium text-kong-text-primary/60;
    @apply border-l border-kong-border/30 bg-kong-bg-secondary/40;
    @apply rounded-r-kong-roundness;
  }

  .percentage-buttons {
    @apply flex gap-1;
  }

  .percentage-btn {
    @apply px-2 py-1 text-xs font-medium rounded;
    @apply bg-kong-bg-secondary/50 text-kong-text-primary/60;
    @apply border border-kong-border/30;
    @apply hover:bg-kong-bg-secondary hover:text-kong-text-primary;
    @apply transition-all duration-200;
    @apply disabled:opacity-40 disabled:cursor-not-allowed;
    @apply disabled:hover:bg-kong-bg-secondary/50 disabled:hover:text-kong-text-primary/60;
  }

  .max-btn {
    @apply bg-kong-primary/10 text-kong-primary border-kong-primary/30;
    @apply hover:bg-kong-primary/20 hover:text-kong-primary;
  }

  .max-btn:disabled {
    @apply bg-kong-bg-secondary/50 text-kong-text-primary/60 border-kong-border/30;
  }
</style> 