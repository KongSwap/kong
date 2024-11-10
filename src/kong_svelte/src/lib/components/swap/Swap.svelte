<script lang="ts">
  import { fade } from "svelte/transition";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { onDestroy } from "svelte";
  import debounce from "lodash/debounce";
  import { SwapService } from "$lib/services/swap/SwapService";
  import { walletStore } from "$lib/services/wallet/walletStore";
  import { tokenStore } from "$lib/services/tokens/tokenStore";
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
  import { IcrcService } from "$lib/services/icrc/IcrcService";

  const KONG_BACKEND_PRINCIPAL = getKongBackendPrincipal();

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
  let payUsdValue = "0";
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
    duration: 420,
    easing: cubicOut,
  });

  let isAnimating = false;
  let panels = [
    { id: 'pay', type: 'pay', title: 'You Pay' },
    { id: 'receive', type: 'receive', title: 'You Receive' }
  ];

  let routingPath: string[] = [];

  let showSettings = false;

  let showConfirmation = false;

  let currentStep = '';
  let currentRouteIndex = 0;

  let maxAllowedSlippage = slippage;
  let isSlippageExceeded = false;

  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });

  $: isValidInput = payAmount && 
                    Number(payAmount) > 0 && 
                    !isCalculating && 
                    swapSlippage <= maxAllowedSlippage;
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
    if (swapSlippage > maxAllowedSlippage) return `High Slippage: ${swapSlippage.toFixed(2)}%`;
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
      isSlippageExceeded = false;
      payUsdValue = "0";
      usdValue = "0";
      return;
    }

    isCalculating = true;
    error = null;

    try {
      const payDecimals = getTokenDecimals(payToken);
      const payAmountBigInt = SwapService.toBigInt(amount, payDecimals);

      const quote = await SwapService.swap_amounts(
        payToken,
        payAmountBigInt,
        receiveToken,
      );

      if ("Ok" in quote) {
        const receiveDecimals = getTokenDecimals(receiveToken);
        const receivedAmount = SwapService.fromBigInt(
          quote.Ok.receive_amount,
          receiveDecimals,
        );

        setReceiveAmount(receivedAmount);
        setDisplayAmount(new BigNumber(receivedAmount).toFixed(receiveDecimals));

        const quotePrice = new BigNumber(quote.Ok.price || 0);
        price = quotePrice.toString();
        
        payUsdValue = new BigNumber(amount)
          .times(quotePrice)
          .toFixed(2);
        
        usdValue = new BigNumber(receivedAmount)
          .times(quotePrice)
          .toFixed(2);

        swapSlippage = quote.Ok.slippage;
        
        isSlippageExceeded = swapSlippage > maxAllowedSlippage;
        
        if (quote.Ok.txs.length > 0) {
          routingPath = [payToken, ...quote.Ok.txs.map(tx => tx.receive_symbol)];
          
          gasFees = [];
          lpFees = [];
          
          quote.Ok.txs.forEach(tx => {
            const receiveDecimals = getTokenDecimals(tx.receive_symbol);
            gasFees.push(SwapService.fromBigInt(tx.gas_fee, receiveDecimals));
            lpFees.push(SwapService.fromBigInt(tx.lp_fee, receiveDecimals));
          });

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
    
    const oldPayAmount = payAmount;
    const oldReceiveAmount = receiveAmount;
    
    [payToken, receiveToken] = [receiveToken, payToken];
    
    payAmount = oldReceiveAmount;
    
    if (oldReceiveAmount !== "0") {
        await debouncedGetQuote(oldReceiveAmount);
    }
    
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
    let hasCompleted = false;
    
    intervalId = setInterval(async () => {
      try {
        const status = await SwapService.requests([reqId]);
        
        if (status.Ok?.[0]?.reply && !hasCompleted) {
          console.log("status", status)
          const reply = status.Ok[0].reply;
          
          if ('Swap' in reply) {
            const swapStatus = reply.Swap;
            
            if (showConfirmation) {
              const txIndex = swapStatus.txs?.findIndex(tx => !tx.completed);
              if (txIndex !== -1 && txIndex !== undefined) {
                const currentTx = swapStatus.txs[txIndex];
                currentStep = `Swapping ${currentTx.pay_symbol} → ${currentTx.receive_symbol}`;
                currentRouteIndex = txIndex;
              } else {
                currentStep = 'Processing...';
              }
            }
            
            if (!hasCompleted) {
              if (swapStatus.status === "Success") {
                hasCompleted = true;
                clearInterval(intervalId);
                await handleSwapSuccess(swapStatus);
              } else if (swapStatus.status === "Failed") {
                hasCompleted = true;
                clearInterval(intervalId);
                handleSwapFailure(swapStatus);
              }
            }
          }
        }
      } catch (err) {
        if (!hasCompleted) {
          hasCompleted = true;
          console.error('Polling error:', err);
          clearInterval(intervalId);
          handleSwapFailure(null);
        }
      }
    }, 250);
  }

  async function handleSwap(): Promise<boolean> {
    if (!isValidInput || isProcessing) {
      return false;
    }

    isProcessing = true;
    error = null;

    try {
      const requestId = await SwapService.executeSwap({
        payToken,
        payAmount,
        receiveToken,
        receiveAmount,
        slippage,
        backendPrincipal: KONG_BACKEND_PRINCIPAL,
      });
      console.log('requestId', requestId);

      if (requestId) {
        startPolling(requestId);
      } else {
        throw new Error("Failed to execute swap - no requestId returned");
      }
    } catch (err) {
      console.error('Swap execution error:', err);
      toastStore.error(err instanceof Error ? err.message : "Swap failed");
      isProcessing = false;
      isConfirmationOpen = false;
      return false;
    }
  }

  async function handleSwapSuccess(reply: any) {
    isProcessing = false;
    showConfirmation = false; // Instant close
    
    if (reply.receive_amount) {
      const receiveDecimals = getTokenDecimals(receiveToken);
      const finalAmount = SwapService.fromBigInt(reply.receive_amount, receiveDecimals);
      setReceiveAmount(finalAmount);
      setDisplayAmount(new BigNumber(finalAmount).toFixed(receiveDecimals));
    }

    const token = $tokenStore.tokens.find(t => t.symbol === payToken);
    const token1 = $tokenStore.tokens.find(t => t.symbol === receiveToken);
    await tokenStore.refreshBalance(token);
    await tokenStore.refreshBalance(token1);
        clearInputs();
    slippage = 2;
    toastStore.success("Swap successful");
  }

  function handleSwapFailure(reply: any) {
    isProcessing = false;
    showConfirmation = false; // Instant close
    toastStore.error(reply?.error || "Swap failed");
  }

  function clearInputs() {
    payAmount = "";
    setReceiveAmount("0");
    setDisplayAmount("0");
    price = "0";
    usdValue = "0";
    payUsdValue = "0";
    swapSlippage = 0;
    lpFee = "0";
    gasFee = "0";
    tokenFee = undefined;
    requestId = null;
    transactionStateObject = null;
    currentStep = '';
    currentRouteIndex = 0;
  }

  function handleSwapClick() {
    if (!isValidInput || isProcessing) return;
    showConfirmation = true;
  }

  async function handleMaxButtonClick() {
    const tokens = $tokenStore.tokens;
    const payTokenObj = tokens.find(t => t.symbol === payToken);
    if (!payTokenObj) {
        toastStore.error('Pay token not found');
        return;
    }

    // Get the user's balance
    const balanceBigInt = await IcrcService.getIcrc1Balance(
        payTokenObj,
        $walletStore.account.owner
    );
    const balance = SwapService.fromBigInt(balanceBigInt, payTokenObj.decimals);

    // Get the fee
    const feeBigInt = payTokenObj.fee ?? BigInt(10000); // Ensure fee is set
    const fee = SwapService.fromBigInt(feeBigInt, payTokenObj.decimals);

    // Calculate max amount by subtracting fee from balance
    const maxAmount = new BigNumber(balance).minus(fee);

    if (maxAmount.isNegative() || maxAmount.isZero()) {
        toastStore.error('Insufficient balance to cover the transaction fee.');
        return;
    }

    // Set the payAmount to maxAmount
    payAmount = maxAmount.toFixed(payTokenObj.decimals);
    debouncedGetQuote(payAmount);
  }
</script>

<div class="swap-wrapper">
  <div class="swap-container" in:fade={{ duration: 420 }}>
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
              onSettingsClick={() => showSettings = true}
            />
          </div>
        </div>
      {/each}

      <button 
        class="switch-button {isAnimating ? 'rotating' : ''}"
        on:click={handleTokenSwitch}
        disabled={isProcessing || isAnimating} 
      >
        <img src="/pxcomponents/arrow.svg" alt="swap" />
      </button>
    </div>

    <div class="swap-footer">
      <Button
        variant={swapSlippage > maxAllowedSlippage ? "blue" : "yellow"}
        disabled={!isValidInput || isProcessing || isAnimating || !$walletStore.isConnected}
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
  <div class="modal-overlay" transition:fade={{ duration: 200 }}>
    <SwapConfirmation
      {payToken}
      {payAmount}
      {receiveToken}
      {receiveAmount}
      {gasFees}
      {lpFees}
      {slippage}
      {routingPath}
      onConfirm={handleSwap}
      onClose={() => {
        showConfirmation = false;
        isProcessing = false;
      }}
    />
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
        maxAllowedSlippage = value;
        if (payAmount) debouncedGetQuote(payAmount);
      }}
      onApproveToken={async () => {}}
      onRevokeToken={async () => {}}
    />
  </div>
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
    gap: 0.25rem;
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
    cursor: pointer;
    z-index: 1;
    background: none;
    border: none;
    padding: 0;
  }

  .switch-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .switch-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    border-color: #2a5a3c;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    backdrop-filter: blur(8px);
    z-index: 50;
  }

  @media (max-width: 480px) {
    .swap-wrapper {
      padding: 0 0.5rem;
    }

    .switch-button {
      width: 32px;
      height: 32px;
      padding: 6px;
    }

    .swap-footer {
      margin-top: 2rem;
    }

    .panels-container {
      gap: 0.2rem;
    }
  }

  :global(.token-modal) {
    max-height: 80vh;
    overflow-y: auto;
  }

  :global(.swap-footer) {
    margin-top: 2.5rem;
  }

  .panel-content {
    transform-origin: center center;
    backface-visibility: hidden;
  }

  @keyframes slideUpFade {
    0% {
      transform: translateY(0);
      opacity: 1;
    }
    50% {
      transform: translateY(-6px);
      opacity: 0;
    }
    100% {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes slideDownFade {
    0% {
      transform: translateY(0);
      opacity: 1;
    }
    50% {
      transform: translateY(6px);
      opacity: 0;
    }
    100% {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes rotate {
    from {
      transform: translate(-50%, -50%) scale(1);
    }
    50% {
      transform: translate(-50%, -50%) scale(1.1);
    }
    to {
      transform: translate(-50%, -50%) scale(1);
    }
  }
</style>
