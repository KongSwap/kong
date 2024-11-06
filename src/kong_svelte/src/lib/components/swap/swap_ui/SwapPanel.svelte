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
          return;
        }

        // Calculate max amount that can be swapped
        const maxSwappable = Math.max(0, balanceNum - gasFeeNum);
        
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
      
      isAnimating = false;
      onAmountChange(e);
      animatedAmount.set(numValue, { duration: 0 });
      
    } catch (error) {
      console.error("Error in handleInput:", error);
      toastStore.error("Invalid input amount");
    }
  }

  // Add reactive statement to validate amount changes
  // TODO
  $: {
    if (amount && title === "You Pay") {
      const inputAmount = parseFloat(amount);
      const balanceNum = parseFloat(balance || "0");
      const gasFeeNum = parseFloat(estimatedGasFee || "0") * 1.1;
    }
  }

  // Add new computed values for slippage warning
  $: slippageWarning = showPrice && amount && amount !== "0" && slippage > maxSlippage;
  $: slippageClass = slippageWarning ? 'high-slippage' : 'normal-slippage';
</script>

<Panel variant="green" width="600px" height="305px" className="token-panel">
  <div class="panel-content" class:input-focused={inputFocused}>
    <header class="panel-header">
      <div class="title-container">
        <h2 class="panel-title">{title}</h2>
      </div>
      
      {#if showPrice && slippage > 0}
        <div 
          class="slippage-badge {slippageClass}"
          class:warning={slippageWarning}
        >
          <span class="slippage-value">{slippage.toFixed(2)}%</span>
          {#if slippageWarning}
            <span class="warning-icon">⚠️</span>
          {/if}
        </div>
      {/if}
    </header>

    <div class="input-section" class:disabled class:warning={slippageWarning}>
      <div class="amount-container" class:warning={slippageWarning}>
        <div class="token-logo">
          <img
            src={tokenInfo?.logo || "/tokens/not_verified.webp"}
            alt={token}
            class="token-image"
            loading="lazy"
          />
        </div>
        <input
          bind:this={inputElement}
          type="text"
          class="amount-input"
          class:error={isOverBalance && title === "You Pay"}
          class:warning={slippageWarning}
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
            class:warning={slippageWarning}
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
      <div class="price-info">
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
    align-items: center;
    margin-bottom: 0.5rem;
    position: relative;
    padding: 0.5rem;
    border-radius: 8px;
  }

  .title-container {
    display: flex;
    align-items: center;
    gap: 1rem;
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
    gap: 0.75rem;
    background: rgba(0, 0, 0, 0.2);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 0.75rem 1rem;
    transition: all 0.2s ease;
  }

  .amount-container:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(0, 0, 0, 0.25);
  }

  .amount-input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    color: white;
    font-size: 2.5rem;
    font-family: "Alumni Sans", sans-serif;
    padding: 0.5rem;
    width: 100%;
    text-shadow: 
      -1px -1px 0 rgba(0, 0, 0, 0.2),
      1px -1px 0 rgba(0, 0, 0, 0.2),
      -1px 1px 0 rgba(0, 0, 0, 0.2),
      1px 1px 0 rgba(0, 0, 0, 0.2);
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
    background: rgba(0, 0, 0, 0.2);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 0.5rem 1rem;
    color: white;
    font-size: 2rem;
    font-family: "Alumni Sans", sans-serif;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s ease;
    cursor: pointer;
    min-width: 140px;
  }

  .token-button:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(0, 0, 0, 0.25);
    transform: translateY(-1px);
  }

  .token-text {
    margin-right: auto;
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
    color: white;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.2s ease;
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

  .panel-title {
    font-size: 2rem;
    font-family: "Alumni Sans", sans-serif;
    color: white;
    margin: 0;
    padding: 0.5rem 0;
    text-shadow: 
      -1px -1px 0 rgba(0, 0, 0, 0.5),
      1px -1px 0 rgba(0, 0, 0, 0.5),
      -1px 1px 0 rgba(0, 0, 0, 0.5),
      1px 1px 0 rgba(0, 0, 0, 0.5);
  }

  .slippage-warning {
    font-size: 0.875rem;
    color: #FF1744;
    margin-top: 0.25rem;
    font-family: 'Aeonik Mono', 'Aluminium Sans', monospace;
  }

  .price-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: auto;
    padding-top: 0.5rem;
  }

  .slippage-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.875rem;
    font-family: 'Aeonik Mono', 'Aluminium Sans', monospace;
  }

  .normal-slippage {
    background: rgba(0, 230, 118, 0.1);
    color: #00E676;
  }

  .high-slippage {
    background: rgba(255, 23, 68, 0.1);
    color: #FF1744;
  }

  .warning-icon {
    font-size: 1rem;
  }

  .amount-container.warning {
    border: 1px solid rgba(255, 23, 68, 0.3);
    background: rgba(255, 23, 68, 0.05);
  }

  .token-button.warning {
    background: rgba(255, 23, 68, 0.1);
    border-color: rgba(255, 23, 68, 0.3);
  }

  .amount-input.warning {
    color: #FF1744;
  }

  .input-section.warning:hover .amount-container {
    border-color: rgba(255, 23, 68, 0.5);
  }

  .slippage-value {
    font-weight: 500;
  }

  .amount-container {
    border: 1px solid transparent;
    transition: all 0.2s ease;
  }

  .amount-container:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }

  .token-button {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid transparent;
  }

  .token-button:hover:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.2);
  }

  .slippage-banner {
    display: none;
  }

  .slippage-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.75rem;
    border-radius: 8px;
    font-family: 'Aeonik Mono', 'Aluminium Sans', monospace;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s ease;
    border: 2px solid transparent;
  }

  .slippage-badge.normal-slippage {
    background: rgba(0, 230, 118, 0.1);
    color: #00E676;
    border-color: rgba(0, 230, 118, 0.3);
    text-shadow: 
      -1px -1px 0 rgba(0, 0, 0, 0.5),
       1px -1px 0 rgba(0, 0, 0, 0.5),
      -1px  1px 0 rgba(0, 0, 0, 0.5),
       1px  1px 0 rgba(0, 0, 0, 0.5);
  }

  .slippage-badge.high-slippage {
    background: rgba(255, 23, 68, 0.1);
    color: #FF1744;
    border-color: #FF1744;
    animation: pulse 2s infinite;
    text-shadow: 
      -1px -1px 0 rgba(0, 0, 0, 0.5),
       1px -1px 0 rgba(0, 0, 0, 0.5),
      -1px  1px 0 rgba(0, 0, 0, 0.5),
       1px  1px 0 rgba(0, 0, 0, 0.5);
    box-shadow: 
      0 0 0 1px rgba(0, 0, 0, 0.2),
      0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .warning-icon {
    font-size: 1rem;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5));
  }

  @keyframes pulse {
    0%, 100% { 
      opacity: 1;
      transform: scale(1);
    }
    50% { 
      opacity: 0.8;
      transform: scale(0.95);
    }
  }

  .amount-container.warning {
    border: 2px solid rgba(255, 23, 68, 0.3);
    background: rgba(255, 23, 68, 0.05);
    box-shadow: 
      0 0 0 1px rgba(0, 0, 0, 0.2),
      0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .token-button.warning {
    background: rgba(255, 23, 68, 0.1);
    border: 2px solid rgba(255, 23, 68, 0.3);
    box-shadow: 
      0 0 0 1px rgba(0, 0, 0, 0.2),
      0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .slippage-indicator {
    text-shadow: 
      -1px -1px 0 rgba(0, 0, 0, 0.5),  
       1px -1px 0 rgba(0, 0, 0, 0.5),
      -1px  1px 0 rgba(0, 0, 0, 0.5),
       1px  1px 0 rgba(0, 0, 0, 0.5);
  }

  .amount-input {
    text-shadow: 
      -1px -1px 0 rgba(0, 0, 0, 0.2),
       1px -1px 0 rgba(0, 0, 0, 0.2),
      -1px  1px 0 rgba(0, 0, 0, 0.2),
       1px  1px 0 rgba(0, 0, 0, 0.2);
  }

  .usd-value {
    text-shadow: 
      -1px -1px 0 rgba(0, 0, 0, 0.3),
       1px -1px 0 rgba(0, 0, 0, 0.3),
      -1px  1px 0 rgba(0, 0, 0, 0.3),
       1px  1px 0 rgba(0, 0, 0, 0.3);
  }

  .balance-text {
    text-shadow: 
      -1px -1px 0 rgba(0, 0, 0, 0.3),
       1px -1px 0 rgba(0, 0, 0, 0.3),
      -1px  1px 0 rgba(0, 0, 0, 0.3),
       1px  1px 0 rgba(0, 0, 0, 0.3);
  }

  .token-logo {
    display: flex;
    align-items: center;
  }

  .token-image {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.1);
  }
</style>
