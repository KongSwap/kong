<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { BigNumber } from "bignumber.js";
  import { parseTokenAmount, calculateTokenUsdValue } from "$lib/utils/numberFormatUtils";
  import { currentUserBalancesStore } from "$lib/stores/balancesStore";
  import { liquidityStore } from "$lib/stores/liquidityStore";
  import TokenInput from "./TokenInput.svelte";
  import { calculateLiquidityAmounts } from "$lib/api/pools";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";

  interface Props {
    pool: any;
    token0: any;
    token1: any;
    onShowConfirmModal: () => void;
  }

  let { pool, token0, token1, onShowConfirmModal }: Props = $props();

  // Unified state for atomic updates
  let state = $state({
    amounts: ["", ""] as [string, string],
    displayValues: ["", ""] as [string, string],
    isCalculating: false,
    error: null as string | null,
    calculationId: 0
  });

  // Async management
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let abortController: AbortController | null = null;

  // Token balances
  let balances = $derived([
    token0?.address ? $currentUserBalancesStore[token0.address]?.in_tokens?.toString() || "0" : "0",
    token1?.address ? $currentUserBalancesStore[token1.address]?.in_tokens?.toString() || "0" : "0"
  ]);

  // Parsed balances
  let parsedBalances = $derived([
    token0 ? new BigNumber(balances[0]).div(new BigNumber(10).pow(token0.decimals)) : new BigNumber(0),
    token1 ? new BigNumber(balances[1]).div(new BigNumber(10).pow(token1.decimals)) : new BigNumber(0)
  ]);

  // Balance validation
  let validation = $derived.by(() => {
    const exceeding = [
      token0 && state.amounts[0] && !isNaN(parseFloat(state.amounts[0])) 
        ? new BigNumber(state.amounts[0]).gt(parsedBalances[0]) : false,
      token1 && state.amounts[1] && !isNaN(parseFloat(state.amounts[1])) 
        ? new BigNumber(state.amounts[1]).gt(parsedBalances[1]) : false
    ];

    const errorMessage = exceeding[0] && exceeding[1] 
      ? `Insufficient balance for both ${token0?.symbol} and ${token1?.symbol}`
      : exceeding[0] ? `Insufficient ${token0?.symbol} balance`
      : exceeding[1] ? `Insufficient ${token1?.symbol} balance`
      : null;

    return { exceeding, anyExceeding: exceeding[0] || exceeding[1], errorMessage };
  });

  // Input handler with debouncing and cancellation
  function handleAmountChange(inputIndex: 0 | 1, value: string) {
    // Cancel pending operations
    abortController?.abort();
    debounceTimer && clearTimeout(debounceTimer);

    // Immediate UI update
    state.displayValues[inputIndex] = value;
    state.error = null;

    // Debounced calculation
    debounceTimer = setTimeout(() => calculateAmount(inputIndex, value), 300);
  }

  // Atomic calculation with proper cancellation
  async function calculateAmount(inputIndex: 0 | 1, value: string) {
    const calculationId = ++state.calculationId;
    const outputIndex = inputIndex === 0 ? 1 : 0;

    // Clear output if input is empty
    if (!value || isNaN(parseFloat(value)) || parseFloat(value) <= 0) {
      state.amounts = ["", ""];
      state.displayValues[outputIndex] = "";
      liquidityStore.setAmount(0, "");
      liquidityStore.setAmount(1, "");
      return;
    }

    try {
      state.isCalculating = true;
      abortController = new AbortController();

      const tokens = [token0, token1];
      const inputAmount = parseTokenAmount(value, tokens[inputIndex].decimals);
      if (!inputAmount) return;

      const result = await calculateLiquidityAmounts(
        tokens[inputIndex].address,
        inputAmount,
        tokens[outputIndex].address
      );

      // Check if calculation is still valid
      if (abortController.signal.aborted || calculationId !== state.calculationId) return;

      if ('Ok' in result) {
        const outputAmount = (
          Number(inputIndex === 0 ? result.Ok.amount_1 : result.Ok.amount_0) / 
          Math.pow(10, tokens[outputIndex].decimals)
        ).toString();

        // Atomic state update
        state.amounts[inputIndex] = value;
        state.amounts[outputIndex] = outputAmount;
        state.displayValues[outputIndex] = outputAmount;

        // Update store
        liquidityStore.setAmount(0, state.amounts[0]);
        liquidityStore.setAmount(1, state.amounts[1]);
      }
    } catch (err: any) {
      if (calculationId === state.calculationId) {
        state.error = err.message || "Calculation failed";
      }
    } finally {
      if (calculationId === state.calculationId) {
        state.isCalculating = false;
      }
    }
  }

  // Add liquidity handler
  async function handleAddLiquidity() {
    if (!state.amounts[0] || !state.amounts[1]) {
      state.error = "Please enter valid amounts";
      return;
    }

    if (validation.anyExceeding) {
      state.error = validation.errorMessage || "Insufficient balance";
      return;
    }

    const amounts = [
      parseTokenAmount(state.amounts[0], token0.decimals),
      parseTokenAmount(state.amounts[1], token1.decimals)
    ];

    if (!amounts[0] || !amounts[1]) {
      state.error = "Invalid amounts";
      return;
    }

    state.error = null;
    onShowConfirmModal();
  }

  // Cleanup effect
  $effect(() => {
    return () => {
      debounceTimer && clearTimeout(debounceTimer);
      abortController?.abort();
    };
  });
</script>

<div in:fade={{ duration: 200 }} class="add-liquidity-container">
  <TokenInput
    token={token0}
    tokenBalance={balances[0]}
    bind:displayValue={state.displayValues[0]}
    isExceedingBalance={validation.exceeding[0]}
    isLoading={false}
    disabled={state.isCalculating}
    decimals={token0?.decimals || 8}
    parsedBalance={parsedBalances[0]}
    on:valueChange={(e) => handleAmountChange(0, e.detail)}
    on:error={(e) => (state.error = e.detail)}
  />

  <div class="mt-3">
    <TokenInput
      token={token1}
      tokenBalance={balances[1]}
      bind:displayValue={state.displayValues[1]}
      isExceedingBalance={validation.exceeding[1]}
      isLoading={state.isCalculating}
      disabled={state.isCalculating}
      decimals={token1?.decimals || 8}
      parsedBalance={parsedBalances[1]}
      on:valueChange={(e) => handleAmountChange(1, e.detail)}
      on:error={(e) => (state.error = e.detail)}
    />
  </div>

  {#if state.amounts[0] && state.amounts[1]}
    <div class="summary-container mt-3">
      <div class="summary-row">
        <span>Rate</span>
        <span class="summary-value">
          1 {token0?.symbol} = {Number(state.amounts[1]) / Number(state.amounts[0])} {token1?.symbol}
        </span>
      </div>
      <div class="summary-row">
        <span>Value</span>
        <span class="summary-value">
          ${Number(calculateTokenUsdValue(state.amounts[0], token0)) + 
            Number(calculateTokenUsdValue(state.amounts[1], token1))}
        </span>
      </div>
    </div>
  {/if}

  {#if state.error}
    <div class="error-message mt-3" in:fly={{ y: 10, duration: 200 }}>
      <svg xmlns="http://www.w3.org/2000/svg" class="error-icon" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
      </svg>
      {state.error}
    </div>
  {/if}

  {#if validation.errorMessage}
    <div class="warning-message mt-3 animate-pulse-slow" in:fly={{ y: 10, duration: 200 }}>
      <svg xmlns="http://www.w3.org/2000/svg" class="warning-icon" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
      {validation.errorMessage}
    </div>
  {/if}

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
          isDisabled={!state.amounts[0] || !state.amounts[1] || state.isCalculating}
          fullWidth={true}
          onclick={handleAddLiquidity}
        >
          {#if state.isCalculating}
            <div class="button-content">
              <div class="loading-spinner"></div>
              <span>Calculating...</span>
            </div>
          {:else}
            <span>Add Liquidity</span>
          {/if}
        </ButtonV2>
      {/if}
    </div>
  </div>
</div>

<style lang="postcss" scoped>
  .add-liquidity-container {
    @apply flex flex-col gap-3;
  }

  .summary-container {
    @apply p-3 rounded-lg bg-kong-bg-secondary/50 backdrop-blur-sm 
           border border-kong-border/10 space-y-2;
  }

  .summary-row {
    @apply flex justify-between items-center text-sm;
  }

  .summary-value {
    @apply font-medium text-kong-text-primary;
  }

  .error-message {
    @apply p-3 rounded-lg bg-kong-error/10 border border-kong-error/20 
           text-kong-error text-xs backdrop-blur-sm flex items-center gap-2;
  }

  .warning-message {
    @apply p-3 rounded-lg bg-kong-accent-yellow/10 border border-kong-accent-yellow/20 
           text-kong-accent-yellow text-xs backdrop-blur-sm flex items-center gap-2;
  }

  .error-icon,
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
