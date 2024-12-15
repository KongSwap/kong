<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { tokenStore, fromTokenDecimals } from "$lib/services/tokens/tokenStore";
  import { formatTokenAmount, formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { toastStore } from "$lib/stores/toastStore";
  import BigNumber from "bignumber.js";
  import { swapState } from "$lib/services/swap/SwapStateService";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import TokenSelectorDropdown from "./TokenSelectorDropdown.svelte";
  import { IcrcService } from "$lib/services/icrc/IcrcService";
  import { onMount } from "svelte";
  
  // Props with proper TypeScript types
  let { 
    title,
    token,
    amount,
    onTokenSelect,
    onAmountChange,
    disabled,
    showPrice,
    slippage,
    panelType,
    otherToken,
    isLoading = false 
  } = $props<{
    title: string;
    token: FE.Token;
    amount: string;
    onTokenSelect: () => void;
    onAmountChange: (event: CustomEvent) => void;
    disabled: boolean;
    showPrice: boolean;
    slippage: number;
    panelType: "pay" | "receive";
    otherToken: FE.Token;
    isLoading?: boolean;
  }>();

  // Constants
  const DEFAULT_DECIMALS = 8;
  const MAX_DISPLAY_DECIMALS_DESKTOP = 12;
  const MAX_DISPLAY_DECIMALS_MOBILE = 9;
  const ANIMATION_BASE_DURATION = 200;
  const ANIMATION_MAX_DURATION = 300;
  const ANIMATION_VALUE_MULTIPLIER = 50;
  const HIGH_IMPACT_THRESHOLD = 10;

  // State management using runes
  let inputElement = $state<HTMLInputElement | null>(null);
  let inputFocused = $state(false);
  let calculatedUsdValue = $state(0);
  let previousValue = $state("0");
  let isMobile = $state(false);
  let formattedBalance = $state("0");
  let displayBalance = $state("0");

  // Derived state using runes
  let tokenInfo = $derived($tokenStore.tokens.find(
    (t) => t.canister_id === token?.canister_id,
  ));
  
  let decimals = $derived(tokenInfo?.decimals || DEFAULT_DECIMALS);
  let isIcrc1 = $derived(tokenInfo?.icrc1 && !tokenInfo?.icrc2);

  // Initialize window-dependent values
  let windowWidth = $state(0);
  let windowHeight = $state(0);
  let expandDirection = $state('down'); // default value

  // Browser-only initialization
  onMount(() => {
    const checkMobile = () => {
      isMobile = window.innerWidth <= 420;
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  });

  // Animated values using runes
  let animatedUsdValue = tweened(0, {
    duration: ANIMATION_BASE_DURATION,
    easing: cubicOut,
  });

  let animatedAmount = tweened(0, {
    duration: ANIMATION_BASE_DURATION,
    easing: cubicOut,
  });

  let animatedSlippage = tweened(0, {
    duration: ANIMATION_BASE_DURATION,
    easing: cubicOut,
  });

  // Format number with commas for display
  function formatWithCommas(value: string): string {
    if (!value) return "0";
    const parts = value.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  // Function to get max decimals based on screen width
  function getMaxDisplayDecimals(): number {
    return isMobile ? MAX_DISPLAY_DECIMALS_MOBILE : MAX_DISPLAY_DECIMALS_DESKTOP;
  }

  // Format display value with proper decimals
  function formatDisplayValue(value: string): string {
    if (!value || value === "0") return "0";
    
    const parts = value.split('.');
    const maxDecimals = getMaxDisplayDecimals();
    
    if (parts.length === 2) {
      if (panelType === "receive" && parts[1].length > maxDecimals && decimals > maxDecimals) {
        parts[1] = parts[1].slice(0, maxDecimals) + "...";
      } else {
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

  // Watch for token and balance changes using $effect
  $effect(() => {
    if (tokenInfo) {
      const balance = $tokenStore.balances[tokenInfo.canister_id]?.in_tokens;
      if (balance !== undefined) {
        displayBalance = formatWithCommas(formatTokenAmount(
          balance.toString(),
          decimals,
        ));
        formattedBalance = calculateAvailableBalance(balance);
      } else {
        tokenStore.loadBalance(tokenInfo, "", true);
      }
    }
  });

  function calculateAvailableBalance(balance: bigint): string {
    if (!balance) return "0";

    try {
      const feesInTokens = tokenInfo?.fee_fixed
        ? BigInt(tokenInfo.fee_fixed.toString().replace(/_/g, '')) * (isIcrc1 ? 1n : 2n)
        : 0n;

      return formatTokenAmount(
        new BigNumber(balance.toString())
          .minus(fromTokenDecimals(amount || "0", decimals))
          .minus(feesInTokens.toString())
          .toString(),
        decimals,
      );
    } catch (error) {
      console.error("Error calculating available balance:", error);
      return "0";
    }
  }

  // Animation and value updates using $effect
  $effect(() => {
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
  });

  function updateAnimatedValues(duration: number) {
    animatedUsdValue.set(calculatedUsdValue, { duration });
    animatedAmount.set(parseFloat(amount || "0"), { duration });
  }

  // Event handlers
  function handleInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/,/g, '');

    if (!isValidNumber(value)) {
      input.value = previousValue;
      return;
    }

    if (value.includes('.')) {
      const [whole, decimal] = value.split('.');
      value = `${whole}.${decimal.slice(0, decimals)}`;
    }

    if (value.length > 1 && value.startsWith('0') && value[1] !== '.') {
      value = value.replace(/^0+/, '');
    }

    if (!value || value === '.') {
      value = "0";
    }

    previousValue = value;

    if (inputElement) {
      const formattedValue = formatWithCommas(value);
      inputElement.value = formattedValue;
    }

    onAmountChange(
      new CustomEvent("input", {
        detail: { value, panelType },
      }),
    );
  }

  async function handleMaxClick() {
    if (!disabled && title === "You Pay" && tokenInfo) {
      try {
        if (!tokenInfo.decimals) {
          console.error("Token info missing required properties", tokenInfo);
          toastStore.error("Invalid token configuration");
          return;
        }

        const rawBalance = $tokenStore.balances[tokenInfo.canister_id]?.in_tokens;
        if (rawBalance === undefined || rawBalance === null) {
          console.error("Balance not available for token", tokenInfo.symbol);
          toastStore.error(`Balance not available for ${tokenInfo.symbol}`);
          return;
        }

        const balance = new BigNumber(rawBalance.toString());
        if (!balance.isFinite() || balance.isNaN()) {
          console.error("Invalid balance value", rawBalance);
          toastStore.error("Invalid balance value");
          return;
        }

        let tokenFee;
        try {
          tokenFee = await IcrcService.getTokenFee(tokenInfo);
        } catch (error) {
          console.error("Error getting token fee, falling back to fee_fixed:", error);
          if (!tokenInfo.fee_fixed) {
            toastStore.error("Could not determine token fee");
            return;
          }
          tokenFee = BigInt(tokenInfo.fee_fixed.toString().replace(/_/g, ''));
        }

        const feeMultiplier = tokenInfo.icrc2 ? 2n : 1n;
        const totalFees = new BigNumber(tokenFee.toString()).multipliedBy(feeMultiplier.toString());

        let maxAmount = balance.minus(totalFees);

        if (maxAmount.isLessThanOrEqualTo(0) || maxAmount.isNaN()) {
          console.error("Invalid max amount calculated", maxAmount.toString());
          toastStore.error("Insufficient balance to cover fees");
          return;
        }

        maxAmount = maxAmount.integerValue(BigNumber.ROUND_DOWN);
        
        const formattedMax = formatTokenAmount(maxAmount.toString(), tokenInfo.decimals);
        if (!formattedMax || formattedMax === "NaN") {
          console.error("Invalid formatted amount", formattedMax);
          toastStore.error("Failed to format amount");
          return;
        }

        const cleanFormattedMax = formattedMax.replace(/,/g, '');
        if (inputElement) {
          inputElement.value = formatWithCommas(cleanFormattedMax);
        }

        previousValue = cleanFormattedMax;

        onAmountChange(
          new CustomEvent("input", {
            detail: { value: cleanFormattedMax, panelType },
          }),
        );

      } catch (error) {
        console.error("Error in handleMaxClick:", error);
        toastStore.error("Failed to set max amount");
      }
    }
  }

  // Token selector functionality
  function handleTokenSelect(event: MouseEvent) {
    if (disabled) return;
    
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const position = {
      x: rect.right + 8,
      y: rect.top,
      windowWidth
    };

    if (panelType === "pay") {
      const currentState = $swapState.showPayTokenSelector;
      swapState.update(s => ({
        ...s,
        showPayTokenSelector: !currentState,
        showReceiveTokenSelector: false,
        tokenSelectorPosition: position,
        tokenSelectorOpen: 'pay'
      }));
    } else {
      const currentState = $swapState.showReceiveTokenSelector;
      swapState.update(s => ({
        ...s,
        showReceiveTokenSelector: !currentState,
        showPayTokenSelector: false,
        tokenSelectorPosition: position,
        tokenSelectorOpen: 'receive'
      }));
    }

    if (amount) {
      onAmountChange(
        new CustomEvent("input", {
          detail: { value: amount, panelType },
        }),
      );
    }
  }

  // Display calculations using runes
  let displayAmount = $derived(formatDisplayValue(amount || "0"));
  let formattedDisplayAmount = $derived(formatWithCommas(displayAmount));
  let parsedAmount = $derived(parseFloat(displayAmount || "0"));
  let tokenPrice = $derived(tokenInfo ? ($tokenStore?.prices[tokenInfo.canister_id] || 0) : 0);
  let tradeUsdValue = $derived(tokenPrice * parsedAmount);

  // Use onMount to safely access window properties
  onMount(() => {
    // Initial values
    windowWidth = window.innerWidth;
    windowHeight = window.innerHeight;

    // Update function
    const updateWindowDimensions = () => {
      windowWidth = window.innerWidth;
      windowHeight = window.innerHeight;
    };

    // Add event listener
    window.addEventListener('resize', updateWindowDimensions);

    // Cleanup
    return () => {
      window.removeEventListener('resize', updateWindowDimensions);
    };
  });

  // Use $effect for the direction calculation
  $effect(() => {
    if (typeof window !== 'undefined') { // Check if we're in browser environment
      expandDirection = $swapState.tokenSelectorPosition?.y > (windowHeight / 2) 
        ? 'up' 
        : 'down';
    }
  });
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
          {#if isLoading && panelType === "receive"}
            <div class="absolute inset-0 flex items-center">
              <div class="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          {/if}
          <input
            bind:this={inputElement}
            type="text"
            inputmode="decimal"
            pattern="[0-9]*"
            placeholder="0.00"
            class="flex-1 min-w-0 bg-transparent border-none text-white text-[clamp(1.5rem,8vw,2.5rem)] font-medium tracking-tight w-full relative z-10 p-0 mt-[-0.25rem] opacity-85 focus:outline-none focus:text-white disabled:text-white/65 placeholder:text-white/65"
            class:opacity-0={isLoading && panelType === "receive"}
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
              handleTokenSelect(event);
            }}
          >
            {#if token}
              <div class="token-info">
                <TokenImages tokens={[token]} size={32} />
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
          <TokenSelectorDropdown
            show={$swapState.tokenSelectorOpen === panelType}
            onSelect={() => {
              swapState.update(s => ({ ...s, tokenSelectorOpen: null }));
              onTokenSelect();
            }}
            onClose={() => swapState.update(s => ({ ...s, tokenSelectorOpen: null }))}
            currentToken={token}
            otherPanelToken={otherToken}
            {expandDirection}
          />
        </div>
      </div>
    </div>

    <footer class="text-white text-[clamp(0.75rem,2vw,0.875rem)]">
      <div class="flex justify-between items-center leading-6">
        <div class="flex items-center gap-2">
          <span class="text-white/50 font-normal tracking-wide mobile-text">Value</span>
          <span class="pl-1 text-white/50 font-medium tracking-wide mobile-text">
            ${formatToNonZeroDecimal(tradeUsdValue)}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-white/50 font-normal tracking-wide mobile-text">
            Available:
          </span>
          <button
            class="pl-1 text-white/70 font-semibold tracking-tight mobile-text"
            class:clickable={title === "You Pay" && !disabled}
            on:click={handleMaxClick}
          >
            {displayBalance}
            {token?.symbol}
          </button>
        </div>
      </div>
    </footer>
  </div>
</Panel>

<style lang="postcss">
  .clickable:hover {
    color: #eab308;
  }

  .high {
    color: #ef4444;
  }

  @media (max-width: 420px) {
    input {
      font-size: 1.88rem;
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
    font-size: 2rem;
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
  }

  .loading-dots {
    display: flex;
    gap: 6px;
    align-items: center;
    justify-content: flex-start;
    padding-left: 4px;
  }

  .loading-dots span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.5);
    animation: bounce 1.4s infinite ease-in-out both;
  }

  .loading-dots span:nth-child(1) {
    animation-delay: -0.32s;
  }

  .loading-dots span:nth-child(2) {
    animation-delay: -0.16s;
  }

  @keyframes bounce {
    0%, 80%, 100% { 
      transform: scale(0);
      opacity: 0.3;
    }
    40% { 
      transform: scale(1);
      opacity: 1;
    }
  }
</style>
