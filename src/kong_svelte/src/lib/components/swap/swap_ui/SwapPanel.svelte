<script lang="ts">
  import { formatTokenBalance } from "$lib/utils/tokenFormatters";
  import Panel from "$lib/components/common/Panel.svelte";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { currentUserBalancesStore } from "$lib/stores/tokenStore";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { toastStore } from "$lib/stores/toastStore";
  import { swapState } from "$lib/stores/swapStateStore";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { onMount } from "svelte";
  import {
    transparentSwapPanel,
    panelRoundness,
  } from "$lib/stores/derivedThemeStore";
  import { calculatePercentageAmount } from "$lib/utils/numberFormatUtils";
  import { Wallet } from "lucide-svelte";
  import { app } from "$lib/state/app.state.svelte";

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
    token: Kong.Token;
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

  // State management using runes
  let inputElement = $state<HTMLInputElement | null>(null);
  let inputFocused = $state(false);
  let localInputValue = $state(
    formatWithCommas(formatDisplayValue(amount || "0")),
  ); // Initialize with formatted prop
  let previousAmountProp = $state(amount); // Track prop changes
  let isMobile = $derived(app.isMobile);

  // Derived state using runes
  let decimals = $derived(token?.decimals || DEFAULT_DECIMALS);
  let maxDecimals = $derived(isMobile ? MAX_DISPLAY_DECIMALS_MOBILE : MAX_DISPLAY_DECIMALS_DESKTOP);

  // Initialize window-dependent values
  let windowWidth = $state(0);
  let windowHeight = $state(0);
  let expandDirection = $state("down"); // default value

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
    // Allow trailing decimal point for input
    if (value.endsWith(".")) {
      const parts = value.slice(0, -1).split(".");
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return parts.join(".") + ".";
    }
    const parts = value.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  }

  // Format display value with proper decimals - keep raw precision for calculations
  function formatDisplayValue(value: string): string {
    if (!value || value === "0") return "0";
    if (value === "0.") return "0."; // Preserve trailing decimal for input

    const parts = value.split(".");

    if (parts.length === 2) {
      // Truncate for display only, not for the actual state value sent upwards
      if (parts[1].length > maxDecimals) {
        // Keep full precision internally, but maybe truncate display if needed?
        // For now, let formatWithCommas handle display formatting.
        // This function primarily ensures the value structure is reasonable.
        // Let's just return the value clipped to token decimals for internal consistency before formatting
        return `${parts[0]}.${parts[1].slice(0, decimals)}`;
      }
      if (parts[1].length === 0) return parts[0] + "."; // Keep trailing dot if user typed it
      return parts.join(".");
    }
    return parts[0]; // Return whole number
  }

  // Validate numeric input
  function isValidNumber(value: string): boolean {
    if (!value) return true; // Allow empty input during typing
    // Allow numbers with optional single decimal point
    const regex = /^[0-9]*\.?[0-9]*$/;
    return regex.test(value);
  }

  // Update local state ONLY when the input is NOT focused
  // OR when the amount prop changes significantly (e.g., reset, token switch)
  $effect(() => {
    if (amount !== previousAmountProp) {
      // Detect external changes from prop
      if (!inputFocused || amount === "" || amount === "0") {
        // Update local value based on focus state
        const displayValue = inputFocused
          ? formatDisplayValue(amount || "0")
          : formatWithCommas(formatDisplayValue(amount || "0"));
        localInputValue = displayValue;
        if (inputElement) {
          // Update element value directly
          inputElement.value = displayValue;
        }
      }
      previousAmountProp = amount; // Update tracker regardless
    }
  });

  // Initialize input value on mount
  $effect(() => {
    if (inputElement && !localInputValue && !inputFocused) {
      // Set initial value based on prop if local state is empty and not focused
      const initialFormatted = formatWithCommas(
        formatDisplayValue(amount || "0"),
      );
      localInputValue = initialFormatted;
      inputElement.value = initialFormatted;
    }
  });

  // Animation and value updates using $effect (for USD value, slippage animation)
  $effect(() => {
    // Use the main 'amount' prop for animations, not localInputValue
    const currentNumericAmount = parseFloat(amount || "0");
    const currentUsdValue = tokenPrice * currentNumericAmount;

    if (amount === "0" || !amount) {
      animatedUsdValue.set(0, { duration: 0 });
    } else {
      const existingAnimatedValue = $animatedUsdValue;
      const valueDiff = Math.abs(currentUsdValue - existingAnimatedValue);
      const duration = Math.min(
        ANIMATION_MAX_DURATION,
        ANIMATION_BASE_DURATION + valueDiff * ANIMATION_VALUE_MULTIPLIER,
      );
      animatedUsdValue.set(currentUsdValue, { duration, easing: cubicOut });
    }

    animatedSlippage.set(slippage, { duration: 0 });
  });

  // Event handlers
  function handleInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let rawValue = input.value;

    // Basic validation for numeric characters and single decimal point
    if (!isValidNumber(rawValue)) {
      input.value = localInputValue; // Revert display to last known good local value
      return;
    }

    // Handle excessive decimals - trim raw value
    if (rawValue.includes(".")) {
      const [whole, decimal] = rawValue.split(".");
      if (decimal && decimal.length > decimals) {
        rawValue = `${whole}.${decimal.slice(0, decimals)}`;
      } else if (decimal === "") {
        // Allow trailing decimal point during input
      }
    }

    // Handle leading zeros (e.g., "05" -> "5", but allow "0.")
    if (
      rawValue.length > 1 &&
      rawValue.startsWith("0") &&
      rawValue[1] !== "."
    ) {
      rawValue = rawValue.replace(/^0+/, "");
    }
    // Allow starting input with "." -> "0."
    if (rawValue === ".") {
      rawValue = "0.";
    }

    // Update local state for display (no commas while focused)
    localInputValue = rawValue;
    input.value = rawValue; // Update the input element display value without commas

    // Determine the value to send upwards (should be clean number string, "0" if appropriate)
    let valueToSend = rawValue;
    if (valueToSend === "0.") {
      valueToSend = "0"; // Send "0" if user only typed the decimal point
    } else if (!valueToSend) {
      valueToSend = "0"; // Send "0" if input is empty
    }

    // Send the cleaned, raw numeric string value to the parent state service.
    onAmountChange(
      new CustomEvent("input", {
        detail: { value: valueToSend, panelType },
      }),
    );
  }

  function handleFocus() {
    inputFocused = true;
    // Remove commas when focused
    if (inputElement) {
      const rawValue = localInputValue.replace(/,/g, "");
      localInputValue = rawValue;
      inputElement.value = rawValue;
    }
  }

  function handleBlur() {
    inputFocused = false;
    // On blur, add commas to the display value
    const finalFormattedValue = formatWithCommas(
      formatDisplayValue(amount || "0"),
    );
    localInputValue = finalFormattedValue;
    if (inputElement) {
      inputElement.value = finalFormattedValue;
    }
    // If the raw value after formatting is essentially zero, send "0" upwards
    // This handles cases like typing "0.00" and blurring
    if (parseFloat(amount || "0") === 0 && amount !== "0") {
      onAmountChange(
        new CustomEvent("input", {
          detail: { value: "0", panelType },
        }),
      );
    }
  }

  // Token selector functionality
  function handleTokenSelect(event: MouseEvent) {
    if (disabled) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    // Adjust position calculation slightly if needed based on visual checks
    const position = {
      x: rect.right + 8, // Keep space from button
      y: rect.top,
      height: rect.height,
      windowWidth: window.innerWidth, // Use reactive windowWidth
      windowHeight: window.innerHeight, // Use reactive windowHeight
    };

    swapState.update((s) => ({
      ...s,
      showPayTokenSelector:
        panelType === "pay" ? !s.showPayTokenSelector : false,
      showReceiveTokenSelector:
        panelType === "receive" ? !s.showReceiveTokenSelector : false,
      tokenSelectorPosition: position,
      tokenSelectorOpen: panelType, // Always set which panel opened it
    }));

    // No need to re-trigger onAmountChange here unless token selection
    // should immediately clear/recalculate amounts.
    // The change will be handled when the token is actually selected.
  }

  // Display calculations using runes
  // Use the main 'amount' prop for calculations external to the input display
  let parsedAmount = $derived(parseFloat(amount || "0"));
  let tokenPrice = $derived(token ? Number(token?.metrics?.price || 0) : 0);
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

  // Use $effect for the dropdown direction calculation
  $effect(() => {
    if (typeof window !== "undefined") {
      // Check if we're in browser environment
      expandDirection =
        $swapState.tokenSelectorPosition?.y > windowHeight / 2 ? "up" : "down";
    }
  });

  function handlePercentageClick(percentage: number) {
    if (!token) {
      toastStore.error("Invalid token configuration");
      return;
    }

    const balance = $currentUserBalancesStore[token.address]?.in_tokens;
    if (balance === undefined || balance === null || balance === 0n) {
      toastStore.error(`Balance not available for ${token.symbol}`);
      return;
    }

    const percentageAmountString = calculatePercentageAmount(
      balance,
      percentage,
      token,
    );

    // Show raw value if focused, formatted if not
    const displayValue = inputFocused 
      ? formatDisplayValue(percentageAmountString)
      : formatWithCommas(formatDisplayValue(percentageAmountString));
    
    localInputValue = displayValue;
    if (inputElement) {
      inputElement.value = displayValue;
    }

    onAmountChange(
      new CustomEvent("input", {
        detail: { value: percentageAmountString, panelType },
      }),
    );
  }
</script>

<Panel
  variant={$transparentSwapPanel ? "transparent" : "solid"}
  width="auto"
  type="main"
  className="w-full max-w-2xl !p-4 !h-full !rounded-kong-roundness !shadow-kong-shadow"
  isSwapPanel={true}
>
  <div class="flex flex-col gap-4 min-h-[140px] box-border relative">
    <header>
      <div class="flex items-center justify-between">
        <h2
          class="text-lg sm:text-2xl lg:text-base font-semibold text-kong-text-secondary/70 m-0 tracking-tight leading-none"
        >
          {title}
        </h2>
        <div class="flex items-center gap-2">
          {#if panelType === "pay"}
            <!-- OnRamp Button -->
            <button
              class="{$panelRoundness} text-xs text-kong-text-secondary hover:text-kong-text-primary bg-kong-bg-tertiary hover:bg-kong-bg-secondary px-2.5 border border-kong-border cursor-pointer transition-all duration-200 ease-in-out sm:text-xs py-0.5 sm:px-2"
              onclick={(e) => {
                e.preventDefault();
                window.open(
                  "https://buy.onramper.com/?apikey=pk_prod_01JHJ6KCSBFD6NEN8Q9PWRBKXZ&mode=buy&defaultCrypto=icp_icp",
                  "_blank",
                  "width=500,height=650",
                );
              }}
            >
              Buy ICP with Fiat
            </button>
          {/if}
        </div>
      </div>
    </header>

    <div class="relative flex-grow">
      <div class="flex items-center gap-2.5 box-border {$panelRoundness}">
        <div class="relative flex-1">
          {#if isLoading && panelType === "receive"}
            <!-- Loading Dots -->
            <div class="absolute inset-0 flex items-center">
              <div
                class="loading-dots flex gap-[6px] items-center justify-start pl-[4px]"
              >
                <span
                  class="w-[8px] h-[8px] rounded-full bg-kong-text-primary/50 animate-bounce delay-[-0.32s]"
                ></span>
                <span
                  class="w-[8px] h-[8px] rounded-full bg-kong-text-primary/50 animate-bounce delay-[-0.16s]"
                ></span>
                <span
                  class="w-[8px] h-[8px] rounded-full bg-kong-text-primary/50 animate-bounce"
                ></span>
              </div>
            </div>
          {/if}
          <input
            bind:this={inputElement}
            type="text"
            inputmode="decimal"
            pattern="[0-9]*\\.?[0-9]*"
            placeholder="0.00"
            class="flex-1 min-w-0 bg-transparent items-center border-none text-kong-text-primary font-medium tracking-tight w-full relative z-10 p-0 focus:outline-none focus:text-kong-text-primary disabled:text-kong-text-primary/50 placeholder:text-kong-text-primary/60 text-3xl lg:text-3xl {isLoading &&
            panelType === 'receive'
              ? 'opacity-0'
              : 'opacity-85'}"
            value={localInputValue}
            oninput={handleInput}
            onfocus={handleFocus}
            onblur={handleBlur}
            {disabled}
          />
          <!-- USD Value Display -->
          <span
            class="absolute -bottom-5 left-0 text-kong-text-primary/50 font-medium text-xs"
          >
            {#if $animatedUsdValue > 0}
              ≈${formatToNonZeroDecimal($animatedUsdValue)}
            {/if}
          </span>
        </div>
        <div class="relative">
          <!-- Token Selector Button -->
          <button
            class="flex items-center {$panelRoundness} justify-between bg-kong-bg-tertiary p-2 border border-kong-border transition-colors duration-150 gap-2 hover:bg-kong-hover/10 sm:min-w-0 sm:gap-2 sm:p-2 sm:pr-3 w-full"
            onclick={(e) => {
              e.stopPropagation();
              handleTokenSelect(e);
            }}
          >
            {#if token}
              <div class="flex items-center gap-2">
                <TokenImages tokens={[token]} size={28} />
                <span
                  class="hidden text-lg pt-0.5 font-semibold text-kong-text-primary sm:inline flex items-center"
                  >{token.symbol}</span
                >
              </div>
              <!-- Chevron Down Icon -->
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
              <span class="text-lg text-kong-text-primary/70 text-left"
                >Select Token</span
              >
              <!-- Chevron Down Icon -->
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

    <div class="text-kong-text-primary text-sm mt-2">
      <div class="flex justify-between items-center leading-5">
        <div class="flex flex-col w-full items-start justify-start gap-0">
          <div class="flex items-center w-full gap-1 py-1">
            <span
              class="text-kong-text-secondary/80 mr-0.5 font-normal tracking-wide text-xs sm:text-xs"
            >
              <Wallet class="w-3.5 h-3.5" />
            </span>
            <button
              class="text-kong-text-secondary font-semibold tracking-tight text-xs sm:text-sm"
              class:clickable={title === "You Pay" && !disabled}
              class:hover:text-yellow-500={title === "You Pay" && !disabled}
              onclick={() => handlePercentageClick(100)}
              disabled={disabled || title !== "You Pay"}
            >
              {#if token && token.address && $currentUserBalancesStore && $currentUserBalancesStore[token.address] !== undefined}
                {formatWithCommas(formatTokenBalance(
                  (
                    $currentUserBalancesStore[token.address]?.in_tokens ?? 0n
                  ).toString(), // Use nullish coalescing for safety
                  token.decimals || DEFAULT_DECIMALS,
                ))}
                {token.symbol || ""}
              {:else if token}
                0 {token.symbol || ""} <!-- Show 0 if balance not loaded -->
              {:else}
                Loading... <!-- Show loading if token itself is not loaded -->
              {/if}
            </button>
          </div>
        </div>
        {#if token}
          <!-- Balance Display -->
          <div class="flex flex-col items-center gap-1">
            {#snippet percentageButton(percentage: number, isFirst: boolean, isLast: boolean)}
              <button
                class="bg-kong-bg-tertiary px-2 py-1 text-xs border border-kong-border hover:border-kong-primary/50 hover:bg-kong-hover/10 transition-all duration-150 {isFirst
                  ? 'rounded-l-md'
                  : ''} {isLast ? 'rounded-r-md' : ''}"
                onclick={() => handlePercentageClick(percentage)}
                {disabled}
              >
                {percentage}%
              </button>
            {/snippet}

            <!-- Percentage Buttons -->
            {#if (title === "You Pay" || title === "Send") && token}
              {@const percentages = isMobile ? [50, 100] : [25, 50, 75, 100]}
              <div
                class="flex items-center justify-end w-full"
              >
                {#each percentages as percentage, index (percentage)}
                  {@render percentageButton(
                    percentage,
                    index === 0,
                    index === percentages.length - 1,
                  )}
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
</Panel>

<style lang="postcss" scoped>
  .win95-button {
    background-color: #c3c3c3 !important;
    border: none !important;
    position: relative;
    border-radius: 0 !important;
    box-shadow:
      inset 1px 1px 0 #ffffff,
      inset -1px -1px 0 #808080,
      inset 2px 2px 0 #dfdfdf,
      inset -2px -2px 0 #404040 !important;
    padding: 4px 8px !important;
  }

  .win95-button:active {
    box-shadow:
      inset -1px -1px 0 #ffffff,
      inset 1px 1px 0 #808080,
      inset -2px -2px 0 #dfdfdf,
      inset 2px 2px 0 #404040 !important;
    padding-top: 5px !important;
    padding-left: 9px !important;
  }

  input:disabled {
    cursor: not-allowed;
    opacity: 0.6; /* Make disabled inputs look more obviously disabled */
  }
</style>
