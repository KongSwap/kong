<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    formatBalance,
    parseTokenAmount,
    formatToNonZeroDecimal,
  } from "$lib/utils/numberFormatUtils";
  import { poolStore } from "$lib/services/pools/poolStore";
  import Portal from "svelte-portal";
  import TokenSelectorDropdown from "$lib/components/swap/swap_ui/TokenSelectorDropdown.svelte";
  import { PoolService } from "$lib/services/pools/PoolService";
  import Panel from "$lib/components/common/Panel.svelte";
  import AddLiquidityConfirmation from "./AddLiquidityConfirmation.svelte";
  import { Tween } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { auth } from "$lib/services/auth";
  import { loadBalances, tokenStore, liveTokens } from "$lib/services/tokens/tokenStore";
  import debounce from "lodash-es/debounce";
  import { toastStore } from "$lib/stores/toastStore";
  import { BigNumber } from "bignumber.js";
  import {
    CKUSDT_CANISTER_ID,
    ICP_CANISTER_ID,
  } from "$lib/constants/canisterConstants";
  import {
    calculateMaxAmount,
    hasInsufficientBalance,
    getPoolForTokenPair,
    validateTokenSelect
  } from "$lib/utils/liquidityUtils";
  import {
    getButtonText,
    calculatePoolRatio,
    calculateUsdRatio,
    formatLargeNumber,
  } from "$lib/utils/liquidityUtils";
  import {
    handleFormattedNumberInput,
    isValidNumber,
    formatWithCommas,
    createInputState,
    handleInputBlur,
    validateAndCleanInput
  } from "$lib/utils/formUtils";
  import { addLiquidityStore } from "$lib/services/pools/addLiquidityStore";
  import { goto } from "$app/navigation";

  export let token0: FE.Token | null = null;
  export let token1: FE.Token | null = null;
  export let amount0: string = null;
  export let amount1: string = null;
  export let loading: boolean = false;
  export let error: string | null = null;
  export let token0Balance: string;
  export let token1Balance: string;
  export let onTokenSelect: (index: 0 | 1) => void;
  export let onInput: (index: 0 | 1, value: string) => void;
  export let onSubmit: () => Promise<void>;
  export let pool: BE.Pool | null = null;
  export let showConfirmation = false;

  const ALLOWED_TOKEN_SYMBOLS = ["ICP", "ckUSDT"];
  const DEFAULT_TOKEN = "ICP";
  const DEFAULT_DECIMALS = 8;
  const ANIMATION_BASE_DURATION = 200;

  let showToken0Selector = false;
  let showToken1Selector = false;
  let loadingState = "";

  const SECONDARY_TOKEN_IDS = [ICP_CANISTER_ID, CKUSDT_CANISTER_ID];

  let userIsTyping = false;
  let typingTimeout: ReturnType<typeof setTimeout> | undefined;

  let finalLoading = false;
  let finalLoadingState = "";
  $: {
    if (userIsTyping) {
      finalLoading = false;
      finalLoadingState = "";
    } else {
      finalLoading = loading;
      finalLoadingState = loadingState;
    }
  }

  $: token0Balance =
    $tokenStore.balances[token0?.canister_id]?.in_tokens?.toString() || "0";
  $: token1Balance =
    $tokenStore.balances[token1?.canister_id]?.in_tokens?.toString() || "0";

  let lastChanged: 0 | 1 | null = null;

  let input0State = createInputState();
  let input1State = createInputState();

  function handleTokenSelect(index: 0 | 1, token: FE.Token) {
    const otherToken = index === 0 ? token1 : token0;
    const result = validateTokenSelect(
      token,
      otherToken,
      ALLOWED_TOKEN_SYMBOLS,
      DEFAULT_TOKEN,
      $liveTokens
    );

    if (!result.isValid) {
      toastStore.error(result.error);
      if (index === 0) {
        token0 = result.newToken;
      } else {
        token1 = result.newToken;
      }
      return;
    }

    if (index === 0) {
      token0 = result.newToken;
      showToken0Selector = false;
    } else {
      token1 = result.newToken;
      showToken1Selector = false;
    }
    onTokenSelect(index);
  }

  // Add reactive statement to handle token changes
  $: {
    if (
      token0 &&
      token1 &&
      (parseFloat(amount0?.replace(/[,_]/g, '') || '0') > 0 || parseFloat(amount1?.replace(/[,_]/g, '') || '0') > 0)
    ) {
      const currentToken = lastChanged === 0 ? token0 : token1;
      const otherToken = lastChanged === 0 ? token1 : token0;
      const value = lastChanged === 0 ? amount0 : amount1;

      if (value && currentToken && otherToken) {
        debouncedHandleInput(lastChanged, value, currentToken, otherToken);
      }
    }
  }

  // Input state management
  let input0Element: HTMLInputElement | null = null;
  let input1Element: HTMLInputElement | null = null;
  let input0Focused = false;
  let input1Focused = false;

  // Animated values for smooth transitions
  const animatedUsdValue0 = new Tween(0, {
    duration: ANIMATION_BASE_DURATION,
    easing: cubicOut,
  });

  const animatedUsdValue1 = new Tween(0, {
    duration: ANIMATION_BASE_DURATION,
    easing: cubicOut,
  });

  // Create debounced version of the input handler with shorter delay
  const debouncedHandleInput = debounce(
    async (
      index: 0 | 1,
      value: string,
      currentToken: FE.Token,
      otherToken: FE.Token,
    ) => {
      try {
        // Clean the value by removing underscores before parsing
        const cleanValue = value.replace(/[,_]/g, "");
        let inputAmount = parseTokenAmount(cleanValue, currentToken.decimals);

        if (!poolExists) {
          // For new pools, calculate based on initial price
          const initialPrice = $addLiquidityStore.initialPrice;
          const amounts = calculateInitialAmounts(
            cleanValue,
            index === 0 ? initialPrice : new BigNumber(1).dividedBy(initialPrice).toString(),
            index === 0 ? token0 : token1,
            index === 0 ? token1 : token0
          );

          if (!amounts) {
            throw new Error("Failed to calculate amounts with initial price");
          }

          if (index === 0) {
            amount1 = amounts.amount1;
            if (input1Element) input1Element.value = formatWithCommas(amounts.amount1);
          } else {
            amount0 = amounts.amount0;
            if (input0Element) input0Element.value = formatWithCommas(amounts.amount0);
          }
        } else {
          // Existing pool logic
          const requiredAmount = await PoolService.addLiquidityAmounts(
            index === 0 ? token0.symbol : token1.symbol,
            inputAmount,
            index === 0 ? token1.symbol : token0.symbol,
          );

          if (!requiredAmount.Ok) {
            throw new Error("Failed to calculate required amount");
          }

          // Only update the non-active input
          if (index === 0) {
            // User modified top input, only update bottom input
            amount1 = formatBalance(
              requiredAmount.Ok.amount_1,
              token1.decimals,
            ).toString();
            if (input1Element) input1Element.value = amount1;
          } else {
            // User modified bottom input, only update top input
            amount0 = formatBalance(
              requiredAmount.Ok.amount_0,
              token0.decimals,
            ).toString();
            if (input0Element) input0Element.value = amount0;
          }
        }

        // Call the parent's onInput handler with the user's input value
        onInput(index, value);
      } catch (err) {
        console.error("Error in debouncedHandleInput:", err);
        error = err.message;
      }
    },
    500,
  );

  // Enhanced input handling
  async function handleInput(index: 0 | 1, event: Event) {
    if (!token0 || !token1) return;
    
    const inputElement = event.target as HTMLInputElement;
    let value = inputElement.value.replace(/[,_]/g, "");

    if (!isValidNumber(value)) {
      inputElement.value = index === 0 ? amount0 : amount1;
      return;
    }

    // Handle decimal point
    if (value.includes(".")) {
      const [whole, decimal] = value.split(".");
      const currentToken = index === 0 ? token0 : token1;
      const maxDecimals = currentToken?.decimals || DEFAULT_DECIMALS;
      value = `${whole}.${decimal.slice(0, maxDecimals)}`;
    }

    // Remove leading zeros unless it's "0." or just "0"
    if (value.length > 1 && value.startsWith("0") && value[1] !== ".") {
      value = value.replace(/^0+/, "");
    }

    // If empty or invalid after processing, set to "0"
    if (!value || value === ".") {
      value = "0";
    }

    const currentToken = index === 0 ? token0 : token1;
    const otherToken = index === 0 ? token1 : token0;

    if (!currentToken || !otherToken) {
      error = "Please select both tokens.";
      return;
    }

    // Update the input value
    inputElement.value = value;

    if (!poolExists) {
      // For new pools, calculate amounts based on initial price
      const initialPrice = $addLiquidityStore.initialPrice;
      if (index === 0) {
        const amounts = calculateInitialAmounts(value, initialPrice, token0, token1);
        if (amounts) {
          amount0 = amounts.amount0;
          amount1 = amounts.amount1;
          if (input1Element) input1Element.value = formatWithCommas(amounts.amount1);
        }
      } else {
        // If user is entering amount1, calculate amount0 based on inverse of initial price
        const inversePrice = new BigNumber(1).dividedBy(new BigNumber(initialPrice)).toString();
        const amounts = calculateInitialAmounts(value, inversePrice, token1, token0);
        if (amounts) {
          amount1 = amounts.amount0;
          amount0 = amounts.amount1;
          if (input0Element) input0Element.value = formatWithCommas(amounts.amount1);
        }
      }
    } else {
      // Existing pool logic remains the same
      debouncedHandleInput(index, value, currentToken, otherToken);
    }

    lastChanged = index;
  }

  // Remove the blur handler as we don't need formatting anymore
  function handleBlur(index: 0 | 1) {
    if (index === 0) {
      input0Focused = false;
    } else {
      input1Focused = false;
    }
  }

  // Update max button handler
  async function handleMaxClick(index: 0 | 1) {
    const currentToken = index === 0 ? token0 : token1;
    const currentBalance = index === 0 ? token0Balance : token1Balance;
    const otherToken = index === 0 ? token1 : token0;

    if (!currentToken || !otherToken) return;

    try {
      const feeMultiplier = currentToken.icrc2 ? 2 : 1;
      const rawValue = await calculateMaxAmount(
        currentToken,
        currentBalance,
        feeMultiplier,
      );

      if (!poolExists) {
        // For new pools, use initial price ratio
        const initialPrice = $addLiquidityStore.initialPrice;
        const amounts = calculateInitialAmounts(
          rawValue,
          index === 0 ? initialPrice : new BigNumber(1).dividedBy(initialPrice).toString(),
          index === 0 ? token0 : token1,
          index === 0 ? token1 : token0
        );

        if (amounts) {
          if (index === 0) {
            amount0 = amounts.amount0;
            amount1 = amounts.amount1;
            if (input0Element) input0Element.value = formatWithCommas(amounts.amount0);
            if (input1Element) input1Element.value = formatWithCommas(amounts.amount1);
          } else {
            amount1 = amounts.amount0;
            amount0 = amounts.amount1;
            if (input1Element) input1Element.value = formatWithCommas(amounts.amount0);
            if (input0Element) input0Element.value = formatWithCommas(amounts.amount1);
          }
        }
      } else {
        // Existing pool logic remains the same...
      }

      lastChanged = index;
    } catch (err) {
      console.error("Error in handleMaxClick:", err);
      error = err.message;
      toastStore.error(err.message);
    }
  }

  // Reactive declarations for USD values
  $: {
    if (token0?.metrics.price && amount0) {
      const cleanAmount = amount0.toString().replace(/[,_]/g, "");
      const value = new BigNumber(cleanAmount)
        .times(new BigNumber(token0.metrics.price))
        .toNumber();
      animatedUsdValue0.target = value;
    }
    if (token1?.metrics.price && amount1) {
      const cleanAmount = amount1.toString().replace(/[,_]/g, "");
      const value = new BigNumber(cleanAmount)
        .times(new BigNumber(token1.metrics.price))
        .toNumber();
      animatedUsdValue1.target = value;
    }
  }

  // Calculate and display pool ratio
  $: poolRatio = calculatePoolRatio(token0, token1, amount0, amount1);

  // Calculate USD ratio to show price relationship
  $: usdRatio = calculateUsdRatio(token0, token1);

  // Get pool when both tokens are selected
  $: if (token0 && token1) {
    loadBalances(
      auth.pnp.account?.owner?.toString(),
      { tokens: [token0, token1], forceRefresh: false }
    );
    pool = getPoolForTokenPair(token0, token1, $poolStore.pools);

    // Recalculate amounts when tokens change
    if (lastChanged !== null && (parseFloat(amount0?.replace(/[,_]/g, '') || '0') > 0 || parseFloat(amount1?.replace(/[,_]/g, '') || '0') > 0)) {
      const currentToken = lastChanged === 0 ? token0 : token1;
      const otherToken = lastChanged === 0 ? token1 : token0;
      const value = lastChanged === 0 ? amount0 : amount1;
      
      if (value && currentToken && otherToken) {
        debouncedHandleInput(lastChanged, value, currentToken, otherToken);
      }
    }
  } else {
    pool = null;
  }

  function openTokenSelector(index: 0 | 1) {
    if (index === 0) {
      showToken0Selector = true;
      showToken1Selector = false;
    } else {
      showToken1Selector = true;
      showToken0Selector = false;
    }
  }

  $: isInsufficientBalance = () =>
    hasInsufficientBalance(amount0, amount1, token0, token1);

  $: buttonText = userIsTyping
    ? "Entering Amounts..."
    : getButtonText(
        token0,
        token1,
        poolExists,
        isInsufficientBalance(),
        amount0,
        amount1,
        finalLoading,
        finalLoadingState,
      );

  $: isValid =
    token0 &&
    token1 &&
    parseFloat(amount0.replace(/[,_]/g, "") || "0") > 0 &&
    parseFloat(amount1.replace(/[,_]/g, "") || "0") > 0 &&
    !error &&
    !isInsufficientBalance() &&
    (!poolExists ? $addLiquidityStore.initialPrice && parseFloat($addLiquidityStore.initialPrice) > 0 : true);

  async function handleSubmit() {
    if (!isValid || loading) return;

    try {
      showConfirmation = true;
    } catch (err) {
      console.error("Error in handleSubmit:", err);
      error = err.message;
      toastStore.error(err.message);
    }
  }

  // Cleanup debounced function
  onDestroy(() => {
    debouncedHandleInput.cancel();
  });

  // Add this computed property to check if pool exists
  $: poolExists = pool !== null;

  // Change the initial display values to empty strings
  let displayValue0 = "";
  let displayValue1 = "";

  function handleFormattedInput(index: 0 | 1, event: Event) {
    const input = event.target as HTMLInputElement;
    const cursorPosition = input.selectionStart || 0;

    const result = handleFormattedNumberInput(
      input.value,
      cursorPosition,
      index === 0 ? displayValue0 : displayValue1,
    );

    if (index === 0) {
      amount0 = result.rawValue;
      displayValue0 = result.formattedValue;
    } else {
      amount1 = result.rawValue;
      displayValue1 = result.formattedValue;
    }

    input.value = result.formattedValue;

    // Create a new event with the raw value
    const newEvent = new Event("input", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(newEvent, "target", { value: input });

    // Handle the main input logic with raw value
    handleInput(index, newEvent);

    // Set new cursor position
    requestAnimationFrame(() => {
      input.setSelectionRange(
        result.newCursorPosition,
        result.newCursorPosition,
      );
    });

    // Mark user as typing and start/reset a brief timer
    userIsTyping = true;
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      userIsTyping = false;
    }, 300);

    lastChanged = index;
  }

  function handleInitialPriceInput(event: Event & { currentTarget: EventTarget & HTMLInputElement }) {
    const value = event.currentTarget.value;
    if (!value || isNaN(parseFloat(value))) return;
    addLiquidityStore.setInitialPrice(value);
  }

  function calculateInitialAmounts(amount0: string, initialPrice: string, token0: FE.Token, token1: FE.Token) {
    if (!amount0 || !initialPrice || !token0 || !token1) return null;
    
    const cleanAmount0 = amount0.replace(/[,_]/g, "");
    const price = parseFloat(initialPrice);
    
    if (isNaN(price) || price <= 0) return null;

    // Calculate amount1 based on initial price ratio
    const amount1 = new BigNumber(cleanAmount0)
      .times(new BigNumber(price))
      .toString();

    return {
      amount0: cleanAmount0,
      amount1
    };
  }
</script>

<Panel
  width="auto"
  className="liquidity-panel w-full max-w-[690px]"
>
  <div class="flex flex-col min-h-[165px] box-border relative rounded-lg">
    <header>
      <div class="flex items-center justify-between gap-4 min-h-[2.5rem] mb-5">
        <h2
          class="text-[clamp(1.5rem,4vw,2rem)] font-semibold text-white m-0 tracking-tight leading-none"
        >
          Add Liquidity
        </h2>
      </div>
    </header>

    <div class="relative">
      <div class="token-input-container">
        <div class="relative flex-grow mb-2">
          <div class="flex items-center gap-4">
            <div class="relative flex-1">
              <input
                bind:this={input0Element}
                type="text"
                inputmode="decimal"
                pattern="[0-9]*"
                placeholder="0"
                class="amount-input"
                value={displayValue0}
                on:input={(e) => handleFormattedInput(0, e)}
                on:focus={() => (input0Focused = true)}
                on:blur={() => handleBlur(0)}
              />
            </div>
            <div class="token-selector-wrapper">
              <button
                class="token-selector-button"
                on:click={() => openTokenSelector(0)}
              >
                {#if token0}
                  <div class="token-info">
                    <img
                      src={token0.logo_url}
                      alt={token0.symbol}
                      class="token-logo"
                    />
                    <span class="token-symbol">{token0.symbol}</span>
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
            </div>
          </div>
        </div>
        <div class="balance-info">
          <div class="flex items-center gap-2">
            <span class="text-white/50 font-normal tracking-wide">Value</span>
            <span class="pl-1 text-white/50 font-medium tracking-wide">
              ${formatToNonZeroDecimal(animatedUsdValue0.current)}
            </span>
          </div>
          <button class="available-balance" on:click={() => handleMaxClick(0)}>
            Available: {token0
              ? formatBalance(token0Balance, token0.decimals)
              : "0.00"}
            {token0?.symbol || ""}
          </button>
        </div>
      </div>

      <div class="token-input-container mt-12">
        <div class="relative flex-grow mb-2">
          <div class="flex items-center gap-4">
            <div class="relative flex-1">
              <input
                bind:this={input1Element}
                type="text"
                inputmode="decimal"
                pattern="[0-9]*"
                placeholder="0"
                class="amount-input"
                value={displayValue1}
                on:input={(e) => handleFormattedInput(1, e)}
                on:focus={() => (input1Focused = true)}
                on:blur={() => handleBlur(1)}
              />
            </div>
            <div class="token-selector-wrapper">
              <button
                class="token-selector-button"
                on:click={() => openTokenSelector(1)}
              >
                {#if token1}
                  <div class="token-info">
                    <img
                      src={token1.logo_url}
                      alt={token1.symbol}
                      class="token-logo"
                    />
                    <span class="token-symbol">{token1.symbol}</span>
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
            </div>
          </div>
        </div>
        <div class="balance-info">
          <div class="flex items-center gap-2">
            <span class="text-white/50 font-normal tracking-wide">Value</span>
            <span class="pl-1 text-white/50 font-medium tracking-wide">
              ${formatToNonZeroDecimal(animatedUsdValue1.current)}
            </span>
          </div>
          <button class="available-balance" on:click={() => handleMaxClick(1)}>
            Available: {token1
              ? formatBalance(token1Balance, token1.decimals)
              : "0.00"}
            {token1?.symbol || ""}
          </button>
        </div>
      </div>
    </div>

    {#if !poolExists}
      <div class="no-pool-section">
        <p class="text-white/70 mb-4">No liquidity pool exists for this token pair.</p>
        <button
          class="create-pool-button"
          on:click={() => goto("/pools/create")}
        >
          Create New Pool
        </button>
      </div>
    {/if}

    <div class="mt-4">
      <button
        class="submit-button"
        disabled={!isValid || loading}
        on:click={handleSubmit}
      >
        {#if loading}
          <div class="loading-state">
            <span class="loading-spinner"></span>
            <span>{loadingState}</span>
          </div>
        {:else}
          {buttonText}
        {/if}
      </button>
    </div>

    {#if token0 && token1}
      {#if pool}
        <div class="pool-info mt-4">
          <div class="pool-stats-grid">
            <div class="pool-stat">
              <span class="stat-value">${formatLargeNumber(pool.tvl)}</span>
              <span class="stat-label">TVL</span>
            </div>
            <div class="pool-stat">
              <span class="stat-value">${formatLargeNumber(pool.rolling_24h_volume)}</span>
              <span class="stat-label">24h Vol</span>
            </div>
            <div class="pool-stat">
              <span class="stat-value">{formatToNonZeroDecimal(pool.rolling_24h_apy)}%</span>
              <span class="stat-label">APY</span>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</Panel>

<!-- Token Selectors -->
{#if showToken0Selector}
  <Portal target="body">
    <TokenSelectorDropdown
      show={true}
      currentToken={token0}
      otherPanelToken={token1}
      onSelect={(token) => handleTokenSelect(0, token)}
      onClose={() => (showToken0Selector = false)}
    />
  </Portal>
{/if}

{#if showToken1Selector}
  <Portal target="body">
    <TokenSelectorDropdown
      show={true}
      currentToken={token1}
      otherPanelToken={token0}
      onSelect={(token) => handleTokenSelect(1, token)}
      onClose={() => (showToken1Selector = false)}
      allowedCanisterIds={SECONDARY_TOKEN_IDS}
    />
  </Portal>
{/if}

{#if showConfirmation}
  <Portal target="body">
    <AddLiquidityConfirmation
      {token0}
      {token1}
      {amount0}
      {amount1}
      {pool}
      isOpen={showConfirmation}
      onClose={() => {
        showConfirmation = false;
        // Reset form state on close
        amount0 = "0";
        amount1 = "0";
        if (input0Element) input0Element.value = "0";
        if (input1Element) input1Element.value = "0";
      }}
      onConfirm={async () => {
        showConfirmation = false;
        await onSubmit();
      }}
    />
  </Portal>
{/if}

<style lang="postcss">
  .token-selector-wrapper {
    @apply min-w-[180px];
  }

  .token-selector-button {
    @apply w-full flex items-center justify-between;
    @apply bg-white/5 hover:bg-white/10;
    @apply rounded-xl px-4 py-3;
    @apply border border-white/10;
    @apply transition-colors duration-150;
  }

  .token-info {
    @apply flex items-center gap-2 min-w-[140px];
  }

  .token-logo {
    @apply w-8 h-8 rounded-full bg-white/5 object-contain;
  }

  .token-symbol {
    @apply text-[15px] text-white font-medium min-w-[80px];
  }

  .select-token-text {
    @apply text-[15px] text-white/70 min-w-[120px] text-left;
  }

  .amount-input {
    @apply flex-1 min-w-0 bg-transparent border-none;
    @apply text-white text-[2.5rem] font-medium tracking-tight;
    @apply w-full relative z-10 p-0;
    @apply opacity-85 focus:outline-none focus:text-white;
    @apply disabled:text-white/65 placeholder:text-white/65;
  }

  .balance-info {
    @apply flex justify-between mt-2;
    @apply text-[clamp(0.8rem,2vw,0.875rem)] text-white/50;
  }

  .submit-button {
    @apply w-full px-6 py-3 rounded-xl;
    @apply bg-blue-600 text-white font-medium;
    @apply disabled:opacity-50 disabled:cursor-not-allowed;
    @apply hover:bg-blue-700 transition-colors duration-200;
    @apply mt-4;
  }

  .loading-state {
    @apply flex items-center justify-center gap-2;
  }

  .loading-spinner {
    @apply w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin;
  }

  .chevron {
    @apply w-5 h-5 text-white/50;
  }

  @media (max-width: 420px) {
    .amount-input {
      @apply text-2xl mt-[-0.15rem];
    }
  }

  .pool-info {
    @apply border-t border-white/10 pt-4;
  }

  .pool-stats-grid {
    @apply grid grid-cols-3 gap-2 bg-white/5 rounded-lg p-3;
  }

  .pool-stat {
    @apply flex flex-col items-center;
  }

  .stat-value {
    @apply text-base font-medium text-white;
  }

  .stat-label {
    @apply text-xs text-white/60;
  }

  @media (min-width: 640px) {
    .stat-value {
      @apply text-lg;
    }

    .stat-label {
      @apply text-sm;
    }
  }

  .no-pool-message {
    @apply flex items-center justify-center p-4 rounded-lg;
    @apply bg-white/5 border border-yellow-500/20;
  }

  .available-balance {
    @apply text-white/70 hover:text-yellow-500 transition-colors duration-150;
  }

  .amount-input:disabled {
    @apply opacity-50 cursor-not-allowed;
  }

  .pool-creation-form {
    @apply space-y-6;
  }

  .form-section {
    @apply bg-white/5 rounded-lg p-4;
  }

  .pool-creation-section {
    @apply mb-6 mt-6 p-4 rounded-lg;
    @apply bg-yellow-500/5 border border-yellow-500/20;
    @apply space-y-4;
  }

  .pool-creation-header {
    @apply flex items-center gap-2;
  }

  .pool-creation-header h3 {
    @apply text-yellow-500 font-medium text-lg;
  }

  .price-ratio-input {
    @apply space-y-2;
  }

  .price-ratio-input label {
    @apply block text-sm text-white/70;
  }

  .input-with-hint {
    @apply space-y-1;
  }

  .input-with-hint input {
    @apply w-full px-4 py-3 rounded-lg;
    @apply bg-black/20 border border-white/10;
    @apply text-white placeholder-white/40;
    @apply focus:outline-none focus:border-blue-500;
    @apply transition-colors duration-200;
  }

  .price-example {
    @apply text-xs text-white/50 pl-1;
  }

  .creation-warning {
    @apply text-sm text-white/70;
    @apply p-3 rounded;
    @apply bg-black/20 border border-yellow-500/20;
  }

  .no-pool-section {
    @apply mb-6 mt-6 p-4 rounded-lg;
    @apply bg-yellow-500/5 border border-yellow-500/20;
    @apply text-center;
  }

  .create-pool-button {
    @apply px-6 py-3 rounded-lg;
    @apply bg-yellow-500 text-black font-medium;
    @apply hover:bg-yellow-400 transition-colors duration-200;
  }
</style>
