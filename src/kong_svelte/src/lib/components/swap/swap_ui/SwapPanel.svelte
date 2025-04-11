<script lang="ts">
  import { formatTokenBalance } from "$lib/utils/tokenFormatters";
  import Panel from "$lib/components/common/Panel.svelte";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import {
    currentUserBalancesStore,
  } from "$lib/stores/tokenStore";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { toastStore } from "$lib/stores/toastStore";
  import { swapState } from "$lib/services/swap/SwapStateService";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { onMount } from "svelte";
  import { 
    swapPanelRoundness, 
    swapPanelBorder, 
    swapPanelShadow, 
    swapPanelBorderStyle, 
    swapPanelInputsRounded, 
    transparentSwapPanel 
  } from "$lib/stores/derivedThemeStore";
  
  let isWin95Border = $derived($swapPanelBorderStyle === 'win95');
  
  let {
    title,
    token,
    amount,
    onAmountChange,
    disabled,
    showPrice,
    slippage,
    panelType,
    isLoading = false,
  } = $props<{
    title: string;
    token: FE.Token;
    amount: string;
    onAmountChange: (event: CustomEvent) => void;
    disabled: boolean;
    showPrice: boolean;
    slippage: number;
    panelType: "pay" | "receive";
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
  let previousValue = $state("0");
  let isMobile = $state(false);

  // Derived state using runes
  let decimals = $derived(token?.decimals || DEFAULT_DECIMALS);
  let isIcrc1 = $derived(token?.icrc1 && !token?.icrc2);

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

  // Animation and value updates using $effect
  $effect(() => {
    if (amount === "0") {
      // Update animated values directly using tradeUsdValue
      animatedUsdValue.set(0, { duration: 0 }); // Reset directly for 0 amount
    } else {
      const currentValue = $animatedUsdValue;
      // Use tradeUsdValue for calculation
      const valueDiff = Math.abs(tradeUsdValue - currentValue);
      const duration = Math.min(
        ANIMATION_MAX_DURATION,
        ANIMATION_BASE_DURATION + valueDiff * ANIMATION_VALUE_MULTIPLIER,
      );

      // Use tradeUsdValue for setting the tweened value
      animatedUsdValue.set(tradeUsdValue, {
        duration,
        easing: cubicOut,
      });
    }

    animatedSlippage.set(slippage, { duration: 0 });
  });

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
        if (!token) {
          console.error("Token info missing");
          toastStore.error("Invalid token configuration");
          return;
        }

        const balance = $currentUserBalancesStore[token.canister_id]?.in_tokens;
        if (!balance) {
          console.error("Balance not available for token", token.symbol);
          toastStore.error(`Balance not available for ${token.symbol}`);
          return;
        }

        // Calculate fees using token prop directly
        const feesInTokens = token.fee_fixed
          ? BigInt(token.fee_fixed.toString().replace(/_/g, "")) *
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
  // Use token prop directly for price
  let tokenPrice = $derived(
    token ? Number(token?.metrics?.price || 0) : 0,
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
</script>

<Panel
  variant={$transparentSwapPanel ? "transparent" : "solid"}
  width="auto"
  type="main"
  className="w-full max-w-2xl !p-4 !h-full {isWin95Border ? 'win95-panel' : ''}"
  roundness={$swapPanelRoundness}
  isSwapPanel={true}
>
  <div
    class="flex flex-col min-h-[165px] max-h-[220px] box-border relative"
    style="--swap-panel-border: {$swapPanelBorder}; --swap-panel-shadow: {$swapPanelShadow};"
  >
    <header>
      <div class="flex items-center justify-between gap-4 min-h-[1rem] mb-5">
        <h2
          class="text-lg sm:text-2xl lg:text-xl font-semibold text-kong-text-primary m-0 tracking-tight leading-none"
        >
          {title}
        </h2>
        <div class="flex items-center gap-2">
          {#if panelType === "pay"}
            <button
              class="onramp-button font-semibold text-xs text-kong-text-primary/70 hover:text-kong-text-primary/90 bg-kong-primary/40 hover:bg-kong-primary/60 px-4 py-0.5 border border-kong-primary/80 cursor-pointer transition-all duration-200 ease-in-out sm:text-sm sm:py-1.5 sm:px-3"
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
                class="text-xs sm:text-[0.875rem] font-medium text-kong-text-primary uppercase tracking-wide"
              >
                Impact
              </span>
              <span
                class="text-sm sm:text-[1rem] font-semibold text-kong-text-primary"
                class:text-kong-accent-red={$animatedSlippage >= HIGH_IMPACT_THRESHOLD}
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
              <div class="loading-dots flex gap-[6px] items-center justify-start pl-[4px]">
                <span class="w-[8px] h-[8px] rounded-full bg-kong-text-primary/50 animate-bounce delay-[-0.32s]"></span>
                <span class="w-[8px] h-[8px] rounded-full bg-kong-text-primary/50 animate-bounce delay-[-0.16s]"></span>
                <span class="w-[8px] h-[8px] rounded-full bg-kong-text-primary/50 animate-bounce"></span>
              </div>
            </div>
          {/if}
          <input
            bind:this={inputElement}
            type="text"
            inputmode="decimal"
            pattern="[0-9]*"
            placeholder="0.00"
            class="flex-1 min-w-0 bg-transparent border-none text-kong-text-primary font-medium tracking-tight w-full relative z-10 p-0 mt-[-0.25rem] opacity-85 focus:outline-none focus:text-kong-text-primary disabled:text-kong-text-primary placeholder:text-kong-text-primary text-3xl lg:text-4xl sm:mt-[-0.15rem]"
            class:opacity-0={isLoading && panelType === "receive"}
            class:rounded-md={$swapPanelInputsRounded}
            value={formattedDisplayAmount}
            on:input={handleInput}
            on:focus={() => (inputFocused = true)}
            on:blur={() => (inputFocused = false)}
            {disabled}
            readonly={panelType === "receive"}
          />
        </div>
        <div class="relative">
          <button
            class="flex items-center justify-between bg-white/5 p-2 border border-white/10 transition-colors duration-150 gap-2 hover:bg-white/10 sm:min-w-0 sm:gap-2 sm:p-2 sm:pr-3 {isWin95Border ? 'win95-button' : ''} w-full"
            class:rounded-xl={$swapPanelInputsRounded && !isWin95Border}
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
              <div class="flex items-center gap-2">
                <TokenImages tokens={[token]} size={32} />
                <span class="hidden text-lg font-semibold text-kong-text-primary sm:inline">{token.symbol}</span>
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="chevron w-5 h-5 text-kong-text-primary/50"
              >
                <path
                  fill-rule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clip-rule="evenodd"
                />
              </svg>
            {:else}
              <span class="text-lg text-kong-text-primary/70 text-left">Select Token</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="chevron w-5 h-5 text-kong-text-primary/50"
              >
                <path
                  fill-rule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clip-rule="evenodd"
                />
              </svg>
            {/if}
          </button>
        </div>
      </div>
    </div>

    <div class="text-kong-text-primary text-sm">
      <div class="flex justify-between items-center leading-6">
        <div class="flex items-center gap-1">
          <span
            class="text-kong-text-primary font-normal tracking-wide text-xs sm:text-xs"
            >Value:</span
          >
          <span
            class="text-kong-text-primary font-medium tracking-wide text-xs sm:text-xs"
          >
            ${formatToNonZeroDecimal(tradeUsdValue)}
          </span>
        </div>
        {#if token}
          <div class="flex items-center gap-1 min-w-[160px] justify-end">
            <span
              class="text-kong-text-primary font-normal tracking-wide text-xs sm:text-xs"
            >
              Available:
            </span>
            <button
              class="text-kong-text-primary font-semibold tracking-tight text-xs sm:text-xs"
              class:clickable={title === "You Pay" && !disabled}
              class:hover:text-yellow-500={title === 'You Pay' && !disabled}
              on:click={handleMaxClick}
            >
              {#if token && token.canister_id && $currentUserBalancesStore}
                {#if $currentUserBalancesStore[token.canister_id]}
                  {formatTokenBalance(
                    ($currentUserBalancesStore[token.canister_id]?.in_tokens || 0).toString(),
                    token.decimals || DEFAULT_DECIMALS
                  )}
                  {token.symbol || ''}
                {:else}
                  <!-- Log what's happening for debugging -->
                  0 {token.symbol || ''}
                {/if}
              {:else}
                Loading...
              {/if}
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
</Panel>

<style lang="postcss" scoped>
  .win95-button {
    background-color: #C3C3C3 !important;
    border: none !important;
    position: relative;
    border-radius: 0 !important;
    box-shadow: inset 1px 1px 0 #FFFFFF, inset -1px -1px 0 #808080, inset 2px 2px 0 #DFDFDF, inset -2px -2px 0 #404040 !important;
    padding: 4px 8px !important;
  }
  
  .win95-button:active {
    box-shadow: inset -1px -1px 0 #FFFFFF, inset 1px 1px 0 #808080, inset -2px -2px 0 #DFDFDF, inset 2px 2px 0 #404040 !important;
    padding-top: 5px !important;
    padding-left: 9px !important;
  }
</style>
