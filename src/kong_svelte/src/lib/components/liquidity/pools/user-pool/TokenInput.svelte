<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { handleFormattedNumberInput } from "$lib/utils/formUtils";
  import { BigNumber } from "bignumber.js";
  import { calculateMaxAmount } from "$lib/utils/liquidityUtils";

  const dispatch = createEventDispatcher();

  export let token: any;
  export let tokenBalance: string = "0";
  export let displayValue: string = "";
  export let isExceedingBalance: boolean = false;
  export let isLoading: boolean = false;
  export let disabled: boolean = false;
  export let decimals: number = 8;
  export let parsedBalance: BigNumber = new BigNumber(0);

  let inputElement: HTMLInputElement;

  function handleFormattedInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const cursorPosition = input.selectionStart || 0;

    const result = handleFormattedNumberInput(
      input.value,
      cursorPosition,
      displayValue,
    );

    displayValue = result.formattedValue;
    dispatch("valueChange", result.rawValue);

    input.value = result.formattedValue;
    requestAnimationFrame(() => {
      input.setSelectionRange(
        result.newCursorPosition,
        result.newCursorPosition,
      );
    });
  }

  async function handlePercentageClick(percentage: number) {
    if (!token) return;

    try {
      if (!parsedBalance.isFinite() || parsedBalance.isLessThanOrEqualTo(0)) return;

      let result = "";
      
      if (percentage === 100) {
        // For MAX (100%), use the calculateMaxAmount utility which properly accounts for fees
        result = await calculateMaxAmount(token, tokenBalance, 1);
      } else {
        // For other percentages, just calculate the percentage of the balance
        const adjustedBalance = parsedBalance.times(percentage).div(100);
        result = adjustedBalance.gt(0)
          ? adjustedBalance.toFormat(decimals, BigNumber.ROUND_DOWN)
          : "0";
      }
      
      displayValue = result;
      
      if (inputElement) {
        inputElement.value = result;
      }
      
      dispatch("valueChange", result);
    } catch (error) {
      console.error("Error calculating percentage amount:", error);
      dispatch("error", error instanceof Error ? error.message : "Failed to calculate amount");
    }
  }
</script>

<div class="token-input-container {isExceedingBalance ? 'insufficient-balance-container' : ''}">
  <div class="relative flex-grow mb-2">
    <div class="input-with-token">
      {#if token}
        <img src={token.logo_url} alt={token.symbol} class="token-logo" />
      {/if}
      <input
        bind:this={inputElement}
        type="text"
        inputmode="decimal"
        pattern="[0-9]*"
        placeholder="0"
        class="amount-input {isExceedingBalance ? 'input-error' : ''}"
        value={displayValue}
        oninput={handleFormattedInput}
        {disabled}
      />
      {#if isLoading}
        <div class="loading-spinner ml-2"></div>
      {/if}
      {#if isExceedingBalance}
        <div class="warning-icon-container" title="Insufficient balance">
          <svg xmlns="http://www.w3.org/2000/svg" class="warning-icon-small" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </div>
      {/if}
    </div>
  </div>
  <div class="balance-info">
    <div class="available-balance {isExceedingBalance ? 'text-yellow-500' : ''}">
      <span class="balance-label">Available:</span>
      <span class="balance-amount">
        {token ? formatBalance(tokenBalance, decimals) : "0.00"}
        {token?.symbol || ""}
      </span>
    </div>
    <div class="percentage-buttons">
      {#if token && parsedBalance.gt(0)}
        <button 
          onclick={() => handlePercentageClick(25)}
          disabled={disabled}
        >25%</button>
        <button 
          onclick={() => handlePercentageClick(50)}
          disabled={disabled}
        >50%</button>
        <button 
          onclick={() => handlePercentageClick(75)}
          disabled={disabled}
        >75%</button>
        <button 
          onclick={() => handlePercentageClick(100)}
          disabled={disabled}
        >MAX</button>
      {:else}
        <button disabled>25%</button>
        <button disabled>50%</button>
        <button disabled>75%</button>
        <button disabled>MAX</button>
      {/if}
    </div>
  </div>
</div>

<style lang="postcss">
  .token-input-container {
    @apply bg-white/[0.02] rounded-xl p-3;
    @apply border border-white/[0.04] backdrop-blur-md;
    @apply transition-all duration-200;
    @apply hover:border-white/[0.06] hover:bg-white/[0.03];
  }

  .input-with-token {
    @apply flex items-center gap-3;
  }

  .token-logo {
    @apply w-8 h-8 rounded-full bg-black/20 object-contain flex-shrink-0;
    @apply border border-white/[0.03];
  }

  .amount-input {
    @apply w-full min-w-0 bg-transparent border-none;
    @apply text-[clamp(1.2rem,3vw,1.8rem)] font-medium tracking-tight;
    @apply relative z-10 p-0;
    @apply opacity-100 focus:outline-none focus:text-kong-text-primary;
    @apply disabled:text-kong-text-primary/70 placeholder:text-kong-text-primary/30;
  }

  .balance-info {
    @apply flex justify-between items-center mt-2;
  }

  .available-balance {
    @apply flex flex-col text-kong-text-primary/50;
    @apply text-[clamp(0.75rem,2vw,0.875rem)];
  }

  .balance-label {
    @apply text-xs text-kong-text-primary/40;
  }

  .balance-amount {
    @apply font-medium;
  }

  .percentage-buttons {
    @apply flex flex-wrap gap-1;
  }

  .percentage-buttons button {
    @apply px-1.5 py-0.5 text-xs rounded-md bg-white/[0.03] text-kong-text-primary/70
           hover:bg-white/[0.06] hover:text-kong-text-primary transition-all duration-200
           disabled:opacity-40 disabled:hover:bg-white/[0.03] disabled:hover:text-kong-text-primary/70;
    @apply border border-white/[0.04];
  }

  .input-error {
    @apply border-yellow-500/50 bg-yellow-500/5;
  }
  
  .insufficient-balance-container {
    @apply border-yellow-500/50 !important;
    @apply shadow-[0_0_0_1px_rgba(234,179,8,0.5)];
    @apply transition-all duration-200;
    animation: pulse-border 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse-border {
    0%, 100% {
      border-color: rgba(234, 179, 8, 0.5);
      box-shadow: 0 0 0 1px rgba(234, 179, 8, 0.5);
    }
    50% {
      border-color: rgba(234, 179, 8, 0.8);
      box-shadow: 0 0 0 2px rgba(234, 179, 8, 0.3);
    }
  }

  .warning-icon-container {
    @apply flex items-center justify-center;
    @apply text-yellow-500;
    @apply ml-2;
  }

  .warning-icon-small {
    @apply w-5 h-5;
    @apply animate-pulse-slow;
  }

  .loading-spinner {
    @apply w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2;
  }
</style> 