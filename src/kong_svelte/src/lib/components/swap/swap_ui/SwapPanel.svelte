<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import {
    tokenStore,
    fromTokenDecimals,
  } from "$lib/services/tokens/tokenStore";
  import {
    formatTokenAmount,
    formatToNonZeroDecimal,
  } from "$lib/utils/numberFormatUtils";
  import { toastStore } from "$lib/stores/toastStore";
  import BigNumber from "bignumber.js";
  import { auth } from "$lib/services/auth";
  import { swapState } from "$lib/services/swap/SwapStateService";
  import { tokenLogoStore, getTokenLogo } from '$lib/services/tokens/tokenLogos';
  import { fade } from 'svelte/transition';

  // Props with proper TypeScript types
  export let title: string;
  export let token: FE.Token;
  export let amount: string;
  export let onTokenSelect: () => void;
  export let onAmountChange: (event: CustomEvent) => void;
  export let disabled: boolean;
  export let showPrice: boolean;
  export let slippage: number;
  export let panelType: "pay" | "receive";

  // Constants
  const DEFAULT_DECIMALS = 8;
  const MAX_DISPLAY_DECIMALS_DESKTOP = 12;
  const MAX_DISPLAY_DECIMALS_MOBILE = 9;
  const ANIMATION_BASE_DURATION = 200;
  const ANIMATION_MAX_DURATION = 300;
  const ANIMATION_VALUE_MULTIPLIER = 50;
  const HIGH_IMPACT_THRESHOLD = 10;

  // State management
  let inputElement: HTMLInputElement | null = null;
  let inputFocused = false;
  let isAnimating = false;
  let formattedUsdValue = "0.00";
  let calculatedUsdValue = 0;
  let pendingAnimation: any = null;
  let displayValue = "0";
  let previousValue = "0";

  // Animated values
  const animatedUsdValue = tweened(0, {
    duration: ANIMATION_BASE_DURATION,
    easing: cubicOut,
  });

  const animatedAmount = tweened(0, {
    duration: ANIMATION_BASE_DURATION,
    easing: cubicOut,
  });

  const animatedSlippage = tweened(0, {
    duration: ANIMATION_BASE_DURATION,
    easing: cubicOut,
  });

  // Reactive declarations
  $: tokenInfo = $tokenStore.tokens.find(
    (t) => t.canister_id === token?.canister_id,
  );
  $: decimals = tokenInfo?.decimals || DEFAULT_DECIMALS;
  $: isIcrc1 = tokenInfo?.icrc1 && !tokenInfo?.icrc2;

  // Format number with commas for display
  function formatWithCommas(value: string): string {
    if (!value) return "0";
    const parts = value.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  // Function to get max decimals based on screen width
  function getMaxDisplayDecimals(): number {
    return window.innerWidth <= 420 ? MAX_DISPLAY_DECIMALS_MOBILE : MAX_DISPLAY_DECIMALS_DESKTOP;
  }

  // Format display value with proper decimals
  function formatDisplayValue(value: string): string {
    if (!value || value === "0") return "0";
    
    const parts = value.split('.');
    const maxDecimals = getMaxDisplayDecimals();
    
    if (parts.length === 2) {
      // For "You Receive" panel, show ellipsis if there are more decimals
      if (panelType === "receive" && parts[1].length > maxDecimals && decimals > maxDecimals) {
        parts[1] = parts[1].slice(0, maxDecimals) + "...";
      } else {
        // For "You Pay" panel, just truncate
        parts[1] = parts[1].slice(0, maxDecimals);
      }
      
      if (parts[1].length === 0) return parts[0];
      return parts.join('.');
    }
    
    return parts[0];
  }

  // Validate numeric input
  function isValidNumber(value: string): boolean {
    if (!value) return true;
    const regex = /^[0-9]*\.?[0-9]*$/;
    return regex.test(value);
  }

  // Balance calculations
  $: formattedBalance = calculateFormattedBalance();

  function calculateFormattedBalance() {
    if (!tokenInfo) return "0";

    const balance =
      $tokenStore.balances[tokenInfo?.canister_id]?.in_tokens ||
      tokenStore.loadBalance(
        tokenInfo,
        "",
        false,
      );

    const feesInTokens = tokenInfo?.fee
      ? BigInt(tokenInfo.fee) * (isIcrc1 ? 1n : 2n)
      : 0n;

    if (balance.toString() === "0") return "0";

    return formatTokenAmount(
      new BigNumber(balance.toString())
        .minus(fromTokenDecimals(amount || "0", decimals))
        .minus(feesInTokens.toString())
        .toString(),
      decimals,
    );
  }

  // Animation and value updates
  $: {
    const balance =
      $tokenStore.balances[tokenInfo?.canister_id || ""]?.in_tokens || 0n;
    formattedUsdValue =
      $tokenStore.balances[tokenInfo?.canister_id || ""]?.in_usd || "0";
    calculatedUsdValue = parseFloat(formattedUsdValue);

    if (amount === "0") {
      updateAnimatedValues(0);
    } else {
      const currentValue = $animatedUsdValue;
      const valueDiff = Math.abs(calculatedUsdValue - currentValue);
      const duration = Math.min(
        ANIMATION_MAX_DURATION,
        ANIMATION_BASE_DURATION + valueDiff * ANIMATION_VALUE_MULTIPLIER,
      );

      animatedUsdValue.set(calculatedUsdValue, {
        duration,
        easing: cubicOut,
      });
    }

    animatedSlippage.set(slippage, { duration: 0 });
  }

  function updateAnimatedValues(duration: number) {
    animatedUsdValue.set(calculatedUsdValue, { duration });
    animatedAmount.set(parseFloat(amount || "0"), { duration });
  }

  // Event handlers
  function handleInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/,/g, '');

    // Validate input
    if (!isValidNumber(value)) {
      input.value = previousValue;
      return;
    }

    // Handle decimal point
    if (value.includes('.')) {
      const [whole, decimal] = value.split('.');
      value = `${whole}.${decimal.slice(0, decimals)}`;
    }

    // Remove leading zeros unless it's "0." or just "0"
    if (value.length > 1 && value.startsWith('0') && value[1] !== '.') {
      value = value.replace(/^0+/, '');
    }

    // If empty or invalid after processing, set to "0"
    if (!value || value === '.') {
      value = "0";
    }

    previousValue = value;

    // Format display value with commas
    if (inputElement) {
      const formattedValue = formatWithCommas(value);
      inputElement.value = formattedValue;
    }

    // Send the raw value (without commas) to the swap logic
    onAmountChange(
      new CustomEvent("input", {
        detail: { value, panelType },
      }),
    );
  }

  async function handleMaxClick() {
    if (!disabled && title === "You Pay" && tokenInfo) {
      try {
        const balance = new BigNumber(
          $tokenStore.balances[tokenInfo.canister_id]?.in_tokens.toString() ||
            "0",
        );
        const totalFees = new BigNumber(tokenInfo.fee.toString()).multipliedBy(
          tokenInfo.icrc2 ? 2 : 1,
        );

        let maxAmount = balance.minus(totalFees);

        if (maxAmount.isLessThanOrEqualTo(0)) {
          toastStore.error(
            "Insufficient balance to cover the transaction fees",
          );
          return;
        }

        maxAmount = maxAmount.integerValue(BigNumber.ROUND_DOWN);
        const formattedMax = formatTokenAmount(maxAmount.toString(), decimals).replace(/,/g, '');

        if (inputElement) {
          inputElement.value = formatWithCommas(formattedMax);
        }

        previousValue = formattedMax;

        onAmountChange(
          new CustomEvent("input", {
            detail: { value: formattedMax, panelType },
          }),
        );

      } catch (error) {
        console.error("Error in handleMaxClick:", error);
        toastStore.error("Failed to set max amount");
      }
    }
  }

  // Token selector functionality
  function handleTokenSelect() {
    if (disabled) return;
    
    if (panelType === "pay") {
      const currentState = $swapState.showPayTokenSelector;
      swapState.update(s => ({
        ...s,
        showPayTokenSelector: !currentState,
        showReceiveTokenSelector: false
      }));
    } else {
      const currentState = $swapState.showReceiveTokenSelector;
      swapState.update(s => ({
        ...s,
        showReceiveTokenSelector: !currentState,
        showPayTokenSelector: false
      }));
    }

    // Trigger amount change with current amount when token changes
    if (amount) {
      onAmountChange(
        new CustomEvent("input", {
          detail: { value: amount, panelType },
        }),
      );
    }
  }

  function handleClose() {
    swapState.update(s => ({
      ...s,
      showPayTokenSelector: false,
      showReceiveTokenSelector: false
    }));
  }

  $: isOpen = panelType === "pay" ? $swapState.showPayTokenSelector : $swapState.showReceiveTokenSelector;

  // Load token logo
  $: {
    if (token?.canister_id && !$tokenLogoStore[token.canister_id]) {
      getTokenLogo(token.canister_id);
    }
  }

  // Display calculations
  $: displayAmount = formatDisplayValue(amount || "0");
  $: formattedDisplayAmount = formatWithCommas(displayAmount);

  $: parsedAmount = parseFloat(displayAmount || "0");
  $: tokenPrice = tokenInfo ? ($tokenStore?.prices[tokenInfo.canister_id] || 0) : 0;
  $: tradeUsdValue = tokenPrice * parsedAmount;
</script>

<Panel
  variant="green"
  width="auto"
  className="token-panel w-full max-w-[690px]"
>
  <div
    class="flex flex-col min-h-[165px] max-h-[220px] box-border relative rounded-lg"
  >
    <header>
      <div class="flex items-center justify-between gap-4 min-h-[2.5rem] mb-5">
        <h2
          class="text-[clamp(1.5rem,4vw,2rem)] font-semibold text-white m-0 tracking-tight leading-none"
        >
          {title}
        </h2>
        <div class="flex items-center gap-2">
          {#if showPrice && $animatedSlippage > 0}
            <div
              class="flex items-center gap-1.5 bg-white/10 p-1 rounded-md"
              title="Price Impact"
            >
              <span
                class="text-[0.875rem] font-medium text-white/70 uppercase tracking-wide"
              >
                Impact
              </span>
              <span
                class="text-[1rem] font-semibold text-white"
                class:high={$animatedSlippage >= HIGH_IMPACT_THRESHOLD}
              >
                {$animatedSlippage.toFixed(2)}%
              </span>
            </div>
          {/if}
        </div>
      </div>
    </header>

    <div class="relative flex-grow mb-[-1px] h-[68px]">
      <div class="flex items-center gap-1 h-[69%] box-border rounded-md">
        <div class="relative flex-1">
          <input
            bind:this={inputElement}
            type="text"
            inputmode="decimal"
            pattern="[0-9]*"
            placeholder="0.00"
            class="flex-1 min-w-0 bg-transparent border-none text-white text-[clamp(1.5rem,8vw,2.5rem)] font-medium tracking-tight w-full relative z-10 p-0 mt-[-0.25rem] opacity-85 focus:outline-none focus:text-white disabled:text-white/65 placeholder:text-white/65"
            value={formattedDisplayAmount}
            on:input={handleInput}
            on:focus={() => (inputFocused = true)}
            on:blur={() => (inputFocused = false)}
            {disabled}
            readonly={panelType === "receive"}
          />
        </div>
        <div class="token-selector-wrapper relative">
          <button
            class="token-selector-button"
            on:click|stopPropagation={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const position = {
                x: rect.right + 8,
                y: rect.top,
                height: rect.height,
                windowHeight: window.innerHeight,
                windowWidth: window.innerWidth
              };
              swapState.update(s => ({
                ...s,
                tokenSelectorPosition: position,
                tokenSelectorOpen: panelType
              }));
              handleTokenSelect();
            }}
          >
            {#if token}
              <div class="token-info">
                <img
                  src={$tokenLogoStore[token.canister_id]}
                  alt={token.symbol}
                  class="token-logo"
                />
                <span class="token-symbol hide-on-mobile">{token.symbol}</span>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="chevron">
                <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
              </svg>
            {:else}
              <span class="select-token-text">Select Token</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="chevron">
                <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
              </svg>
            {/if}
          </button>
        </div>
      </div>
    </div>

    <footer class="text-white text-[clamp(0.75rem,2vw,0.875rem)]">
      <div class="flex justify-between items-center leading-6">
        <div class="flex items-center gap-2">
          <span class="text-white/50 font-normal tracking-wide mobile-text">
            Available:
          </span>
          <button
            class="pl-1 text-white/70 font-semibold tracking-tight mobile-text"
            class:clickable={title === "You Pay" && !disabled}
            on:click={handleMaxClick}
          >
            {tokenInfo && formatWithCommas(formatTokenAmount(
              $tokenStore.balances[
                tokenInfo?.canister_id
              ]?.in_tokens?.toString() || "0",
              decimals,
            ))}
            {token?.symbol}
          </button>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-white/50 font-normal tracking-wide mobile-text">Value</span>
          <span class="pl-1 text-white/50 font-medium tracking-wide mobile-text">
            ${formatToNonZeroDecimal(tradeUsdValue)}
          </span>
        </div>
      </div>
    </footer>
  </div>
</Panel>

<style>
  .clickable:hover {
    color: #eab308;
  }

  .high {
    color: #ef4444;
  }

  @media (max-width: 420px) {
    input {
      font-size: 1.5rem;
      margin-top: -0.15rem;
    }

    .mobile-text {
      font-size: 0.7rem;
    }
  }

  .token-selector-wrapper {
    position: relative;
  }

  .token-selector-button {
    min-width: 180px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: background-color 150ms;
    gap: 0.75rem;
  }

  .token-selector-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .token-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .token-logo {
    width: 2rem;
    height: 2rem;
    border-radius: 9999px;
    background-color: rgba(255, 255, 255, 0.05);
    object-fit: contain;
  }

  .token-symbol {
    font-size: 15px;
    color: white;
    font-weight: 500;
  }

  @media (max-width: 420px) {
    .hide-on-mobile {
      display: none;
    }

    .token-selector-button {
      min-width: auto;
      gap: 0.5rem;
    }
  }

  .select-token-text {
    font-size: 15px;
    color: rgba(255, 255, 255, 0.7);
    text-align: left;
  }

  .chevron {
    width: 1.25rem;
    height: 1.25rem;
    color: rgba(255, 255, 255, 0.5);
  }

  /* Mobile optimizations */
  @media (max-width: 420px) {
    .token-selector-button {
      padding: 0.5rem 0.75rem;
      min-width: auto;
    }

    .token-logo {
      width: 1.75rem;
      height: 1.75rem;
    }
  }
</style>
