<!-- Description: This is the SwapPanel component that displays the swap input fields and token selector. -->
<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { t } from "$lib/locales/translations";
  import { tokenStore } from "$lib/stores/tokenStore";
  import { formatTokenAmount } from "$lib/utils/numberFormatUtils";
  import { toastStore } from "$lib/stores/toastStore";
  
  export let title: string;
  export let token: string;
  export let amount: string = "0";
  export let onTokenSelect: () => void;
  export let onAmountChange: (event: Event) => void;
  export let disabled = false;
  export let showPrice = false;
  export let usdValue = "0";
  export let slippage = 0;
  export let maxSlippage = 2; // Default max slippage value
  export let estimatedGasFee: string = "0";

  $: tokenInfo = $tokenStore.tokens?.find(t => t.symbol === token);
  $: decimals = tokenInfo?.decimals || 8;

  $: balance = (() => {
    if (!tokenInfo?.canister_id) return "0";
    const balanceInfo = $tokenStore.balances[tokenInfo.canister_id];
    const rawBalance = balanceInfo?.in_tokens;
    return formatTokenAmount(rawBalance, decimals);
  })();

  $: isOverBalance = parseFloat(amount || "0") > parseFloat(balance?.toString() || "0");

  $: if (isOverBalance && title === "You Pay") {
    toastStore.error("Insufficient balance");
  }

  const animatedUsdValue = tweened(0, {
    duration: 400,
    easing: cubicOut,
  });

  const animatedAmount = tweened(0, {
    duration: 400,
    easing: cubicOut,
  });

  const animatedSlippage = tweened(0, {
    duration: 400,
    easing: cubicOut,
  });

  const animatedBalance = tweened(0, {
    duration: 400,
    easing: cubicOut,
  });

  $: {
    animatedUsdValue.set(parseFloat(usdValue));
    animatedAmount.set(parseFloat(amount || "0"), {
      duration: 400
    });
    animatedSlippage.set(slippage);
    animatedBalance.set(parseFloat(balance?.toString() || "0"));
  }

  let inputFocused = false;
  let showSlippageTooltip = false;
  let isAnimating = false;
  let inputElement: HTMLInputElement;

  function handleMaxClick() {
    if (!disabled && title === "You Pay") {
      try {
        // Add safety buffer for gas (e.g. 1.1x the estimated gas fee)
        const GAS_SAFETY_MARGIN = 1.01;
        
        // Convert balance and gas fee to numbers with additional safety checks
        const balanceNum = parseFloat(balance || "0");
        const gasFeeNum = parseFloat(estimatedGasFee || "0") * GAS_SAFETY_MARGIN;
        
        if (isNaN(balanceNum) || isNaN(gasFeeNum)) {
          console.error("Invalid balance or gas fee values", { balance, estimatedGasFee });
          toastStore.error("Error calculating maximum amount");
          return;
        }

        // Calculate max amount that can be swapped
        const maxSwappable = Math.max(0, balanceNum - gasFeeNum);
        
        // Add additional check for minimum viable amount
        if (maxSwappable <= gasFeeNum) {
          toastStore.error("Insufficient balance to cover gas fees");
          return;
        }
        
        // Round down slightly to provide extra safety margin for floating point precision
        const safeMaxAmount = maxSwappable * 0.99;
        
        // Format to avoid floating point precision issues
        const targetValue = safeMaxAmount <= 0 ? "0" : safeMaxAmount.toFixed(decimals);
        
        console.log("Max calculation:", {
          balance: balanceNum,
          gasFee: gasFeeNum,
          maxSwappable,
          safeMaxAmount,
          targetValue
        });

        isAnimating = true;

        // Update the store/parent component
        const event = new CustomEvent('input', {
          bubbles: true,
          detail: { value: targetValue }
        });
        onAmountChange(event);

        // Animate to target value
        animatedAmount.set(parseFloat(targetValue), {
          duration: 400,
          easing: cubicOut
        }).then(() => {
          isAnimating = false;
          if (inputElement) {
            inputElement.value = targetValue;
          }
        });
      } catch (error) {
        console.error("Error in handleMaxClick:", error);
        toastStore.error("Error calculating maximum amount");
      }
    }
  }

  function handleInput(e: Event) {
    if (title === "You Receive") {
      return;
    }
    
    try {
      const input = e.target as HTMLInputElement;
      const newValue = input.value;
      const numValue = parseFloat(newValue || "0");
      
      // Validate input amount against balance and gas fees
      const balanceNum = parseFloat(balance || "0");
      const gasFeeNum = parseFloat(estimatedGasFee || "0") * 1.1; // Add 10% safety margin
      
      if (numValue > (balanceNum - gasFeeNum)) {
        toastStore.warning("Amount exceeds maximum swappable balance (including gas fees)");
      }
      
      isAnimating = false;
      onAmountChange(e);
      animatedAmount.set(numValue, { duration: 0 });
      
    } catch (error) {
      console.error("Error in handleInput:", error);
      toastStore.error("Invalid input amount");
    }
  }

  // Add reactive statement to validate amount changes
  $: {
    if (amount && title === "You Pay") {
      const inputAmount = parseFloat(amount);
      const balanceNum = parseFloat(balance || "0");
      const gasFeeNum = parseFloat(estimatedGasFee || "0") * 1.1;
      
      if (inputAmount > (balanceNum - gasFeeNum)) {
        toastStore.warning("Insufficient balance for transaction including gas fees");
      }
    }
  }
</script>

<Panel variant="green" width="600px" height="305px" className="token-panel">
  <div class="panel-content" class:input-focused={inputFocused}>
    <header class="panel-header">
      <div class="title-container">
        <h2 class="text-4xl font-bold">{title}</h2>
      </div>
      {#if showPrice && amount && amount !== "0" && slippage > 0}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="relative flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium"
          class:bg-red-100={$animatedSlippage > maxSlippage}
          class:bg-green-100={$animatedSlippage <= maxSlippage}
          class:text-red-600={$animatedSlippage > maxSlippage}
          class:text-green-600={$animatedSlippage <= maxSlippage}
          on:mouseenter={() => (showSlippageTooltip = true)}
          on:mouseleave={() => (showSlippageTooltip = false)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            {#if $animatedSlippage <= maxSlippage}
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            {:else}
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            {/if}
          </svg>
          <span>{$animatedSlippage.toFixed(2)}% slippage</span>
        </div>
      {/if}
    </header>

    <div class="input-section flex flex-col justify-center" class:disabled>
      <div class="amount-container">
        <input
          bind:this={inputElement}
          type="text"
          class="amount-input"
          class:error={isOverBalance && title === "You Pay"}
          value={isAnimating ? $animatedAmount.toFixed(decimals) : amount}
          on:input={handleInput}
          on:focus={() => inputFocused = true}
          on:blur={() => inputFocused = false}
          placeholder="0"
          disabled={disabled || title === "You Receive"}
          readonly={title === "You Receive"}
        />
        <div class="token-selector">
          <button
            class="token-button"
            on:click={onTokenSelect}
            type="button"
          >
            <span class="token-text">{token}</span>
            <span class="chevron">▼</span>
          </button>
        </div>
      </div>
    </div>

    {#if showPrice}
      <div class="price-container">
        <div class="usd-value">
          <span class="dollar-sign">≈ $</span>{$animatedUsdValue.toFixed(2)}
        </div>
      </div>
    {/if}

    <footer class="balance-display">
      <div class="balance-text">
        <span>{$t('swap.available')}</span>
        <div class="balance-info">
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <span class="balance-amount" on:click={handleMaxClick}>
            {balance} {token}
          </span>
          {#if parseFloat(estimatedGasFee) > 0}
            <div class="gas-fee-tooltip">
              <span class="tooltip-text">
                <div class="fee-breakdown">
                  <div>Gas Fee: {parseFloat(estimatedGasFee).toFixed(decimals)} {token}</div>
                  <div>Safety Margin: 10%</div>
                  <div class="max-available">
                    Max Available: {(parseFloat(balance) - parseFloat(estimatedGasFee) * 1.1).toFixed(decimals)} {token}
                  </div>
                </div>
              </span>
            </div>
          {/if}
        </div>
      </div>
    </footer>
  </div>
</Panel>

<style>
  * {
    font-family: "Alumni Sans", sans-serif;
  }

  .panel-content {
    transition: transform 0.3s ease;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.5rem;
    position: relative;
    flex-wrap: wrap;
  }

  .title-container {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .price-container {
    margin-top: auto;
    padding-top: 0.5rem;
  }

  .usd-value {
    @apply font-alumni text-outline-1;
    font-size: 1.25rem;
    color: #ffcd1f;
    font-weight: 500;
    display: block !important;
    visibility: visible !important;
  }

  .dollar-sign {
    opacity: 0.8;
    margin-right: 2px;
  }

  .input-section {
    position: relative;
    margin: 0.5rem 0;
    flex-grow: 1;
  }

  .amount-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    padding: 0.5rem 0.75rem;
    transition: all 0.3s ease;
  }

  .amount-input {
    background: transparent;
    border: none;
    font-size: 4rem;
    color: white;
    width: 100%;
    padding: 0;
    font-weight: 300;
    text-overflow: ellipsis;
  }

  .amount-input.error {
    color: #e74c3c;
    animation: shake 0.5s;
  }

  .amount-input:focus {
    outline: none;
  }

  .amount-input::placeholder {
    color: white;
    opacity: 1;
  }

  .token-selector {
    min-width: 120px;
  }

  .token-button {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 0.05rem 0.75rem;
    color: white;
    font-size: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: all 0.3s ease;
    cursor: pointer;
    width: 100%;
  }

  .token-text {
    margin-right: auto;
  }

  .token-button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-1px);
  }

  .chevron {
    font-size: 0.7rem;
    opacity: 0.6;
    transition: transform 0.3s ease;
  }

  .token-button:hover .chevron {
    transform: translateY(1px);
  }

  .disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .balance-display {
    margin-top: auto;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .balance-text {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: rgba(255, 255, 255, 0.5);
    font-size: 1rem;
  }

  .balance-amount {
    color: rgba(255, 255, 255, 0.8);
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    transition: color 0.3s ease;
  }

  .balance-amount:hover {
    color: #ffcd1f;
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }

  .balance-info {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .gas-fee-tooltip {
    position: relative;
    display: inline-block;
    cursor: help;
  }

  .gas-fee-tooltip::after {
    content: "ⓘ";
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .tooltip-text {
    visibility: hidden;
    position: absolute;
    bottom: 100%;
    right: 0;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    white-space: nowrap;
    z-index: 10;
  }

  .gas-fee-tooltip:hover .tooltip-text {
    visibility: visible;
  }

  .fee-breakdown {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .max-available {
    margin-top: 0.25rem;
    padding-top: 0.25rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    font-weight: 500;
  }
</style>
