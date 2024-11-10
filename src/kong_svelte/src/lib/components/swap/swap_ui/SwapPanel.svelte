<!-- Description: Optimized SwapPanel component for better performance and maintainability. -->
<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { tokenStore, formattedTokens } from "$lib/services/tokens/tokenStore";
  import { formatTokenAmount } from "$lib/utils/numberFormatUtils";
  import { toastStore } from "$lib/stores/toastStore";
  import BigNumber from "bignumber.js";
  import { debounce } from 'lodash-es';
  import { createEventDispatcher } from 'svelte';
  import TokenSelectorButton from "./TokenSelectorButton.svelte";
  const dispatch = createEventDispatcher();

  export let title: string;
  export let token: string;
  export let amount: string = "0";
  export let onTokenSelect: () => void;
  export let onAmountChange: (event: Event) => void;
  export let disabled: boolean = false;
  export let showPrice: boolean = false;
  export let slippage: number = 0;

  let tokenInfo: FE.Token | undefined;
  let decimals: number;
  let formattedBalance: string;
  let formattedUsdValue: string;
  let calculatedUsdValue: string;
  let isOverBalance: boolean;

  let pendingAnimation: any = null;

  const handleInput = debounce((event: Event) => {
    if (title === "You Receive") return;

    const input = event.target as HTMLInputElement;
    const newValue = input.value;

    try {
      const estimatedUsdValue = (parseFloat(newValue || "0") * parseFloat(formattedUsdValue)).toFixed(2);
      animatedUsdValue.set(parseFloat(estimatedUsdValue), { duration: 400 });
      animatedAmount.set(parseFloat(newValue) || 0, { duration: 400 });
      
      pendingAnimation = animatedAmount.set(parseFloat(newValue) || 0);
      
      onAmountChange(event);
    } catch (error) {
      console.error("Error in handleInput:", error);
      toastStore.error("Invalid input amount");
    }
  }, 300);

  $: {
    tokenInfo = $formattedTokens.find(t => t.symbol === token);
    decimals = tokenInfo?.decimals || 8;
    formattedBalance = formatTokenAmount($tokenStore.balances[tokenInfo?.canister_id]?.in_tokens.toString() || "0", decimals);
    formattedUsdValue = tokenInfo?.price?.toString() || "0";

    calculatedUsdValue = (parseFloat(amount || "0") * parseFloat(formattedUsdValue)).toFixed(2);
    isOverBalance = parseFloat(amount || "0") > parseFloat(formattedBalance || "0");

    if (pendingAnimation && amount === "0") {
      pendingAnimation.cancel();
      pendingAnimation = null;
    }

    if (amount === "0") {
      animatedUsdValue.set(parseFloat(calculatedUsdValue), { duration: 0 });
      animatedAmount.set(parseFloat(amount || "0"), { duration: 0 });
    } else {
      animatedUsdValue.set(parseFloat(calculatedUsdValue), { duration: 400 });
    }
    
    animatedSlippage.set(slippage, { duration: 0 });
  }

  const animatedUsdValue = tweened(0, {
    duration: 200,
    easing: cubicOut,
  });

  const animatedAmount = tweened(0, {
    duration: 200,
    easing: cubicOut,
  });

  const animatedSlippage = tweened(0, {
    duration: 200,
    easing: cubicOut,
  });

  let inputFocused: boolean = false;
  let isAnimating: boolean = false;
  let inputElement: HTMLInputElement | null = null;

  const handleMaxClick = () => {
    if (!disabled && title === "You Pay") {
      try {
        const formattedMaxAmount = formattedBalance;
        isAnimating = true;

        onAmountChange({ target: { value: formattedMaxAmount } });

        animatedAmount.set(parseFloat(formattedMaxAmount), {
          duration: 400,
          easing: cubicOut
        }).then(() => {
          isAnimating = false;
          if (inputElement) {
            inputElement.value = formattedMaxAmount;
          }
        });
      } catch (error) {
        console.error("Error in handleMaxClick:", error);
        toastStore.error("Failed to set max amount");
      }
    }
  };

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
        <div class="input-wrapper">
          <input
            bind:this={inputElement}
            type="text"
            class="amount-input {isOverBalance && title === 'You Pay' ? 'error' : ''}"
            value="{isAnimating ? $animatedAmount.toFixed(decimals) : amount}"
            on:input={handleInput}
            on:focus={() => inputFocused = true}
            on:blur={() => inputFocused = false}
            placeholder="0"
            disabled="{disabled || title === 'You Receive'}"
            readonly="{title === 'You Receive'}"
          />
        </div>
        <div class="button-group">
          <TokenSelectorButton
            {token}
            onClick={onTokenSelect}
            disabled={disabled}
          />
        </div>
      </div>
    </div>

    <footer class="balance-display">
      <div class="balance-info">
        <span class="balance-label">Available</span>
        <div class="balance-values">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span 
            class="token-amount" 
            class:clickable={title === "You Pay" && !disabled}
            on:click={handleMaxClick}
          >
            {formattedBalance} {token}
          </span>
          <span class="separator">|</span>
          <span class="fiat-amount">
            ${$animatedUsdValue.toFixed(2)}
          </span>
        </div>
      </div>
    </footer>
  </div>
</Panel>

<style>
.panel-content {
  display: flex;
  flex-direction: column;
  min-height: 165px;
  max-height: 220px;
  box-sizing: border-box;
  position: relative;
  border-radius: 8px;
}

.title-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 2.5rem;
}

.panel-title {
  font-size: 2.25rem;
  font-weight: 600;
  color: var(--c-white);
  margin: 0;
  letter-spacing: 0.02em;
}

.input-section {
  position: relative;
  flex-grow: 1;
  margin-bottom: -1px;
  height: 68px;
}

.amount-container {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  height: 69%;
  box-sizing: border-box;
  border-radius: 4px;
}

.input-wrapper {
  position: relative;
  flex: 1;
}

.amount-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  color: white;
  font-size: 2rem;
  font-weight: bold;
  letter-spacing: 0.03em;
  width: 100%;
  position: relative;
  z-index: 1;
}

.amount-input:focus {
  outline: none;
}

.amount-input::placeholder {
  color: var(--c-white);
  opacity: 1;
}

.balance-display {
  color: var(--c-white);
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
  opacity: 0.8;
  font-weight: 500;
}

.token-amount {
  font-weight: 600;
}

.token-amount.clickable {
  cursor: pointer;
  transition: color 0.2s ease;
}

.token-amount.clickable:hover {
  color: var(--c-yellow, #FFD700);
}

.separator {
  color: rgba(255, 255, 255, 0.1);
}

.fiat-amount {
  opacity: 0.8;
  font-weight: 500;
}

.slippage-value {
  font-size: 2.25rem;
  font-weight: 600;
  transition: color 0.2s ease;
}

.slippage-value.high {
  color: var(--c-error);
}

.button-group {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.max-button {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  color: var(--c-white);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  transition: background-color 0.2s ease;
}

.input-wrapper:hover .amount-input:not(:focus) {
  opacity: 0;
}

.input-wrapper:hover .max-overlay {
  opacity: 1;
}

@media (max-width: 768px) {
  .panel-content {
    min-height: 145px;
  }

  .panel-title {
    font-size: 1.5rem;
  }

  .amount-input {
    font-size: 1.5rem;
  }

  .slippage-value {
    font-size: 1.5rem;
  }

  .balance-info {
    font-size: 0.9rem;
  }

  :global(.token-panel .button-group) {
    transform: scale(0.9);
    transform-origin: right center;
  }
}

@media (max-width: 480px) {
  .panel-content {
    min-height: 135px;
    padding: 0.75rem;
  }

  .title-container {
    min-height: 2rem;
    gap: 0.5rem;
  }

  .panel-title {
    font-size: 1.25rem;
  }

  .amount-input {
    font-size: 1.125rem;
  }

  .slippage-value {
    font-size: 1.25rem;
  }

  .balance-info {
    font-size: 0.75rem;
  }

  :global(.token-panel .button-group) {
    transform: scale(0.8);
  }

  .amount-container {
    gap: 0.125rem;
  }

  .balance-values {
    gap: 0.25rem;
  }
}

@media (max-width: 360px) {
  .panel-content {
    min-height: 125px;
  }

  :global(.token-panel .button-group) {
    transform: scale(0.75);
  }

  .balance-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .balance-values {
    width: 100%;
    justify-content: space-between;
  }
}

.input-section {
  @media (max-width: 480px) {
    height: 58px;
    margin-bottom: 0;
  }
}

.amount-container {
  @media (max-width: 480px) {
    height: 75%;
  }
}
</style>
