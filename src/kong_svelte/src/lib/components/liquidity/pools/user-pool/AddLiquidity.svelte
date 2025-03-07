<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { BigNumber } from "bignumber.js";
  import { parseTokenAmount } from "$lib/utils/numberFormatUtils";
  import { currentUserBalancesStore } from "$lib/stores/tokenStore";
  import { liquidityStore } from "$lib/stores/liquidityStore";
  import { calculateTokenUsdValue } from "$lib/utils/numberFormatUtils";
  import TokenInput from "./TokenInput.svelte";
  import { calculateLiquidityAmounts } from "$lib/api/pools";

  const dispatch = createEventDispatcher();

  export let pool: any;
  export let token0: any;
  export let token1: any;

  // Add liquidity state variables
  let addAmount0 = "";
  let addAmount1 = "";
  let displayValue0 = "";
  let displayValue1 = "";
  let isAddingLiquidity = false;
  let isCalculatingAdd = false;
  let addError: string | null = null;

  // Debounce timers
  let debounceTimer0: ReturnType<typeof setTimeout> | null = null;
  let debounceTimer1: ReturnType<typeof setTimeout> | null = null;
  const DEBOUNCE_DELAY = 500; // 750ms debounce delay

  // Get token balances
  $: token0Balance = token0?.canister_id
    ? $currentUserBalancesStore[token0.canister_id]?.in_tokens?.toString() ||
      "0"
    : "0";
  $: token1Balance = token1?.canister_id
    ? $currentUserBalancesStore[token1.canister_id]?.in_tokens?.toString() ||
      "0"
    : "0";

  // Parse token balances for UI display and button enabling
  $: parsedToken0Balance =
    token0 && token0Balance
      ? new BigNumber(token0Balance).div(new BigNumber(10).pow(token0.decimals))
      : new BigNumber(0);
  $: parsedToken1Balance =
    token1 && token1Balance
      ? new BigNumber(token1Balance).div(new BigNumber(10).pow(token1.decimals))
      : new BigNumber(0);

  // Add reactive variables to check if amounts exceed balances
  $: isToken0Exceeding =
    token0 && addAmount0 && !isNaN(parseFloat(addAmount0))
      ? new BigNumber(addAmount0).gt(parsedToken0Balance)
      : false;
  $: isToken1Exceeding =
    token1 && addAmount1 && !isNaN(parseFloat(addAmount1))
      ? new BigNumber(addAmount1).gt(parsedToken1Balance)
      : false;
  $: isAnyTokenExceeding = isToken0Exceeding || isToken1Exceeding;

  // Generate appropriate error message based on which token exceeds balance
  $: balanceErrorMessage = (() => {
    if (isToken0Exceeding && isToken1Exceeding) {
      return `Insufficient balance for both ${token0?.symbol} and ${token1?.symbol}`;
    } else if (isToken0Exceeding) {
      return `Insufficient ${token0?.symbol} balance`;
    } else if (isToken1Exceeding) {
      return `Insufficient ${token1?.symbol} balance`;
    }
    return null;
  })();

  // Debounced handler for amount changes
  function handleAddAmountChangeDebounced(index: 0 | 1, value: string) {
    // Update the display value immediately for better UX
    if (index === 0) {
      displayValue0 = value;
      // Clear any existing timer
      if (debounceTimer0) clearTimeout(debounceTimer0);
      // Set a new timer
      debounceTimer0 = setTimeout(() => {
        handleAddAmountChange(index, value);
      }, DEBOUNCE_DELAY);
    } else {
      displayValue1 = value;
      // Clear any existing timer
      if (debounceTimer1) clearTimeout(debounceTimer1);
      // Set a new timer
      debounceTimer1 = setTimeout(() => {
        handleAddAmountChange(index, value);
      }, DEBOUNCE_DELAY);
    }
  }

  async function handleAddAmountChange(index: 0 | 1, value: string) {
    if (index === 0) {
      addAmount0 = value;
      liquidityStore.setAmount(0, value);

      // Calculate token1 amount based on pool ratio
      if (value && !isNaN(parseFloat(value)) && parseFloat(value) > 0) {
        try {
          addError = null;
          isCalculatingAdd = true;

          const amount0 = parseTokenAmount(value, token0.decimals);
          if (!amount0) return;

          const result = await calculateLiquidityAmounts(
            token0.canister_id,
            amount0,
            token1.canister_id,
          );

          if (result.Ok) {
            // Convert the BigInt amount to display format
            const amount1Display = (
              Number(result.Ok.amount_1) / Math.pow(10, token1.decimals)
            ).toString();

            addAmount1 = amount1Display;
            liquidityStore.setAmount(1, amount1Display);
            displayValue1 = amount1Display;
          }
        } catch (err) {
          console.error("Error calculating liquidity amounts:", err);
          addError = err.message || "Failed to calculate amounts";
        } finally {
          isCalculatingAdd = false;
        }
      } else {
        addAmount1 = "";
        liquidityStore.setAmount(1, "");
        displayValue1 = "";
      }
    } else {
      // Handle token1 input
      addAmount1 = value;
      liquidityStore.setAmount(1, value);

      // Calculate token0 amount based on pool ratio
      if (value && !isNaN(parseFloat(value)) && parseFloat(value) > 0) {
        try {
          addError = null;
          isCalculatingAdd = true;

          const amount1 = parseTokenAmount(value, token1.decimals);
          if (!amount1) return;

          // Use the pool service to calculate the corresponding token0 amount
          const result = await calculateLiquidityAmounts(
            token1.canister_id,
            amount1,
            token0.canister_id,
          );

          if (result.Ok) {
            // When we pass token1 first, the result.Ok.amount_0 is what we need
            // This is because the backend swaps the order internally if needed
            const amount0Display = (
              Number(result.Ok.amount_0) / Math.pow(10, token0.decimals)
            ).toString();

            addAmount0 = amount0Display;
            liquidityStore.setAmount(0, amount0Display);
            displayValue0 = amount0Display;
          }
        } catch (err) {
          console.error("Error calculating reverse liquidity amounts:", err);
          addError = err.message || "Failed to calculate amounts";
        } finally {
          isCalculatingAdd = false;
        }
      } else {
        addAmount0 = "";
        liquidityStore.setAmount(0, "");
        displayValue0 = "";
      }
    }
  }

  async function handleAddLiquidity() {
    if (!addAmount0 || !token0 || !token1) {
      addError = "Please enter a valid amount";
      return;
    }

    if (isAnyTokenExceeding) {
      addError = balanceErrorMessage || "Insufficient balance";
      return;
    }

    try {
      addError = null;

      const amount0 = parseTokenAmount(addAmount0, token0.decimals);
      const amount1 = parseTokenAmount(addAmount1, token1.decimals);

      if (!amount0 || !amount1) {
        throw new Error("Invalid amounts");
      }

      dispatch("showConfirmModal");
    } catch (err) {
      console.error("Error preparing to add liquidity:", err);
      addError = err.message || "Failed to prepare transaction";
    }
  }
</script>

<div in:fade={{ duration: 200 }} class="add-liquidity-container">
  <TokenInput
    token={token0}
    tokenBalance={token0Balance}
    bind:displayValue={displayValue0}
    isExceedingBalance={isToken0Exceeding}
    isLoading={false}
    disabled={isAddingLiquidity || isCalculatingAdd}
    decimals={token0?.decimals || 8}
    parsedBalance={parsedToken0Balance}
    on:valueChange={(e) => handleAddAmountChangeDebounced(0, e.detail)}
    on:error={(e) => (addError = e.detail)}
  />

  <div class="mt-3">
    <TokenInput
      token={token1}
      tokenBalance={token1Balance}
      bind:displayValue={displayValue1}
      isExceedingBalance={isToken1Exceeding}
      isLoading={isCalculatingAdd}
      disabled={isAddingLiquidity || isCalculatingAdd}
      decimals={token1?.decimals || 8}
      parsedBalance={parsedToken1Balance}
      on:valueChange={(e) => handleAddAmountChangeDebounced(1, e.detail)}
      on:error={(e) => (addError = e.detail)}
    />
  </div>

  {#if addAmount0 && addAmount1}
    <div class="summary-container mt-3">
      <div class="summary-row">
        <span>Rate</span>
        <span class="summary-value"
          >1 {token0?.symbol} = {Number(addAmount1) / Number(addAmount0)}
          {token1?.symbol}</span
        >
      </div>
      <div class="summary-row">
        <span>Value</span>
        <span class="summary-value">
          ${Number(calculateTokenUsdValue(addAmount0, token0)) +
            Number(calculateTokenUsdValue(addAmount1, token1))}
        </span>
      </div>
    </div>
  {/if}

  {#if addError}
    <div class="error-message mt-3" in:fly={{ y: 10, duration: 200 }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="error-icon"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clip-rule="evenodd"
        />
      </svg>
      {addError}
    </div>
  {/if}

  {#if balanceErrorMessage}
    <div
      class="warning-message mt-3 animate-pulse-slow"
      in:fly={{ y: 10, duration: 200 }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="warning-icon"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clip-rule="evenodd"
        />
      </svg>
      {balanceErrorMessage}
    </div>
  {/if}

  <div class="modal-footer">
    <div class="action-buttons">
      {#if isAnyTokenExceeding}
        <!-- Custom insufficient balance button -->
        <button
          class="insufficient-balance-button action-button"
          disabled={true}
        >
          <span>Insufficient Balance</span>
        </button>
      {:else}
        <button
          on:click={handleAddLiquidity}
          class="action-button add-button"
          disabled={!addAmount0 ||
            !addAmount1 ||
            isAddingLiquidity ||
            isCalculatingAdd}
        >
          {#if isAddingLiquidity}
            <div class="loading-spinner"></div>
            <span>Adding...</span>
          {:else if isCalculatingAdd}
            <div class="loading-spinner"></div>
            <span>Calculating...</span>
          {:else}
            <span>Add Liquidity</span>
          {/if}
        </button>
      {/if}
    </div>
  </div>
</div>

<style lang="postcss">
  .add-liquidity-container {
    @apply flex flex-col gap-3;
  }

  .summary-container {
    @apply p-3 rounded-lg bg-kong-bg-light/50 backdrop-blur-sm 
           border border-kong-border/10 space-y-2;
  }

  .summary-row {
    @apply flex justify-between items-center text-sm;
  }

  .summary-value {
    @apply font-medium text-kong-text-primary;
  }

  .error-message {
    @apply p-3 rounded-lg bg-kong-accent-red/10 border border-kong-accent-red/20 
           text-kong-accent-red text-xs backdrop-blur-sm flex items-center gap-2;
  }

  .warning-message {
    @apply p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 
           text-yellow-500 text-xs backdrop-blur-sm flex items-center gap-2;
  }

  .error-icon,
  .warning-icon {
    @apply w-4 h-4 flex-shrink-0;
  }

  .modal-footer {
    @apply border-t border-kong-border/10 mt-4 bg-kong-bg-dark/90 
           backdrop-blur-md w-full;
  }

  .action-buttons {
    @apply flex gap-2 w-full;
  }

  :global(.action-button) {
    @apply !h-10 transition-all duration-200
           font-medium tracking-wide text-center flex items-center justify-center
           w-full !rounded-lg;
  }

  .add-button {
    @apply bg-kong-accent-green text-white hover:bg-kong-accent-green-hover;
  }

  .loading-spinner {
    @apply w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2;
  }

  .insufficient-balance-button {
    @apply bg-yellow-500/20 text-yellow-500 border border-yellow-500/30;
    @apply rounded-lg font-medium transition-all duration-200;
    @apply w-full h-10 flex items-center justify-center;
    @apply cursor-not-allowed opacity-80;
  }
</style>
