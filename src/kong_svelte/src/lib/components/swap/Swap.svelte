<script lang="ts">
  import { fade } from "svelte/transition";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { onDestroy, onMount } from "svelte";
  import debounce from "lodash/debounce";
  import { SwapService } from "$lib/services/swap/SwapService";
  import { walletStore, isConnected } from "$lib/services/wallet/walletStore";
  import { getTokenDecimals } from "$lib/services/tokens/tokenStore";
  import { toastStore } from "$lib/stores/toastStore";
  import { getKongBackendPrincipal } from "$lib/utils/canisterIds";
  import SwapPanel from "$lib/components/swap/swap_ui/SwapPanel.svelte";
  import Button from "$lib/components/common/Button.svelte";
  import TokenSelector from "$lib/components/swap/swap_ui/TokenSelectorModal.svelte";
  import SwapConfirmation from "$lib/components/swap/swap_ui/SwapConfirmation.svelte";
  import { swapStatusStore } from "$lib/services/swap/swapStore";
  import { parseTokenAmount } from "$lib/utils/numberFormatUtils";
  import BananaRain from "$lib/components/common/BananaRain.svelte";
  import SwapSuccessModal from "./swap_ui/SwapSuccessModal.svelte";
  import { tokenStore } from "$lib/services/tokens/tokenStore";
  import { settingsStore } from "$lib/services/settings/settingsStore";
  import { themeStore } from '$lib/stores/themeStore';

  const KONG_BACKEND_PRINCIPAL = getKongBackendPrincipal();

  export let initialFromToken: FE.Token | null = null;
  export let initialToToken: FE.Token | null = null;

  let payToken: FE.Token;
  let receiveToken: FE.Token;
  let payAmount;
  let receiveAmount = "0";

  // UI state
  let isCalculating = false;
  let error: string | null = null;
  let showPayTokenSelector = false;
  let showReceiveTokenSelector = false;
  let isProcessing = false;
  let isConfirmationOpen = false;

  // Swap details
  let usdValue = "0";
  let payUsdValue = "0";
  let swapSlippage = 0;
  let gasFees: string[] = [];
  let lpFees: string[] = [];
  let intervalId: any = null;
  let tweenedReceiveAmount = tweened(0, {
    duration: 120,
    easing: cubicOut,
  });

  let panels = [
    { id: "pay", type: "pay", title: "You Pay" },
    { id: "receive", type: "receive", title: "You Receive" },
  ];

  let routingPath: string[] = [];
  let isSwitching = false;
  let showConfirmation = false;
  $: userMaxSlippage = $settingsStore.max_slippage;
  let isSlippageExceeded = false;
  let swapMode = "normal";
  let currentSwapId: string | null = null;
  let showBananaRain = false;
  let showSuccessModal = false;
  let successDetails = {
    payAmount: "",
    payToken: {} as FE.Token,
    receiveAmount: "",
    receiveToken: {} as FE.Token,
  };

  // Add a flag to track if tokens were manually selected
  let manuallySelectedTokens = {
    pay: false,
    receive: false,
  };

  $: {
    if (!isSwitching) {
      payToken =
        initialFromToken || $tokenStore.tokens.find((t) => t.symbol === "ICP");
      receiveToken =
        initialToToken ||
        $tokenStore.tokens.find(
          (t) => t.canister_id === initialToToken?.canister_id,
        ) ||
        $tokenStore.tokens.find((t) => t.symbol === "ckBTC");
    }
  }

  // 1. Memoize expensive computations
  const getButtonText = (params: {
    isCalculating: boolean;
    isValidInput: boolean;
    isProcessing: boolean;
    error: string | null;
    swapSlippage: number;
    userMaxSlippage: number;
  }): string => {
    const {
      isCalculating,
      isProcessing,
      isValidInput,
      error,
      swapSlippage,
      userMaxSlippage,
    } = params;
    if (!isConnected) return "Connect Wallet";
    if (isCalculating) return "Calculating...";
    if (isProcessing) return "Processing...";
    if (swapSlippage > userMaxSlippage)
      return `High Slippage: ${swapSlippage.toFixed(2)}%`;
    if (!isValidInput) return "Enter Amount";
    if (error) return error;
    return `Swap ${payToken.symbol} to ${receiveToken.symbol}`;
  };

  // 2. Optimize reactive statements
  $: buttonText = getButtonText({
    isCalculating,
    isValidInput,
    isProcessing,
    error,
    swapSlippage,
    userMaxSlippage,
  });

  // 4. Optimize quote fetching with AbortController
  let currentQuoteController: AbortController | null = null;

  async function getSwapQuote(amount: string) {
    if (!amount || Number(amount) <= 0 || isNaN(Number(amount))) {
      resetSwapValues();
      return;
    }

    isCalculating = true;
    error = null;

    try {
      const formattedPayAmount = parseTokenAmount(
        amount,
        getTokenDecimals(payToken.canister_id),
      );
      const quote = await SwapService.getQuoteDetails({
        payToken,
        payAmount: formattedPayAmount,
        receiveToken,
      });

      updateSwapValues(quote);
      return quote;
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("Error fetching swap quote:", err);
      error = err instanceof Error ? err.message : "Failed to get quote";
      resetSwapValues();
    } finally {
      isCalculating = false;
    }
  }

  // 5. Helper functions to reduce code duplication
  function resetSwapValues() {
    setReceiveAmount("0");
    isSlippageExceeded = false;
    payUsdValue = "0";
    usdValue = "0";
  }

  function updateSwapValues(quote) {
    setReceiveAmount(quote.receiveAmount.toString());
    swapSlippage = quote.slippage;
    usdValue = quote.usdValue;
  }

  // 6. Optimize URL updates
  const updateURL = (params: { from?: string; to?: string }) => {
    const url = new URL(window.location.href);
    if (params.from) url.searchParams.set("from", params.from);
    if (params.to) url.searchParams.set("to", params.to);
    history.replaceState({}, "", url.toString());
  };

  // 7. Cleanup function
  onDestroy(() => {
    if (currentQuoteController) {
      currentQuoteController.abort();
    }
    if (intervalId) {
      clearInterval(intervalId);
    }
    if (currentSwapId) {
      swapStatusStore.removeSwap(currentSwapId);
    }
    debouncedGetQuote.cancel();
  });

  $: isValidInput =
    payAmount &&
    Number(payAmount) > 0 &&
    !isCalculating &&
    swapSlippage <= userMaxSlippage;
  $: panelData = {
    pay: {
      token: payToken,
      amount: payAmount,
      balance:
        $tokenStore.balances[payToken?.canister_id]?.in_tokens || BigInt(0),
      onTokenSelect: () => (showPayTokenSelector = true),
      onAmountChange: handleInputChange,
      disabled: isProcessing,
      showPrice: false,
      usdValue: payUsdValue,
      estimatedGasFee: "",
    },
    receive: {
      token: receiveToken,
      amount: $tweenedReceiveAmount.toFixed(
        getTokenDecimals(receiveToken?.canister_id),
      ),
      balance:
        $tokenStore.balances[receiveToken?.canister_id]?.in_tokens || BigInt(0),
      onTokenSelect: () => (showReceiveTokenSelector = true),
      onAmountChange: () => {},
      disabled: isProcessing,
      showPrice: true,
      usdValue: usdValue,
      slippage: swapSlippage,
    },
  };

  function setReceiveAmount(amount: string) {
    receiveAmount = amount;
    tweenedReceiveAmount.set(Number(amount));
  }

  async function handleTokenSwitch() {
    if (isProcessing) return;

    isSwitching = true;

    // Store the tokens before switching
    const newPayToken = receiveToken;
    const newReceiveToken = payToken;

    // Swap the manual selection flags too
    const tempPaySelected = manuallySelectedTokens.pay;
    manuallySelectedTokens.pay = manuallySelectedTokens.receive;
    manuallySelectedTokens.receive = tempPaySelected;

    // Update initial tokens
    initialFromToken = newPayToken;
    initialToToken = newReceiveToken;

    // Perform the switch
    payToken = newPayToken;
    receiveToken = newReceiveToken;
    payAmount = receiveAmount;

    // Update URL
    updateURL({ from: receiveToken.canister_id, to: payToken.canister_id });

    if (receiveAmount !== "0") {
      debouncedGetQuote(receiveAmount);
    }

    setTimeout(() => {
      isSwitching = false;
    }, 100);
  }

  function handleInputChange(event: Event | CustomEvent) {
    let input: string;

    if (event instanceof CustomEvent && event.detail?.value) {
      input = event.detail.value;
    } else {
      input = (event.target as HTMLInputElement).value;
    }

    const cleanedInput = input.replace(/[^0-9.]/g, "");
    if (/^\d*\.?\d*$/.test(cleanedInput) || cleanedInput === "") {
      payAmount = cleanedInput;
      debouncedGetQuote(cleanedInput);
    }
  }

  function handleSelectToken(type: "pay" | "receive", token: FE.Token) {
    if (
      (type === "pay" && token?.canister_id === receiveToken?.canister_id) ||
      (type === "receive" && token?.canister_id === payToken?.canister_id)
    ) {
      toastStore.error("Cannot select the same token for both sides");
      return;
    }

    // Update token and URL
    if (type === "pay") {
      payToken = token;
      initialFromToken = token;
      manuallySelectedTokens.pay = true;
      showPayTokenSelector = false;
      updateURL({ from: token.canister_id });
    } else {
      receiveToken = token;
      initialToToken = token;
      manuallySelectedTokens.receive = true;
      showReceiveTokenSelector = false;
      updateURL({ to: token.canister_id });
    }

    if (payAmount) debouncedGetQuote(payAmount);
  }

  onMount(() => {
    const handleSwapSuccess = (event: CustomEvent) => {
      // Update success details with the actual swap values
      successDetails = {
        payAmount: event.detail.payAmount,
        payToken: $tokenStore.tokens.find((t) => t.symbol === event.detail.payToken),
        receiveAmount: event.detail.receiveAmount,
        receiveToken: $tokenStore.tokens.find((t) => t.symbol === event.detail.receiveToken),
      };
      tokenStore.loadPrices();
      payAmount = null;
      showSuccessModal = true;
    };

    window.addEventListener("swapSuccess", handleSwapSuccess);

    return () => {
      window.removeEventListener("swapSuccess", handleSwapSuccess);
    };
  });

  async function handleSwap(): Promise<boolean> {
    if (!isValidInput || isProcessing) {
      return false;
    }
    isProcessing = true;
    error = null;
    try {
      // Create new swap entry and store its ID
      let swapId = swapStatusStore.addSwap({
        expectedReceiveAmount: receiveAmount,
        lastPayAmount: payAmount,
        payToken: payToken,
        receiveToken: receiveToken,
        payDecimals: Number(getTokenDecimals(payToken.canister_id).toString()),
      });

      await SwapService.executeSwap({
        swapId,
        payToken,
        payAmount,
        receiveToken,
        receiveAmount,
        userMaxSlippage,
        backendPrincipal: KONG_BACKEND_PRINCIPAL,
        lpFees,
      });
      return true;
    } catch (err) {
      console.error("Swap execution error:", err);
      toastStore.error(err instanceof Error ? err.message : "Swap failed");
      return false;
    } finally {
      payAmount = null;
      receiveAmount = null;
      isProcessing = false;
      isConfirmationOpen = false;
    }
  }

  // Subscribe to quote updates for this specific swap
  $: {
    async function refreshQuote() {
      const quote = await getSwapQuote(payAmount);
      console.log("Refreshing quote display:", quote);
      // Update only this specific swap's quote
      if (currentSwapId) {
        swapStatusStore.updateSwap(currentSwapId, {
          shouldRefreshQuote: false,
          lastQuote: quote,
        });
      }
    }

    // Check if current swap needs a quote refresh
    if (currentSwapId && $swapStatusStore[currentSwapId]?.shouldRefreshQuote) {
      refreshQuote();
    }
  }

  async function handleSwapClick() {
    if (!isValidInput || isProcessing) return;

    // Refresh quote before showing confirmation
    isProcessing = true;
    const quote = await getSwapQuote(payAmount);
    swapStatusStore.updateSwap(currentSwapId, {
      lastQuote: quote,
      shouldRefreshQuote: true,
    });
    isProcessing = false;
    showConfirmation = true;
  }

  // Add this effect to handle URL updates
  $: {
    if (!isSwitching) {
      if (initialFromToken && !manuallySelectedTokens.pay) {
        payToken =
          $tokenStore.tokens.find(
            (t) => t.canister_id === initialFromToken.canister_id,
          ) || $tokenStore.tokens.find((t) => t.symbol === "ICP");
      }
      if (initialToToken && !manuallySelectedTokens.receive) {
        receiveToken =
          $tokenStore.tokens.find(
            (t) => t.canister_id === initialToToken.canister_id,
          ) || $tokenStore.tokens.find((t) => t.symbol === "ckBTC");
      }
    }
  }

  // Add this near the top of your script, with other declarations
  const debouncedGetQuote = debounce(
    async (amount: string) => {
      await getSwapQuote(amount);
    },
    500,
    {
      leading: false,
      trailing: true,
      maxWait: 1000,
    },
  );

  // Update arrow configurations
  const PixelArrow = {
    viewBox: "0 0 35 42",
    path: "M0.5 26.8824V27.3824H1H2.85294V29.2353V29.7353H3.35294H5.20588V31.5882V32.0882H5.70588H7.55882V33.9412V34.4412H8.05882H9.91177V36.2941V36.7941H10.4118H12.2647V38.6471V39.1471H12.7647H14.6176V41V41.5H15.1176H19.8235H20.3235V41V39.1471H22.1765H22.6765V38.6471V36.7941H24.5294H25.0294V36.2941V34.4412H26.8824H27.3824V33.9412V32.0882H29.2353H29.7353V31.5882V29.7353H31.5882H32.0882V29.2353V27.3824H33.9412H34.4412V26.8824V24.5294V24.0294H33.9412H25.0294V3.35294V2.85294H24.5294H22.6765V1V0.5H22.1765H12.7647H12.2647V1V2.85294H10.4118H9.91177V3.35294V24.0294H1H0.5V24.5294V26.8824Z"
  };

  const ModernArrow = {
    viewBox: "0 0 48 48",
    paths: [
      // Main circle
      "M24 44c11.046 0 20-8.954 20-20S35.046 4 24 4 4 12.954 4 24s8.954 20 20 20z",
      // Top arrow
      "M24 15l7 7H17l7-7z",
      // Bottom arrow
      "M24 33l-7-7h14l-7 7z"
    ]
  };
</script>

<div class="swap-wrapper">
  <div class="swap-container" in:fade={{ duration: 420 }}>
    <div class="mode-selector">
      <Button
        variant="yellow"
        size="medium"
        state={swapMode === "normal" ? "selected" : "default"}
        onClick={() => (swapMode = "normal")}
        width="50%"
      >
        Normal
      </Button>
      <Button
        variant="yellow"
        size="medium"
        state="disabled"
        onClick={() => {}}
        width="50%"
      >
        Pro (Soon)
      </Button>
    </div>

    <div class="panels-container">
      {#each panels as panel (panel.id)}
        <div class="panel-wrapper w-full">
          <div class="panel-content w-full">
            <SwapPanel title={panel.title} {...panelData[panel.type]} />
          </div>
        </div>
      {/each}

      <button
        class="switch-button"
        class:modern={$themeStore !== 'pixel'}
        on:click={handleTokenSwitch}
        disabled={isProcessing}
        aria-label="Switch tokens"
      >
        {#if $themeStore === 'pixel'}
          <svg
            width="56"
            height="64"
            viewBox={PixelArrow.viewBox}
            xmlns="http://www.w3.org/2000/svg"
            class="swap-arrow"
          >
            <path
              d={PixelArrow.path}
              stroke="#000000"
              stroke-width="1"
              fill="#ffcd1f"
              class="arrow-path"
            />
          </svg>
        {:else}
          <svg
            width="48"
            height="48"
            viewBox={ModernArrow.viewBox}
            xmlns="http://www.w3.org/2000/svg"
            class="swap-arrow modern"
          >
            <!-- Background circle -->
            <path
              d={ModernArrow.paths[0]}
              class="arrow-background"
            />
            <!-- Arrows -->
            <path
              d={ModernArrow.paths[1]}
              class="arrow-symbol"
            />
            <path
              d={ModernArrow.paths[2]}
              class="arrow-symbol"
            />
          </svg>
        {/if}
      </button>
    </div>

    <div class="swap-footer">
      <Button
        variant={swapSlippage > userMaxSlippage ? "blue" : "yellow"}
        disabled={!isValidInput || isProcessing || !$walletStore.isConnected}
        onClick={handleSwapClick}
        width="100%"
      >
        {buttonText}
      </Button>
    </div>
  </div>
</div>

{#if showPayTokenSelector}
  <TokenSelector
    show={true}
    onSelect={(token) => handleSelectToken("pay", token)}
    onClose={() => (showPayTokenSelector = false)}
    currentToken={receiveToken}
  />
{/if}

{#if showReceiveTokenSelector}
  <TokenSelector
    show={true}
    onSelect={(token) => handleSelectToken("receive", token)}
    onClose={() => (showReceiveTokenSelector = false)}
    currentToken={payToken}
  />
{/if}

{#if showConfirmation}
  <SwapConfirmation
    {payToken}
    {payAmount}
    {receiveToken}
    {receiveAmount}
    {gasFees}
    {lpFees}
    {userMaxSlippage}
    {routingPath}
    onConfirm={handleSwap}
    onClose={() => {
      showConfirmation = false;
      isProcessing = false;
    }}
  />
{/if}

{#if showBananaRain}
  <BananaRain />
{/if}

<SwapSuccessModal
  show={showSuccessModal}
  {...successDetails}
  onClose={() => {
    showSuccessModal = false;
  }}
/>

<style lang="postcss">
  .swap-wrapper {
    width: 100%;
    margin: 0 auto;
  }

  .swap-container {
    position: relative;
    display: flex;
    flex-direction: column;
    margin: 0 auto;
  }

  .panels-container {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 0;
    margin-bottom: 16px;
  }

  .panel-wrapper {
    position: relative;
    z-index: 0;
  }

  .switch-button {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    cursor: pointer;
    z-index: 2;
    background: transparent;
    border: none;
    padding: 1.5rem;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 64px;
    min-height: 64px;
  }

  .switch-button.modern {
    background: transparent;
    border-radius: 50%;
    padding: 0.75rem;
  }

  .switch-button.modern:hover:not(:disabled) {
    transform: translate(-50%, -50%) scale(1.1);
  }

  .switch-button.modern:active:not(:disabled) {
    transform: translate(-50%, -50%) scale(0.95);
  }

  .switch-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Modern theme specific styles */
  .swap-arrow.modern {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
  }

  .arrow-background {
    fill: #ffcd1f;
    transition: all 0.3s ease;
  }

  .arrow-symbol {
    fill: #000000;
    transition: all 0.3s ease;
  }

  /* Hover effects for modern theme */
  .switch-button.modern:hover:not(:disabled) .arrow-background {
    fill: #ffe380;
  }

  .switch-button.modern:active:not(:disabled) .arrow-background {
    fill: #ffc107;
  }

  /* Disabled state for modern theme */
  .switch-button.modern:disabled .arrow-background {
    fill: #e0e0e0;
  }

  .switch-button.modern:disabled .arrow-symbol {
    fill: #999999;
  }

  /* Animation for modern theme */
  @keyframes rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(180deg);
    }
  }

  .switch-button.modern:hover:not(:disabled) .swap-arrow.modern {
    animation: rotate 0.3s ease-in-out;
  }

  @media (max-width: 480px) {
    .switch-button.modern {
      padding: 0.5rem;
    }

    .swap-arrow.modern {
      width: 40px;
      height: 40px;
    }
  }

  .swap-arrow {
    width: 56px;
    height: 64px;
    pointer-events: none;
  }

  @media (max-width: 480px) {
    .swap-wrapper {
      padding: 0 0.5rem;
    }

    .switch-button {
      width: 64px;
      height: 64px;
      padding: 14px;
    }

    .swap-arrow {
      width: 48px;
      height: 56px;
    }

    .swap-footer {
      margin-top: 1.5rem;
    }

    .panels-container {
      gap: 6px;
      margin-bottom: 12px;
    }
  }

  :global(.swap-footer) {
    margin-top: 0;
  }

  .panel-content {
    transform-origin: center center;
    backface-visibility: hidden;
  }

  .mode-selector {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .arrow-path {
    transition: fill 0.2s ease;
  }

  :global([data-theme="minimal"]) .arrow-path {
    stroke-width: 2;
    /* You can customize these styles for minimal theme */
  }

  :global([data-theme="pixel"]) .arrow-path {
    stroke-width: 1;
    /* You can customize these styles for pixel theme */
  }
</style>
