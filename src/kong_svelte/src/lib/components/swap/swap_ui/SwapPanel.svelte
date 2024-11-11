<!-- Description: Optimized SwapPanel component for better performance and maintainability. -->
<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { tokenStore, formattedTokens } from "$lib/services/tokens/tokenStore";
  import { formatTokenAmount } from "$lib/utils/numberFormatUtils";
  import { toastStore } from "$lib/stores/toastStore";
  import { debounce } from 'lodash-es';
  import TokenSelectorButton from "./TokenSelectorButton.svelte";

  export let title: string;
  export let token: string;
  export let amount: string = "0";
  export let onTokenSelect: () => void;
  export let onAmountChange: (event: Event) => void;
  export let disabled: boolean = false;
  export let showPrice: boolean = false;
  export let slippage: number = 0;
  export let onSettingsClick: (() => void) | undefined = undefined;

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

        onAmountChange({ target: { value: formattedMaxAmount } } as unknown as Event);

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

  function formatDisplayValue(value: string, decimals: number = 8): string {
    const [whole, fraction = ''] = value.split('.');
    if (!fraction) return whole;
    
    const formattedFraction = fraction.slice(0, decimals);
    const hasMoreDecimals = fraction.length > decimals;
    
    return `${whole}.${formattedFraction}${hasMoreDecimals ? '...' : ''}`;
  }

  $: formattedBalance = formatDisplayValue(
    formatTokenAmount($tokenStore.balances[tokenInfo?.canister_id]?.in_tokens.toString() || "0", decimals)
  );

  $: displayAmount = title === "You Receive" ? 
    formatDisplayValue(amount) :
    isAnimating ? $animatedAmount.toFixed(decimals) : amount;

</script>


<Panel variant="green" width="auto" className="token-panel">
  <div class="panel-content" class:input-focused={inputFocused}>
    <header class="panel-header">
      <div class="title-container">
        <h2 class="panel-title">{title}</h2>
        <div class="header-actions">
          {#if onSettingsClick && title === "You Pay"}
            <!-- svelte-ignore a11y_consider_explicit_label -->
            <button 
              class="settings-button" 
              on:click={onSettingsClick}
              title="Swap Settings"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          {/if}
          {#if showPrice && $animatedSlippage > 0}
            <div class="slippage-indicator" title="Price Impact">
              <span class="slippage-label">Impact</span>
              <span class="slippage-value" class:high={$animatedSlippage >= 10}>
                {$animatedSlippage.toFixed(2)}%
              </span>
            </div>
          {/if}
        </div>
      </div>
    </header>

    <div class="input-section">
      <div class="amount-container">
        <div class="input-wrapper">
          <input
            bind:this={inputElement}
            type="text"
            class="amount-input {isOverBalance && title === 'You Pay' ? 'error' : ''}"
            value={displayAmount}
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
  margin-bottom: 1.25rem;
}

.panel-title {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--c-white);
  margin: 0;
  letter-spacing: -0.02em;
  line-height: 1;
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
  color: rgba(255, 255, 255, 0.65);
  font-size: 2.5rem;
  font-weight: 500;
  letter-spacing: -0.03em;
  width: 100%;
  position: relative;
  z-index: 1;
  padding: 0;
  margin-top: -0.25rem;
  opacity: 0.85;
}

.amount-input:focus {
  outline: none;
}

.amount-input::placeholder {
  color: rgba(255, 255, 255, 0.65);
  opacity: 1;
}

.balance-display {
  color: var(--c-white);
}

.balance-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  line-height: 1.4;
}

.balance-values {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.balance-label {
  color: rgba(255, 255, 255, 0.5);
  font-weight: 400;
  letter-spacing: 0.02em;
}

.token-amount {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 600;
  letter-spacing: -0.01em;
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
  color: rgba(255, 255, 255, 0.5);
  font-weight: 500;
  letter-spacing: 0.01em;
}

.slippage-indicator {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  background: rgba(255, 255, 255, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
}

.slippage-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.slippage-value {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--c-white);
}

.slippage-value.high {
  color: var(--c-error);
}

.button-group {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.input-wrapper:hover .amount-input:not(:focus) {
  opacity: 1;
  transition: opacity 0.2s ease;
}

@media (max-width: 768px) {
  .panel-content {
    min-height: 145px;
  }

  .panel-title {
    font-size: 1rem;
  }

  .amount-input {
    font-size: 2rem;
    margin-top: -0.2rem;
  }

  .slippage-indicator {
    padding: 0.2rem 0.4rem;
  }
  
  .slippage-label {
    font-size: 0.75rem;
  }
  
  .slippage-value {
    font-size: 0.875rem;
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
    font-size: 1.125rem;
    letter-spacing: -0.005em;
  }

  .amount-input {
    font-size: 1.75rem;
    margin-top: -0.15rem;
  }

  .slippage-indicator {
    padding: 0.15rem 0.3rem;
  }
  
  .slippage-label {
    font-size: 0.7rem;
  }
  
  .slippage-value {
    font-size: 0.8rem;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.settings-button {
  background: none;
  border: none;
  padding: 0.5rem;
  height: 2.5rem;
  width: 2.5rem;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.settings-button:hover {
  color: var(--c-white);
  background: rgba(255, 255, 255, 0.1);
}

.settings-button svg {
  width: 24px;
  height: 24px;
}

@media (max-width: 480px) {
  .settings-button {
    padding: 0.375rem;
    height: 2rem;
    width: 2rem;
  }
  
  .settings-button svg {
    width: 20px;
    height: 20px;
  }
}

/* Add new styles for the arrow between panels */
:global(.token-panel) {
  position: relative;
}

:global(.token-panel:first-of-type::after) {
  content: '';
  position: absolute;
  bottom: -24px;
  left: 50%;
  transform: translateX(-50%);
  width: 48px;
  height: 48px;
  background-image: url('/assets/yellow-arrow-down.png'); /* Make sure to add this asset */
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  z-index: 2;
}

@media (max-width: 480px) {
  :global(.token-panel:first-of-type::after) {
    width: 36px;
    height: 36px;
    bottom: -18px;
  }
}
</style>
