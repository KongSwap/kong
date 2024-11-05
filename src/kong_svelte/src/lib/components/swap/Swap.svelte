<script lang="ts">
  import { fade } from "svelte/transition";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { onMount, onDestroy } from "svelte";
  import debounce from "lodash/debounce";
  import { SwapService } from "$lib/services/SwapService";
  import { walletStore } from "$lib/stores/walletStore";
  import { tokenStore } from "$lib/stores/tokenStore";
  import { toastStore } from "$lib/stores/toastStore";
  import { getKongBackendPrincipal } from "$lib/utils/canisterIds";
  import SwapPanel from "$lib/components/swap/swap_ui/SwapPanel.svelte";
  import Button from "$lib/components/common/Button.svelte";
  import TokenSelector from "$lib/components/swap/swap_ui/TokenSelectorModal.svelte";
  import SwapConfirmation from "$lib/components/swap/swap_ui/SwapConfirmation.svelte";
  import BigNumber from "bignumber.js";
  import { flip } from 'svelte/animate';
  import { quintOut } from 'svelte/easing';
  import SwapSettings from './swap_ui/SwapSettings.svelte';

  const KONG_BACKEND_PRINCIPAL = getKongBackendPrincipal();
  const swapService = SwapService.getInstance();

  export let slippage = 2;
  export let initialPool: string | null = null;

  // Core state
  let payToken = initialPool?.split("_")[0] || "ICP";
  let receiveToken = initialPool?.split("_")[1] || "ckBTC";
  let payAmount = "";
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
  let price = "0";
  let usdValue = "0";
  let swapSlippage = 0;
  let gasFee = "0";
  let lpFee = "0";
  let tokenFee: string | undefined;
  let gasFees: string[] = [];
  let lpFees: string[] = [];

  // Transaction state
  let requestId: bigint | null = null;
  let transactionStateObject: any = null;
  let intervalId: any = null;

  let tweenedReceiveAmount = tweened(0, {
    duration: 400,
    easing: cubicOut,
  });

  let isAnimating = false;
  let panels = [
    { id: 'pay', type: 'pay', title: 'You Pay' },
    { id: 'receive', type: 'receive', title: 'You Receive' }
  ];

  let routingPath: string[] = [];

  let showSettings = false;

  onMount(async () => {
    if ($walletStore.isConnected) {
      await tokenStore.loadTokens();
      await tokenStore.loadBalances();
    }
  });

  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });

  $: isValidInput = payAmount && Number(payAmount) > 0 && !isCalculating;
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
    },
    receive: {
      token: receiveToken,
      amount: $tweenedReceiveAmount.toFixed(getTokenDecimals(receiveToken)),
      balance: getTokenBalance(receiveToken),
      onTokenSelect: () => (showReceiveTokenSelector = true),
      onAmountChange: () => {},
      disabled: isProcessing,
      showPrice: true,
      usdValue,
      slippage: swapSlippage,
      maxSlippage: slippage,
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
    if (!isValidInput) return "Enter Amount";
    if (error) return error;
    return "Swap";
  }

  function getTokenBalance(symbol: string): string {
    const token = $tokenStore.tokens?.find((t) => t.symbol === symbol);
    if (!token?.canister_id) return "0";
    return $tokenStore.balances[token.canister_id]?.toString() || "0";
  }

  function getTokenDecimals(symbol: string): number {
    const token = $tokenStore.tokens?.find((t) => t.symbol === symbol);
    return token?.decimals || 8;
  }

  async function getSwapQuote(amount: string) {
    if (!amount || Number(amount) <= 0 || isNaN(Number(amount))) {
      setReceiveAmount("0");
      return;
    }

    isCalculating = true;
    error = null;

    try {
      const payDecimals = getTokenDecimals(payToken);
      const payAmountBigInt = swapService.toBigInt(amount, payDecimals);

      const quote = await swapService.swap_amounts(
        payToken,
        payAmountBigInt,
        receiveToken,
      );

      if ("Ok" in quote) {
        const receiveDecimals = getTokenDecimals(receiveToken);
        const receivedAmount = swapService.fromBigInt(
          quote.Ok.receive_amount,
          receiveDecimals,
        );

        setReceiveAmount(receivedAmount);
        setDisplayAmount(new BigNumber(receivedAmount).toFixed(receiveDecimals));

        price = quote.Ok.price.toString();
        swapSlippage = quote.Ok.slippage;
        usdValue = new BigNumber(receivedAmount)
          .times(quote.Ok.price)
          .toFormat(2);

        if (quote.Ok.txs.length > 0) {
          // Extract routing path from txs
          routingPath = [payToken, ...quote.Ok.txs.map(tx => tx.receive_symbol)];
          
          // Reset fee arrays
          gasFees = [];
          lpFees = [];
          
          // Collect fees for each hop
          quote.Ok.txs.forEach(tx => {
            const receiveDecimals = getTokenDecimals(tx.receive_symbol);
            gasFees.push(swapService.fromBigInt(tx.gas_fee, receiveDecimals));
            lpFees.push(swapService.fromBigInt(tx.lp_fee, receiveDecimals));
          });

          // Set the total fees for display
          if (gasFees.length > 0) {
            gasFee = gasFees[gasFees.length - 1];
            lpFee = lpFees[lpFees.length - 1];
            tokenFee = routingPath[routingPath.length - 1];
          }
        }
      } else {
        toastStore.error(quote.Err);
        setReceiveAmount("0");
      }
    } catch (err) {
      toastStore.error(
        err instanceof Error ? err.message : "An error occurred",
      );
      setReceiveAmount("0");
    } finally {
      isCalculating = false;
    } 
  }

  const debouncedGetQuote = debounce(getSwapQuote, 500);

  function setReceiveAmount(amount: string) {
    receiveAmount = amount;
    tweenedReceiveAmount.set(Number(amount));
  }

  function setDisplayAmount(amount: string) {
    displayReceiveAmount = amount;
    tweenedReceiveAmount.set(Number(amount));
  }

  async function handleTokenSwitch() {
    if (isAnimating) return;
    
    isAnimating = true;
    
    panels = panels.map((panel, i) => ({
        ...panel,
        direction: i === 0 ? 'topLeft' : 'bottomRight'
    })).reverse();
    
    [payToken, receiveToken] = [receiveToken, payToken];
    payAmount = "";
    setReceiveAmount("0");
    
    setTimeout(() => {
        isAnimating = false;
        panels = panels.reverse();
    }, 200);
  }

  function handleInputChange(event: Event | CustomEvent) {
    let input: string;

    if ("detail" in event && event.detail?.value) {
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

  function startPolling(reqId: bigint) {
    intervalId = setInterval(async () => {
      try {
        const status = await swapService.requests([reqId]);
        if (!status.Ok?.[0]) return;

        const requestReply = status.Ok[0].reply;
        transactionStateObject = status;

        if (requestReply?.Pending) {
          return;
        } else if (requestReply?.Swap) {
          if (requestReply.Swap.status === "Success") {
            clearInterval(intervalId);
            handleSwapSuccess(requestReply.Swap);
          } else if (requestReply.Swap.status === "Failed") {
            clearInterval(intervalId);
            handleSwapFailure(requestReply.Swap);
          }
        }
      } catch (error) {
        clearInterval(intervalId);
        console.error("Error polling transaction:", error);
        handleSwapFailure(null);
      }
    }, 500);
  }

  async function handleSwap() {
    if (!isValidInput || isProcessing) {
        console.log('Invalid input or already processing');
        return;
    }

    isProcessing = true;
    error = null;

    try {
        console.log('Starting swap execution');
        const requestId = await swapService.executeSwap({
            payToken,
            payAmount,
            receiveToken,
            receiveAmount,
            slippage,
            backendPrincipal: KONG_BACKEND_PRINCIPAL,
        });

        console.log('Swap execution result:', requestId);

        if (requestId) {
            console.log('Starting polling with requestId:', requestId);
            startPolling(requestId);
        } else {
            throw new Error("Failed to execute swap - no requestId returned");
        }
    } catch (err) {
        console.error('Swap execution error:', err);
        toastStore.error(err instanceof Error ? err.message : "Swap failed");
        isProcessing = false;
        isConfirmationOpen = false;
    }
  }

  function handleSwapSuccess(reply: any) {
    isProcessing = false;
    isConfirmationOpen = false;

    if (reply.receive_amount) {
      const receiveDecimals = getTokenDecimals(receiveToken);
      const formattedAmount = swapService.fromBigInt(
        reply.receive_amount,
        receiveDecimals,
      );
      setReceiveAmount(formattedAmount);
      setDisplayAmount(new BigNumber(formattedAmount).toFixed(receiveDecimals));
    }

    clearInputs();
    slippage = 2; // Reset slippage to default 2%
    toastStore.success("Swap successful");
    tokenStore.loadBalances(); // Refresh balances after successful swap
  }

  function handleSwapFailure(reply: any) {
    isProcessing = false;
    isConfirmationOpen = false;
    toastStore.error("Swap failed");
  }

  function clearInputs() {
    payAmount = "";
    setReceiveAmount("0");
    setDisplayAmount("0");
    price = "0";
    usdValue = "0";
    swapSlippage = 0;
    lpFee = "0";
    gasFee = "0";
    tokenFee = undefined;
    requestId = null;
    transactionStateObject = null;
  }
</script>

<div class="swap-wrapper">
  <div class="swap-container" in:fade={{ duration: 420 }}>
    <button 
      class="settings-button"
      on:click={() => {
        showSettings = true;
      }}
    >
      Settings
    </button>

    <div class="panels-container">
      {#each panels as panel (panel.id)}
        <div 
          animate:flip={{
            duration: 169,
            easing: quintOut
          }}
          class="panel-wrapper"
        >
          <div class="panel-content">
            <SwapPanel
              title={panel.title}
              {...panelData[panel.type]}
            />
          </div>
        </div>
      {/each}

      <button 
        class="switch-button {isAnimating ? 'rotating' : ''}"
        on:click={handleTokenSwitch}
        disabled={isProcessing || isAnimating} 
      >
        <img src="/pxcomponents/arrow.svg" alt="swap" class="swap-arrow" />
      </button>
    </div>

    <div class="swap-footer mt-3">
      <Button
        variant="yellow"
        disabled={!isValidInput || isProcessing || isAnimating || !$walletStore.isConnected}
        onClick={() => {
          console.log('Button clicked, current isConfirmationOpen:', isConfirmationOpen);
          isConfirmationOpen = true;
          console.log('Set isConfirmationOpen to:', isConfirmationOpen);
        }}
        width="100%"
      >
        {buttonText}
      </Button>
    </div>
  </div>
</div>

{#if showPayTokenSelector}
  <div
    class="modal-overlay"
    transition:fade={{ duration: 100 }}
    on:click|self={() => (showPayTokenSelector = false)}
  >
    <div class="modal-content token-selector">
      <TokenSelector
        show={true}
        onSelect={(token) => handleSelectToken("pay", token)}
        onClose={() => (showPayTokenSelector = false)}
        currentToken={receiveToken}
      />
    </div>
  </div>
{/if}

{#if showReceiveTokenSelector}
  <div
    class="modal-overlay"
    transition:fade={{ duration: 100 }}
    on:click|self={() => (showReceiveTokenSelector = false)}
  >
    <div class="modal-content token-selector">
      <TokenSelector
        show={true}
        onSelect={(token) => handleSelectToken("receive", token)}
        onClose={() => (showReceiveTokenSelector = false)}
        currentToken={payToken}
      />
    </div>
  </div>
{/if}

{#if isConfirmationOpen}
  <div
    class="modal-overlay"
    transition:fade={{ duration: 200 }}
    on:click|self={() => {
      console.log('Closing modal from overlay click');
      isConfirmationOpen = false;
    }}
  >
    <div class="modal-content confirmation">
      <SwapConfirmation
        {payToken}
        {payAmount}
        {receiveToken}
        receiveAmount={displayReceiveAmount}
        onConfirm={() => {
          console.log('Confirm clicked in SwapConfirmation');
          handleSwap();
        }}
        onClose={() => {
          console.log('Close clicked in SwapConfirmation');
          isConfirmationOpen = false;
        }}
        {price}
        {gasFee}
        {lpFee}
        {gasFees}
        {lpFees}
        slippage={swapSlippage}
        maxAllowedSlippage={slippage}
        {routingPath}
      />
    </div>
  </div>
{/if}

{#if showSettings}
  <div class="modal-overlay" transition:fade={{ duration: 200 }}>
    <SwapSettings
      show={showSettings}
      onClose={() => showSettings = false}
      slippage={slippage}
      onSlippageChange={(value) => {
        slippage = value;
        if (payAmount) debouncedGetQuote(payAmount);
      }}
    />
  </div>
{/if}

<style lang="postcss">
  .swap-wrapper {
    width: 100%;
    margin: 0 auto;
    padding: 1rem;
  }

  .swap-container {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .panels-container {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .panel-wrapper {
    position: relative;
    transition: all 0.15s ease;
    transform-style: preserve-3d;
  }

  .switch-button {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 50px;
    height: 50px;
    background: #ffcd1f;
    border: 2px solid #368d00;
    border-radius: 50%;
    cursor: pointer;
    z-index: 1;
    padding: 6px;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .switch-button:hover:not(:disabled) {
    background: #ffe077;
    transform: translate(-50%, -50%) scale(1.05);
  }

  .switch-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .swap-arrow {
    width: 100%;
    height: 100%;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 50;
    display: grid;
    place-items: center;
    overflow: hidden;
  }

  .modal-content {
    position: relative;
    margin: 1rem;
    border-radius: 1rem;
    overflow: hidden;
    z-index: 10000;
  }

  .modal-content.token-selector {
    max-height: 90vh;
  }

  .modal-content.confirmation {
    max-height: 90vh;
    margin: 1rem;
  }

  @media (max-width: 480px) {
    .swap-wrapper {
      padding: 0.5rem;
    }

    .modal-content {
      width: 100vw;
      height: 100vh;
      margin: 0;
      border-radius: 0;
    }

    .modal-content.token-selector,
    .modal-content.confirmation {
      width: 100vw;
      height: 100vh;
      margin: 0;
      border-radius: 0;
    }

    .modal-overlay {
      padding: 0;
    }

    .switch-button {
      width: 32px;
      height: 32px;
      padding: 6px;
    }

    .modal-content {
      margin: 0.5rem;
    }

    .modal-content.confirmation {
      max-width: calc(100% - 1rem);
      margin: 0.5rem;
      height: auto;
    }
  }

  :global(.token-modal) {
    max-height: 80vh;
    overflow-y: auto;
  }

  :global(.swap-footer) {
    margin-top: 1.5rem;
  }

  .panel-content {
    transform-origin: center center;
    backface-visibility: hidden;
  }

  .rotating {
    animation: rotate 0.2s ease-in-out;
  }

  @keyframes rotate {
    from {
      transform: translate(-50%, -50%) rotate(0deg);
    }
    to {
      transform: translate(-50%, -50%) rotate(180deg);
    }
  }

  .settings-button {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: #ffcd1f;
    border: 2px solid #368d00;
    border-radius: 8px;
    padding: 4px 12px;
    font-size: 14px;
    color: #000;
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 2;
    font-family: 'Press Start 2P', monospace;
  }

  .settings-button:hover {
    background: #ffe077;
    transform: scale(1.05);
  }
</style>
