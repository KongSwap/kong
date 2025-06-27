<script lang="ts">
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { handleFormattedNumberInput } from "$lib/utils/formUtils";
  import Panel from "$lib/components/common/Panel.svelte";
  import { BigNumber } from "bignumber.js";
  import { Wallet, Plus } from "lucide-svelte";
  import { currentUserBalancesStore } from "$lib/stores/balancesStore";
  import { liquidityStore } from "$lib/stores/liquidityStore";
  import { toastStore } from "$lib/stores/toastStore";
  import { 
    calculateToken1FromPrice, 
    calculateToken0FromPrice,
    calculateAmountFromPercentage 
  } from "$lib/utils/liquidityUtils";
  import { debounce } from "$lib/utils/debounce";
  import { parseTokenAmount } from "$lib/utils/numberFormatUtils";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { fly } from "svelte/transition";

  interface Props {
    token0: Kong.Token | null;
    token1: Kong.Token | null;
    onShowConfirmModal?: () => void;
  }

  let { token0, token1, onShowConfirmModal }: Props = $props();

  // Internal state management
  let state = $state({
    displayValues: ["", ""] as [string, string],
    isCalculating: false,
    error: null as string | null,
    calculationId: 0
  });

  // Async management
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let abortController: AbortController | null = null;

  let input0Element: HTMLInputElement;
  let input1Element: HTMLInputElement;

  // Token balances derived from store
  let balances = $derived([
    token0?.address ? $currentUserBalancesStore[token0.address]?.in_tokens?.toString() || "0" : "0",
    token1?.address ? $currentUserBalancesStore[token1.address]?.in_tokens?.toString() || "0" : "0"
  ]);

  // Parsed balances for display
  let parsedBalances = $derived([
    token0 ? new BigNumber(balances[0]).div(new BigNumber(10).pow(token0.decimals)) : new BigNumber(0),
    token1 ? new BigNumber(balances[1]).div(new BigNumber(10).pow(token1.decimals)) : new BigNumber(0)
  ]);

  // Sync with liquidity store amounts
  $effect(() => {
    if ($liquidityStore.amount0 !== state.displayValues[0].replace(/,/g, '')) {
      const rawAmount0 = $liquidityStore.amount0.replace(/,/g, '');
      state.displayValues[0] = formatWithCommas(rawAmount0);
      if (input0Element && !input0Element.matches(':focus')) {
        input0Element.value = state.displayValues[0];
      }
    }
  });

  $effect(() => {
    if ($liquidityStore.amount1 !== state.displayValues[1].replace(/,/g, '')) {
      const rawAmount1 = $liquidityStore.amount1.replace(/,/g, '');
      state.displayValues[1] = formatWithCommas(rawAmount1);
      if (input1Element && !input1Element.matches(':focus')) {
        input1Element.value = state.displayValues[1];
      }
    }
  });

  // Helper function to format with commas
  function formatWithCommas(value: string): string {
    if (!value) return "";
    const parts = value.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  // Debounced calculation for initial deposits (price-based)
  const debouncedCalculation = debounce(async (inputIndex: 0 | 1, value: string) => {
    const calculationId = ++state.calculationId;
    const outputIndex = inputIndex === 0 ? 1 : 0;

    // Clear output if input is empty
    if (!value || isNaN(parseFloat(value)) || parseFloat(value) <= 0) {
      liquidityStore.setAmount(outputIndex, "");
      return;
    }

    // Only calculate if we have an initial price set
    if (!$liquidityStore.initialPrice || parseFloat($liquidityStore.initialPrice) <= 0) {
      return;
    }

    try {
      state.isCalculating = true;
      abortController = new AbortController();

      const price = $liquidityStore.initialPrice;
      let calculatedAmount = "";

      if (inputIndex === 0) {
        // Calculate token1 from token0 and price
        calculatedAmount = calculateToken1FromPrice(value, price);
      } else {
        // Calculate token0 from token1 and price
        calculatedAmount = calculateToken0FromPrice(value, price);
      }

      // Check if calculation is still valid
      if (abortController.signal.aborted || calculationId !== state.calculationId) return;

      // Update the opposite amount in the store
      liquidityStore.setAmount(outputIndex, calculatedAmount);

    } catch (err: any) {
      if (calculationId === state.calculationId) {
        state.error = err.message || "Calculation failed";
      }
    } finally {
      if (calculationId === state.calculationId) {
        state.isCalculating = false;
      }
    }
  }, 150);

  // Handle formatted input
  function handleFormattedInput(index: 0 | 1, event: Event) {
    // Cancel pending operations
    abortController?.abort();
    debounceTimer && clearTimeout(debounceTimer);

    const input = event.target as HTMLInputElement;
    const cursorPosition = input.selectionStart || 0;

    const result = handleFormattedNumberInput(
      input.value,
      cursorPosition,
      state.displayValues[index],
    );

    // Update display value immediately
    state.displayValues[index] = result.formattedValue;
    state.error = null;

    // Maintain cursor position
    requestAnimationFrame(() => {
      input.setSelectionRange(
        result.newCursorPosition,
        result.newCursorPosition,
      );
    });

    // Update store immediately with raw value
    liquidityStore.setAmount(index, result.rawValue);

    // Debounce the cross-calculation
    debouncedCalculation(index, result.rawValue);
  }

  // Handle percentage clicks
  async function handlePercentageClick(index: 0 | 1, percentage: number) {
    const token = index === 0 ? token0 : token1;
    const balance = balances[index];
    
    if (!token || !balance) return;
    
    try {
      const amount = calculateAmountFromPercentage(token, balance, percentage);
      
      // Update display value and store
      state.displayValues[index] = formatWithCommas(amount);
      liquidityStore.setAmount(index, amount);
      
      // Update input element
      const inputElement = index === 0 ? input0Element : input1Element;
      if (inputElement) {
        inputElement.value = state.displayValues[index];
      }

      // Calculate opposite amount
      debouncedCalculation(index, amount);

    } catch (error) {
      toastStore.error("Failed to calculate amount");
    }
  }

  // Check if amounts are entered
  let hasAmount0 = $derived($liquidityStore.amount0 && parseFloat($liquidityStore.amount0) > 0);
  let hasAmount1 = $derived($liquidityStore.amount1 && parseFloat($liquidityStore.amount1) > 0);

  // Balance validation
  let validation = $derived.by(() => {
    const exceeding = [
      token0 && $liquidityStore.amount0 && !isNaN(parseFloat($liquidityStore.amount0)) 
        ? new BigNumber($liquidityStore.amount0).gt(parsedBalances[0]) : false,
      token1 && $liquidityStore.amount1 && !isNaN(parseFloat($liquidityStore.amount1)) 
        ? new BigNumber($liquidityStore.amount1).gt(parsedBalances[1]) : false
    ];

    const errorMessage = exceeding[0] && exceeding[1] 
      ? `Insufficient balance for both ${token0?.symbol} and ${token1?.symbol}`
      : exceeding[0] ? `Insufficient ${token0?.symbol} balance`
      : exceeding[1] ? `Insufficient ${token1?.symbol} balance`
      : null;

    return { exceeding, anyExceeding: exceeding[0] || exceeding[1], errorMessage };
  });

  // Add liquidity handler
  async function handleAddLiquidity() {
    if (!$liquidityStore.amount0 || !$liquidityStore.amount1) {
      state.error = "Please enter valid amounts";
      return;
    }

    if (validation.anyExceeding) {
      state.error = validation.errorMessage || "Insufficient balance";
      return;
    }

    if (!$liquidityStore.initialPrice || parseFloat($liquidityStore.initialPrice) <= 0) {
      state.error = "Please set an initial price";
      return;
    }

    const amounts = [
      parseTokenAmount($liquidityStore.amount0, token0?.decimals || 8),
      parseTokenAmount($liquidityStore.amount1, token1?.decimals || 8)
    ];

    if (!amounts[0] || !amounts[1]) {
      state.error = "Invalid amounts";
      return;
    }

    state.error = null;
    onShowConfirmModal?.();
  }

  // Cleanup effect
  $effect(() => {
    return () => {
      debounceTimer && clearTimeout(debounceTimer);
      abortController?.abort();
    };
  });
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
              {token0 ? formatBalance(balances[0], token0.decimals) : "0.00"}
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
            value={state.displayValues[0]}
            oninput={(e) => handleFormattedInput(0, e)}
            disabled={!token0 || state.isCalculating}
          />
          {#if token0}
            <span class="input-currency">{token0.symbol}</span>
          {/if}
        </div>

        <!-- Percentage Buttons -->
        <div class="flex items-center justify-between">
          <span class="text-xs text-kong-text-primary/60">Quick amounts:</span>
          <div class="percentage-buttons">
            {#if token0 && parsedBalances[0].gt(0)}
              <button onclick={() => handlePercentageClick(0, 25)} class="percentage-btn">25%</button>
              <button onclick={() => handlePercentageClick(0, 50)} class="percentage-btn">50%</button>
              <button onclick={() => handlePercentageClick(0, 75)} class="percentage-btn">75%</button>
              <button onclick={() => handlePercentageClick(0, 100)} class="percentage-btn max-btn">MAX</button>
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
              {token1 ? formatBalance(balances[1], token1.decimals) : "0.00"}
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
            value={state.displayValues[1]}
            oninput={(e) => handleFormattedInput(1, e)}
            disabled={!token1 || state.isCalculating}
          />
          {#if token1}
            <span class="input-currency">{token1.symbol}</span>
          {/if}
        </div>

        <!-- Percentage Buttons -->
        <div class="flex items-center justify-between">
          <span class="text-xs text-kong-text-primary/60">Quick amounts:</span>
          <div class="percentage-buttons">
            {#if token1 && parsedBalances[1].gt(0)}
              <button onclick={() => handlePercentageClick(1, 25)} class="percentage-btn">25%</button>
              <button onclick={() => handlePercentageClick(1, 50)} class="percentage-btn">50%</button>
              <button onclick={() => handlePercentageClick(1, 75)} class="percentage-btn">75%</button>
              <button onclick={() => handlePercentageClick(1, 100)} class="percentage-btn max-btn">MAX</button>
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

  <!-- Loading indicator -->
  {#if state.isCalculating}
    <div class="text-center">
      <div class="inline-flex items-center gap-2 text-xs text-kong-text-primary/60">
        <div class="w-3 h-3 border-2 border-kong-primary/20 border-t-kong-primary rounded-full animate-spin"></div>
        Calculating...
      </div>
    </div>
  {/if}

  <!-- Error message -->
  {#if state.error}
    <div class="error-message">
      <svg xmlns="http://www.w3.org/2000/svg" class="error-icon" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
      </svg>
      {state.error}
    </div>
  {/if}

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
            <span class="font-medium text-kong-text-primary">{state.displayValues[0] || "0"}</span>
          </div>
          <div class="flex justify-between">
            <span>Total {token1.symbol}:</span>
            <span class="font-medium text-kong-text-primary">{state.displayValues[1] || "0"}</span>
          </div>
          {#if $liquidityStore.initialPrice}
            <div class="flex justify-between border-t border-kong-border/10 pt-1 mt-2">
              <span>Initial Price:</span>
              <span class="font-medium text-kong-text-primary">1 {token0?.symbol} = {$liquidityStore.initialPrice} {token1?.symbol}</span>
            </div>
          {/if}
        </div>
      </Panel>
    </div>
  {/if}

  <!-- Validation Error Message -->
  {#if validation.errorMessage}
    <div class="warning-message" in:fly={{ y: 10, duration: 200 }}>
      <svg xmlns="http://www.w3.org/2000/svg" class="warning-icon" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
      {validation.errorMessage}
    </div>
  {/if}

  <!-- Action Button -->
  <div class="modal-footer">
    <div class="action-buttons">
      {#if validation.anyExceeding}
        <ButtonV2 theme="warning" variant="outline" size="lg" isDisabled={true} fullWidth={true}>
          <span>Insufficient Balance</span>
        </ButtonV2>
      {:else}
        <ButtonV2
          theme="accent-green"
          variant="solid"
          size="lg"
          isDisabled={!hasAmount0 || !hasAmount1 || !token0 || !token1 || !$liquidityStore.initialPrice || state.isCalculating}
          fullWidth={true}
          onclick={handleAddLiquidity}
        >
          {#if state.isCalculating}
            <div class="button-content">
              <div class="loading-spinner"></div>
              <span>Calculating...</span>
            </div>
          {:else}
            <span>Create Pool & Add Liquidity</span>
          {/if}
        </ButtonV2>
      {/if}
    </div>
  </div>
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

  .error-message {
    @apply p-3 rounded-lg bg-kong-error/10 border border-kong-error/20 
           text-kong-error text-xs backdrop-blur-sm flex items-center gap-2;
  }

  .error-icon {
    @apply w-4 h-4 flex-shrink-0;
  }

  .warning-message {
    @apply p-3 rounded-lg bg-kong-accent-yellow/10 border border-kong-accent-yellow/20 
           text-kong-accent-yellow text-xs backdrop-blur-sm flex items-center gap-2;
  }

  .warning-icon {
    @apply w-4 h-4 flex-shrink-0;
  }

  .modal-footer {
    @apply border-t border-kong-border/10 mt-4 w-full;
  }

  .action-buttons {
    @apply flex gap-2 w-full;
  }

  .button-content {
    @apply flex items-center justify-center;
  }

  .loading-spinner {
    @apply w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2;
  }
</style> 