<script lang="ts">
  import { fade } from "svelte/transition";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { onDestroy } from "svelte";
  import debounce from "lodash/debounce";
  import { SwapService } from "$lib/services/swap/SwapService";
  import { walletStore } from "$lib/services/wallet/walletStore";
  import {
    getTokenBalance,
    getTokenDecimals,
  } from "$lib/services/tokens/tokenStore";
  import { toastStore } from "$lib/stores/toastStore";
  import { getKongBackendPrincipal } from "$lib/utils/canisterIds";
  import SwapPanel from "$lib/components/swap/swap_ui/SwapPanel.svelte";
  import Button from "$lib/components/common/Button.svelte";
  import TokenSelector from "$lib/components/swap/swap_ui/TokenSelectorModal.svelte";
  import SwapConfirmation from "$lib/components/swap/swap_ui/SwapConfirmation.svelte";
  import SwapSettings from "./swap_ui/SwapSettings.svelte";
  import { swapStatusStore } from "$lib/services/swap/swapStore";
  import { parseTokenAmount } from "$lib/utils/numberFormatUtils";

  const KONG_BACKEND_PRINCIPAL = getKongBackendPrincipal();

  export let initialPool: string | null = null;
  export let initialFromToken: string | null = null;
  export let initialToToken: string | null = null;

  // Core state
  let payToken = initialFromToken || "ICP";
  let receiveToken = initialToToken || "ckBTC";
  let payAmount;
  let receiveAmount = "0";
  let displayReceiveAmount = "0";

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
  let showSettings = false;
  let showConfirmation = false;
  let userMaxSlippage = 2;
  let isSlippageExceeded = false;
  let swapMode = "normal";
  let currentSwapId: string | null = null;

  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
    if (currentSwapId) {
      swapStatusStore.removeSwap(currentSwapId);
    }
  });

  $: isValidInput =
    payAmount &&
    Number(payAmount) > 0 &&
    !isCalculating &&
    swapSlippage <= userMaxSlippage;
  $: buttonText = getButtonText(
    isCalculating,
    isValidInput,
    isProcessing,
    error,
  );

  $: panelData = {
    pay: {
      token: payToken,
      amount: payAmount,
      balance: getTokenBalance(payToken),
      onTokenSelect: () => (showPayTokenSelector = true),
      onAmountChange: handleInputChange,
      disabled: isProcessing,
      showPrice: false,
      usdValue: payUsdValue,
      estimatedGasFee: "",
    },
    receive: {
      token: receiveToken,
      amount: $tweenedReceiveAmount.toFixed(getTokenDecimals(receiveToken)),
      balance: getTokenBalance(receiveToken),
      onTokenSelect: () => (showReceiveTokenSelector = true),
      onAmountChange: () => {},
      disabled: isProcessing,
      showPrice: true,
      usdValue: usdValue,
      slippage: swapSlippage,
    },
  };

  function getButtonText(
    isCalculating: boolean,
    isValidInput: boolean,
    isProcessing: boolean,
    error: string | null,
  ): string {
    if (!$walletStore.isConnected) return "Connect Wallet";
    if (isCalculating) return "Calculating...";
    if (isProcessing) return "Processing...";
    if (swapSlippage > userMaxSlippage)
      return `High Slippage: ${swapSlippage.toFixed(2)}%`;
    if (!isValidInput) return "Enter Amount";
    if (error) return error;
    return "Swap";
  }

  async function getSwapQuote(amount: string) {
    if (!amount || Number(amount) <= 0 || isNaN(Number(amount))) {
      setReceiveAmount("0");
      isSlippageExceeded = false;
      payUsdValue = "0";
      usdValue = "0";
      return;
    }

    isCalculating = true;
    error = null;

    try {
      console.log("Getting quote for", payAmount, payToken, receiveToken);
      const formattedPayAmount = parseTokenAmount(
        payAmount,
        getTokenDecimals(payToken),
      );
      console.log("Formatted pay amount:", formattedPayAmount);
      const quote = await SwapService.getQuoteDetails({
        payToken,
        payAmount: formattedPayAmount,
        receiveToken,
      });
      console.log("Quote:", quote);

      // Update the receive amount and other values
      setReceiveAmount(quote.receiveAmount);
      swapSlippage = quote.slippage;
      usdValue = quote.usdValue;
    } catch (err) {
      console.error("Error fetching swap quote:", err);
      error = err instanceof Error ? err.message : "Failed to get quote";
      setReceiveAmount("0");
      payUsdValue = "0";
      usdValue = "0";
    } finally {
      isCalculating = false;
    }
  }

  const debouncedGetQuote = debounce(getSwapQuote, 500);

  function setReceiveAmount(amount: string) {
    receiveAmount = amount;
    tweenedReceiveAmount.set(Number(amount));
  }

  async function handleTokenSwitch() {
    if (isProcessing) return;
    [payToken, receiveToken] = [receiveToken, payToken];
    const oldPayAmount = payAmount;
    payAmount = receiveAmount;

    if (receiveAmount !== "0") {
      await debouncedGetQuote(receiveAmount);
    }
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

  function handleSelectToken(type: "pay" | "receive", token: string) {
    if (
      (type === "pay" && token === receiveToken) ||
      (type === "receive" && token === payToken)
    ) {
      toastStore.error("Cannot select the same token for both sides");
      return;
    }

    if (type === "pay") {
      payToken = token;
      showPayTokenSelector = false;
    } else {
      receiveToken = token;
      showReceiveTokenSelector = false;
    }

    if (payAmount) debouncedGetQuote(payAmount);
  }

  async function handleSwap(): Promise<boolean> {
    if (!isValidInput || isProcessing) {
      return false;
    }
    isProcessing = true;
    error = null;
    try {
      await SwapService.executeSwap({
        payToken,
        payAmount,
        receiveToken,
        receiveAmount,
        userMaxSlippage,
        backendPrincipal: KONG_BACKEND_PRINCIPAL,
        lpFees,
      });
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
      console.log("Refreshing quote display");
      const quote = await getSwapQuote(payAmount);
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
    console.log("Quote:", quote);
    swapStatusStore.updateSwap(currentSwapId, {
      lastQuote: quote,
      shouldRefreshQuote: true,
    });
    isProcessing = false;
    showConfirmation = true;
  }

  // Add this effect to handle URL updates
  $: {
    if (initialFromToken && initialFromToken !== payToken) {
      payToken = initialFromToken;
      if (payAmount) debouncedGetQuote(payAmount);
    }
    if (initialToToken && initialToToken !== receiveToken) {
      receiveToken = initialToToken;
      if (payAmount) debouncedGetQuote(payAmount);
    }
  }
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
            <SwapPanel
              title={panel.title}
              {...panelData[panel.type]}
              onSettingsClick={() => (showSettings = true)}
            />
          </div>
        </div>
      {/each}

      <button
        class="switch-button"
        on:click={handleTokenSwitch}
        disabled={isProcessing}
        aria-label="Switch tokens"
      >
        <svg
          width="56"
          height="64"
          viewBox="0 0 35 42"
          xmlns="http://www.w3.org/2000/svg"
          class="swap-arrow"
        >
          <path
            d="M0.5 26.8824V27.3824H1H2.85294V29.2353V29.7353H3.35294H5.20588V31.5882V32.0882H5.70588H7.55882V33.9412V34.4412H8.05882H9.91177V36.2941V36.7941H10.4118H12.2647V38.6471V39.1471H12.7647H14.6176V41V41.5H15.1176H19.8235H20.3235V41V39.1471H22.1765H22.6765V38.6471V36.7941H24.5294H25.0294V36.2941V34.4412H26.8824H27.3824V33.9412V32.0882H29.2353H29.7353V31.5882V29.7353H31.5882H32.0882V29.2353V27.3824H33.9412H34.4412V26.8824V24.5294V24.0294H33.9412H25.0294V3.35294V2.85294H24.5294H22.6765V1V0.5H22.1765H12.7647H12.2647V1V2.85294H10.4118H9.91177V3.35294V24.0294H1H0.5V24.5294V26.8824Z"
            stroke="#000000"
            stroke-width="1"
            fill="#ffcd1f"
          />
        </svg>
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

{#if showSettings}
  <SwapSettings
    show={showSettings}
    onClose={() => (showSettings = false)}
    {userMaxSlippage}
    onSlippageChange={(value) => {
      userMaxSlippage = value;
      if (payAmount) debouncedGetQuote(payAmount);
    }}
    onApproveToken={async () => {}}
    onRevokeToken={async () => {}}
  />
{/if}

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

  .switch-button:hover:not(:disabled) {
    transform: translate(-50%, -50%) scale(1.1);
  }

  .switch-button:active:not(:disabled) {
    transform: translate(-50%, -50%) scale(0.95);
  }

  .switch-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .switch-button:disabled .swap-arrow path {
    fill: #666;
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
</style>
