<!-- Description: This is the SwapPanel component that displays the swap input fields and token selector. -->
<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { tokenStore, formattedTokens } from "$lib/stores/tokenStore";
  import { formatTokenAmount } from "$lib/utils/numberFormatUtils";
  import { toastStore } from "$lib/stores/toastStore";
  import BigNumber from "bignumber.js";
  
  export let title: string;
  export let token: string;
  export let amount: string = "0";
  export let onTokenSelect: () => void;
  export let onAmountChange: (event: Event) => void;
  export let disabled = false;
  export let showPrice = false;
  export let slippage = 0;

  // Get token info and formatted values
  $: tokenInfo = $formattedTokens.tokens.find(t => t.symbol === token);
  $: decimals = tokenInfo?.decimals || 8;
  $: formattedBalance = tokenInfo?.formattedBalance?.toString() || "0";
  $: formattedUsdValue = tokenInfo?.formattedUsdValue || "0";

  // Calculate USD value for current amount
  $: calculatedUsdValue = new BigNumber(amount || "0")
    .times(new BigNumber(formattedUsdValue).div(formattedBalance || "1"))
    .toFixed(2);

  $: isOverBalance = parseFloat(amount || "0") > parseFloat(formattedBalance || "0");

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
    easing: cubicOut
  });

  // Update animated values
  $: {
    animatedUsdValue.set(parseFloat(calculatedUsdValue));
    animatedAmount.set(parseFloat(amount || "0"));
    animatedSlippage.set(slippage);
  }

  let inputFocused = false;
  let isAnimating = false;
  let inputElement: HTMLInputElement;

  function handleMaxClick() {
    if (!disabled && title === "You Pay") {
      try {
        const maxAmount = formattedBalance;
        isAnimating = true;

        const event = new CustomEvent('input', {
          bubbles: true,
          detail: { value: maxAmount }
        });
        onAmountChange(event);

        animatedAmount.set(parseFloat(maxAmount), {
          duration: 400,
          easing: cubicOut
        }).then(() => {
          isAnimating = false;
          if (inputElement) {
            inputElement.value = maxAmount;
          }
        });
      } catch (error) {
        console.error("Error in handleMaxClick:", error);
      }
    }
  }

  function handleInput(event: Event) {
    if (title === "You Receive") return;
    
    try {
      const input = event.target as HTMLInputElement;
      const newValue = input.value;
      
      isAnimating = false;
      onAmountChange(event);
      animatedAmount.set(parseFloat(newValue || "0"), { duration: 0 });
    } catch (error) {
      console.error("Error in handleInput:", error);
      toastStore.error("Invalid input amount");
    }
  }
</script>

<Panel variant="green" width="auto" className="token-panel">
  <div class="panel-content" class:input-focused={inputFocused}>
    <header class="panel-header">
      <div class="title-container">
        <h2 class="panel-title">{title}</h2>
        {#if showPrice && $animatedSlippage > 0}
          <div class="slippage-display" title="Price Slippage">
            <span class="slippage-value" class:high={$animatedSlippage >= 10}>
              {$animatedSlippage.toFixed(2)}%
            </span>
          </div>
        {/if}
      </div>
    </header>

    <div class="input-section">
      <div class="amount-container">
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
          value={isAnimating ? $animatedAmount.toFixed(decimals) : amount}
          on:input={handleInput}
          on:focus={() => inputFocused = true}
          on:blur={() => inputFocused = false}
          placeholder="0"
          disabled={disabled || title === "You Receive"}
          readonly={title === "You Receive"}
        />
        {#if title === "You Pay"}
          <button class="max-button" on:click={handleMaxClick}>MAX</button>
        {:else}
          <button class="max-button disabled-max" disabled>MAX</button>
        {/if}
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

    <footer class="balance-display">
      <div class="balance-info">
        <span class="balance-label">Available</span>
        <div class="balance-values">
          <span class="token-amount">{formattedBalance} {token}</span>
          <span class="separator">|</span>
          <span class="fiat-amount">
            ${$animatedUsdValue}
          </span>
        </div>
      </div>
    </footer>
  </div>
</Panel>

<style>
:root {
  --color-white: #ffffff;
  --color-white-alpha-10: rgba(255, 255, 255, 0.1);
  --color-white-alpha-20: rgba(255, 255, 255, 0.2);
  --color-black-alpha-15: rgba(0, 0, 0, 0.15);
  --color-black-alpha-25: rgba(0, 0, 0, 0.25);
  --color-black-alpha-35: rgba(0, 0, 0, 0.35);
  --color-black-alpha-45: rgba(0, 0, 0, 0.45);
  --color-success: #00E676;
  --color-success-alpha-10: rgba(0, 230, 118, 0.1);
  --color-success-alpha-30: rgba(0, 230, 118, 0.3);
  --color-warning: #FF1744;
  --color-warning-alpha-05: rgba(255, 23, 68, 0.05);
  --color-warning-alpha-10: rgba(255, 23, 68, 0.1);
  --color-warning-alpha-30: rgba(255, 23, 68, 0.3);
  --border-success: rgba(100, 173, 59, 0.5);
  --shadow-text: 
    -1px -1px 0 rgba(0, 0, 0, 0.2),
     1px -1px 0 rgba(0, 0, 0, 0.2),
    -1px  1px 0 rgba(0, 0, 0, 0.2),
     1px  1px 0 rgba(0, 0, 0, 0.2);
  --transition-fast: 0.2s ease;
  --transition-normal: 0.3s ease;
  --border-radius-small: 4px;
  --border-radius-medium: 8px;
  --font-family: "Alumni Sans", sans-serif;
}

/* Base styles */
* {
  font-family: var(--font-family);
}

/* Panel Layout */
.panel-content {
  display: flex;
  flex-direction: column;
  transition: transform var(--transition-normal);
  padding: 0.25rem;
  min-height: 165px;
  max-height: 220px;
  box-sizing: border-box;
  position: relative;
}

/* Add scanline effect */
.panel-content::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(255, 255, 255, 0.03) 0px,
    rgba(255, 255, 255, 0.03) 1px,
    transparent 1px,
    transparent 2px
  );
  pointer-events: none;
  opacity: 0.5;
}

/* Header Styles */
.title-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.25rem;
  gap: 1rem;
  min-height: 2.5rem;
}

.panel-title {
  font-size: 2.25rem;
  font-weight: 600;
  color: var(--color-white);
  margin: 0;
  text-shadow: var(--shadow-text);
  letter-spacing: 0.02em;
}

/* Settings Button */
.settings-button {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  opacity: 0.7;
  transition: all var(--transition-fast);
}

.settings-button:hover {
  opacity: 1;
  transform: rotate(45deg);
}

.settings-icon {
  font-size: 1.25rem;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5));
}

/* Input Section */
.input-section {
  position: relative;
  flex-grow: 1;
  margin-bottom: -1px;
  height: 68px;
}
.token-selector {
  display: flex;
  align-items: center;
}

.token-button {
  background: var(--color-black-alpha-25);
  border: 1px solid var(--color-white-alpha-10);
  border-radius: var(--border-radius-medium);
  padding: 0.1rem 0.25rem;
  color: var(--color-white);
  font-size: 1.5rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  transition: all var(--transition-fast);
  cursor: pointer;
  min-width: 85px;
  height: 42px;
  box-sizing: border-box;
  margin-right: 0;
  border-top-right-radius: var(--border-radius-medium);
  border-bottom-right-radius: var(--border-radius-medium);
}

.token-button:hover:not(:disabled) {
  background: var(--color-black-alpha-45);
  border-color: rgba(100, 173, 59, 0.8);
  transform: translateY(-1px);
}

.token-button.warning {
  background: var(--color-warning-alpha-10);
  border: 2px solid var(--color-warning-alpha-30);
  box-shadow: 
    0 0 0 1px rgba(0, 0, 0, 0.2),
    0 2px 4px rgba(0, 0, 0, 0.1);
}

.token-text {
  margin-right: 0.25rem;
  font-size: 1.4rem;
}

.chevron {
  font-size: 0.6rem;
  opacity: 0.6;
  transition: transform var(--transition-normal);
  margin-left: auto;
}

.token-button:hover .chevron {
  transform: translateY(1px);
}

/* Max Button */
.max-button {
  background: var(--color-success-alpha-10);
  border: 1px solid var(--color-success-alpha-30);
  color: var(--color-success);
  font-size: 0.85rem;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  cursor: pointer;
  transition: all var(--transition-fast);
  font-weight: 600;
  margin: 0 0.25rem;
  height: fit-content;
  align-self: center;
  letter-spacing: 0.02em;
}

.max-button:hover {
  background: var(--color-success-alpha-30);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.max-button.disabled-max {
  background: var(--color-white-alpha-10);
  border: 1px solid var(--color-white-alpha-20);
  color: var(--color-white-alpha-20);
  cursor: not-allowed;
  opacity: 0.5;
}

.max-button.disabled-max:hover {
  transform: none;
  box-shadow: none;
}
.amount-container {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.35rem 0.35rem 0.35rem 0.5rem;
  background: var(--color-black-alpha-25);
  border: 1px solid var(--border-success);
  border-radius: var(--border-radius-medium);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  box-shadow: 
    inset 0 1px 2px rgba(0, 0, 0, 0.2),
    0 1px 0 #368D00,
    0 1px 4px rgba(0, 0, 0, 0.15);
  transition: all var(--transition-fast);
  position: relative;
  z-index: 1;
  height: 100%;
  box-sizing: border-box;
}

/* Input Styles */
.amount-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  color: var(--color-white);
  font-size: 1.75rem;
  font-weight: 500;
  letter-spacing: 0.03em;
  text-shadow: var(--shadow-text);
  padding: 0.1rem;
  width: 100%;
  transition: all var(--transition-fast);
}

.amount-input:focus {
  outline: none;
}

.amount-input::placeholder {
  color: var(--color-white);
  opacity: 1;
}

/* Token Button */
.token-button {
  background: var(--color-black-alpha-25);
  border: 1px solid var(--color-white-alpha-10);
  border-radius: var(--border-radius-medium);
  padding: 0.1rem 0.25rem;
  color: var(--color-white);
  font-size: 1.5rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  transition: all var(--transition-fast);
  cursor: pointer;
  min-width: 85px;
  height: 42px;
  box-sizing: border-box;
}

.token-button:hover:not(:disabled) {
  background: var(--color-black-alpha-45);
  border-color: rgba(100, 173, 59, 0.8);
  transform: translateY(-1px);
}

/* Token Display */
.token-logo {
  display: flex;
  align-items: center;
}

.token-image {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--color-white-alpha-10);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Balance Display */
.balance-display {
  background: var(--color-black-alpha-25);
  border: 1px solid var(--border-success);
  border-top: none;
  border-radius: 0 0 var(--border-radius-medium) var(--border-radius-medium);
  padding: 0.5rem;
  color: var(--color-white);
}

.balance-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.1rem;
}

.balance-values {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.balance-label {
  color: #FFD700;
  opacity: 0.8;
  font-weight: 500;
}

.token-amount {
  font-weight: 600;
}

.separator {
  color: rgba(255, 255, 255, 0.1);
}

.fiat-amount {
  color: #FFD700;
  opacity: 0.8;
  font-weight: 500;
  transition: all 0.2s ease;
}

.network-fee {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-white-alpha-10);
  font-size: 0.9rem;
  color: var(--color-white-alpha-20);
}


/* Warning States */
.warning {
  border: 2px solid var(--color-warning-alpha-30);
  background: var(--color-warning-alpha-05);
  box-shadow: 
    0 0 0 1px rgba(0, 0, 0, 0.2),
    0 2px 4px rgba(0, 0, 0, 0.1);
  animation: pulse-warning 2s infinite;
}

/* Animations */
@keyframes pulse-warning {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

.balance-label, .fee-label {
  color: #FFD700;
  font-weight: 500;
}

.token-amount, .fee-amount {
  color: #FFFFFF;
  font-weight: 600;
}

.network-fee {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-white-alpha-10);
}

.slippage-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all var(--transition-fast);
}

.slippage-icon {
  font-size: 1.25rem;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5));
}

.slippage-value {
  font-size: 2.25rem;
  font-weight: 600;
  color: #FFB74D;
  text-shadow: var(--shadow-text);
  transition: color 0.2s ease;
}

.slippage-value.high {
  color: var(--color-warning);
  animation: pulse-warning 2s infinite;
}

/* Add styles for the USD fee display */
.fee-usd {
  font-size: 0.85em;
  opacity: 0.7;
  margin-left: 0.5rem;
}

/* Add a subtle glow effect when value changes */
.fiat-amount:not(:hover) {
  animation: value-update 0.4s ease-out;
}

@keyframes value-update {
  0% {
    opacity: 0.7;
    transform: scale(0.95);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

</style>
