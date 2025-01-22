<script lang="ts">
  import { formatTokenBalance } from "$lib/utils/tokenFormatters";
  import Panel from "$lib/components/common/Panel.svelte";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import {
    storedBalancesStore,
  } from "$lib/services/tokens/tokenStore";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { toastStore } from "$lib/stores/toastStore";
  import { swapState } from "$lib/services/swap/SwapStateService";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import TokenSelectorDropdown from "./TokenSelectorDropdown.svelte";
  import { onMount } from "svelte";
  import Modal from "$lib/components/common/Modal.svelte";
  import { userTokens } from "$lib/stores/userTokens";
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
    isLoading = false,
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
  let lastBalanceCheck = $state<Record<string, number>>({});
  const DEBOUNCE_DELAY = 1000; // 1 second between balance checks
  let showOnramperModal = $state(false);

  // Derived state using runes
  let tokenInfo = $derived(
    $userTokens.tokens.find((t) => t.canister_id === token?.canister_id),
  );

  let decimals = $derived(tokenInfo?.decimals || DEFAULT_DECIMALS);
  let isIcrc1 = $derived(tokenInfo?.icrc1 && !tokenInfo?.icrc2);

  // Initialize window-dependent values
  let windowWidth = $state(0);
  let windowHeight = $state(0);
  let expandDirection = $state("down"); // default value

  // Browser-only initialization
  onMount(() => {
    const checkMobile = () => {
      isMobile = window.innerWidth <= 420;
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
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
    const parts = value.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  }

  // Function to get max decimals based on screen width
  function getMaxDisplayDecimals(): number {
    return isMobile
      ? MAX_DISPLAY_DECIMALS_MOBILE
      : MAX_DISPLAY_DECIMALS_DESKTOP;
  }

  // Format display value with proper decimals
  function formatDisplayValue(value: string): string {
    if (!value || value === "0") return "0";

    const parts = value.split(".");
    const maxDecimals = getMaxDisplayDecimals();

    if (parts.length === 2) {
      if (
        panelType === "receive" &&
        parts[1].length > maxDecimals &&
        decimals > maxDecimals
      ) {
        parts[1] = parts[1].slice(0, maxDecimals) + "...";
      } else {
        parts[1] = parts[1].slice(0, maxDecimals);
      }

      if (parts[1].length === 0) return parts[0];
      return parts.join(".");
    }

    return parts[0];
  }

  // Validate numeric input
  function isValidNumber(value: string): boolean {
    if (!value) return true;
    const regex = /^[0-9]*\.?[0-9]*$/;
    return regex.test(value);
  }

  // Watch for token changes
  onMount(() => {
    // Initial balance load is now handled by parent
  });

  let lastLoadedToken = $state<string | undefined>(undefined);
  $effect(() => {
    const canisterId = tokenInfo?.canister_id;
    if (canisterId && canisterId !== lastLoadedToken) {
      lastLoadedToken = canisterId;
    }
  });

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
    let value = input.value.replace(/,/g, "");

    if (!isValidNumber(value)) {
      input.value = previousValue;
      return;
    }

    if (value.includes(".")) {
      const [whole, decimal] = value.split(".");
      value = `${whole}.${decimal.slice(0, decimals)}`;
    }

    if (value.length > 1 && value.startsWith("0") && value[1] !== ".") {
      value = value.replace(/^0+/, "");
    }

    if (!value || value === ".") {
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
    if (!disabled && title === "You Pay" && token) {
      try {
        if (!tokenInfo) {
          console.error("Token info missing");
          toastStore.error("Invalid token configuration");
          return;
        }

        const balance = $storedBalancesStore[token.canister_id]?.in_tokens;
        if (!balance) {
          console.error("Balance not available for token", token.symbol);
          toastStore.error(`Balance not available for ${token.symbol}`);
          return;
        }

        // Calculate fees
        const feesInTokens = tokenInfo.fee_fixed
          ? BigInt(tokenInfo.fee_fixed.toString().replace(/_/g, "")) *
            (isIcrc1 ? 1n : 2n)
          : 0n;

        // Subtract fees from balance
        const availableBalance = balance - feesInTokens;

        if (availableBalance <= 0n) {
          toastStore.error("Insufficient balance to cover fees");
          return;
        }

        // Convert to display format
        const maxAmount = formatTokenBalance(
          availableBalance.toString(),
          token.decimals,
        );

        // Set the input value
        if (inputElement) {
          inputElement.value = formatWithCommas(maxAmount);
        }

        // Trigger the amount change
        onAmountChange(
          new CustomEvent("input", {
            detail: { value: maxAmount, panelType },
          }),
        );
      } catch (error) {
        console.error("Error in handleMaxClick:", error);
        toastStore.error("Failed to set maximum amount");
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
      windowWidth,
    };

    if (panelType === "pay") {
      const currentState = $swapState.showPayTokenSelector;
      swapState.update((s) => ({
        ...s,
        showPayTokenSelector: !currentState,
        showReceiveTokenSelector: false,
        tokenSelectorPosition: position,
        tokenSelectorOpen: "pay",
      }));
    } else {
      const currentState = $swapState.showReceiveTokenSelector;
      swapState.update((s) => ({
        ...s,
        showReceiveTokenSelector: !currentState,
        showPayTokenSelector: false,
        tokenSelectorPosition: position,
        tokenSelectorOpen: "receive",
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
  let tokenPrice = $derived(
    tokenInfo ? Number(tokenInfo?.metrics?.price || 0) : 0,
  );
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
    window.addEventListener("resize", updateWindowDimensions);

    // Cleanup
    return () => {
      window.removeEventListener("resize", updateWindowDimensions);
    };
  });

  // Use $effect for the direction calculation
  $effect(() => {
    if (typeof window !== "undefined") {
      // Check if we're in browser environment
      expandDirection =
        $swapState.tokenSelectorPosition?.y > windowHeight / 2 ? "up" : "down";
    }
  });

  function toggleOnramperModal() {
    showOnramperModal = !showOnramperModal;
  }
</script>

<Panel
  variant="transparent"
  width="auto"
  className="max-w-xl !rounded-xl !p-4 !h-full"
>
  <div
    class="flex flex-col min-h-[165px] max-h-[220px] box-border relative rounded-lg"
  >
    <header>
      <div class="flex items-center justify-between gap-4 min-h-[1rem] mb-5">
        <h2
          class="text-2xl font-semibold text-kong-text-primary m-0 tracking-tight leading-none"
        >
          {title}
        </h2>
        <div class="flex items-center gap-2">
          {#if panelType === "pay"}
            <button
              class="onramp-button"
              on:click={(e) => {
                e.preventDefault();
                window.open("https://buy.onramper.com/?apikey=pk_prod_01JHJ6KCSBFD6NEN8Q9PWRBKXZ&mode=buy&defaultCrypto=icp_icp", '_blank', 'width=500,height=650');
              }}
            >
              Buy ICP with Fiat
            </button>
          {/if}
          {#if showPrice && $animatedSlippage > 0}
            <div
              class="flex items-center gap-1.5 bg-white/10 p-1 rounded-md"
              title="Price Impact"
            >
              <span
                class="text-[0.875rem] font-medium text-kong-text-primary uppercase tracking-wide"
              >
                Impact
              </span>
              <span
                class="text-[1rem] font-semibold text-kong-text-primary"
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
            class="flex-1 min-w-0 bg-transparent border-none text-kong-text-primary text-[clamp(1.5rem,8vw,2.5rem)] font-medium tracking-tight w-full relative z-10 p-0 mt-[-0.25rem] opacity-85 focus:outline-none focus:text-kong-text-primary disabled:text-kong-text-primary placeholder:text-kong-text-primary"
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
                windowWidth: window.innerWidth,
              };
              swapState.update((s) => ({
                ...s,
                tokenSelectorPosition: position,
                tokenSelectorOpen: panelType,
              }));
              handleTokenSelect(event);
            }}
          >
            {#if token}
              <div class="token-info">
                <TokenImages tokens={[token]} size={32} />
                <span class="token-symbol hide-on-mobile">{token.symbol}</span>
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="chevron"
              >
                <path
                  fill-rule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clip-rule="evenodd"
                />
              </svg>
            {:else}
              <span class="select-token-text">Select Token</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="chevron"
              >
                <path
                  fill-rule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clip-rule="evenodd"
                />
              </svg>
            {/if}
          </button>
          <TokenSelectorDropdown
            show={$swapState.tokenSelectorOpen === panelType}
            onSelect={() => {
              swapState.update((s) => ({ ...s, tokenSelectorOpen: null }));
              onTokenSelect();
            }}
            onClose={() =>
              swapState.update((s) => ({ ...s, tokenSelectorOpen: null }))}
            currentToken={token}
            otherPanelToken={otherToken}
            {expandDirection}
          />
        </div>
      </div>
    </div>

    <footer class="text-kong-text-primary text-[clamp(0.75rem,2vw,0.875rem)]">
      <div class="flex justify-between items-center leading-6">
        <div class="flex items-center gap-2">
          <span
            class="text-kong-text-primary font-normal tracking-wide mobile-text"
            >Value</span
          >
          <span
            class="pl-1 text-kong-text-primary font-medium tracking-wide mobile-text"
          >
            ${formatToNonZeroDecimal(tradeUsdValue)}
          </span>
        </div>
        {#if token}
          <div class="flex items-center gap-2">
            <span
              class="text-kong-text-primary font-normal tracking-wide mobile-text"
            >
              Available:
            </span>
            <button
              class="pl-1 text-kong-text-primary font-semibold tracking-tight mobile-text"
              class:clickable={title === "You Pay" && !disabled}
              on:click={handleMaxClick}
            >
              {formatTokenBalance(
                $storedBalancesStore[token.canister_id]?.in_tokens.toString() ||
                  "0",
                token.decimals,
              )}
              {token.symbol}
            </button>
          </div>
        {/if}
      </div>
    </footer>
  </div>
</Panel>

<Modal
  isOpen={showOnramperModal}
  onClose={toggleOnramperModal}
  title="Buy ICP with Fiat"
  width="420px"
  height="630px"
>
  <iframe
    src="https://buy.onramper.com/?apikey=pk_prod_01JHJ6KCSBFD6NEN8Q9PWRBKXZ&mode=buy"
    title="Onramper Widget"
    height="630px"
    width="420px"
    allow="accelerometer; autoplay; camera; gyroscope; payment; microphone"
    class="w-full h-full"
  />
</Modal>

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
    min-width: 100px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 0.75rem;
    padding: 0.75rem;
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
    color: rgb(var(--text-primary));
    @apply font-semibold text-lg;
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
    color: rgb(var(--text-primary) / 0.7);
    text-align: left;
  }

  .chevron {
    width: 1.25rem;
    height: 1.25rem;
    color: rgb(var(--text-primary) / 0.5);
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
    background-color: rgb(var(--text-primary) / 0.5);
    animation: bounce 1.4s infinite ease-in-out both;
  }

  .loading-dots span:nth-child(1) {
    animation-delay: -0.32s;
  }

  .loading-dots span:nth-child(2) {
    animation-delay: -0.16s;
  }

  @keyframes bounce {
    0%,
    80%,
    100% {
      transform: scale(0);
      opacity: 0.3;
    }
    40% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .onramp-button {
    @apply font-semibold text-sm;
    @apply text-kong-text-primary/70 hover:text-kong-text-primary/90;
    @apply bg-kong-primary/40 hover:bg-kong-primary/60;
    @apply px-4 py-0.5 rounded-lg;
    @apply border border-kong-primary/80;
    @apply cursor-pointer;
    @apply transition-all duration-200 ease-in-out;
  }

  @media (max-width: 420px) {
    .onramp-button {
      font-size: 0.75rem;
      padding: 0.375rem 0.75rem;
    }
  }
</style>
