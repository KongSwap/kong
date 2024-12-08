<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import {
    tokenStore,
    getTokenDecimals,
  } from "$lib/services/tokens/tokenStore";
  import { SwapService } from "$lib/services/swap/SwapService";
  import { swapState } from "$lib/services/swap/SwapStateService";
  import PayReceiveSection from "./confirmation/PayReceiveSection.svelte";
  import RouteSection from "./confirmation/RouteSection.svelte";
  import FeesSection from "./confirmation/FeesSection.svelte";
  import { onMount, onDestroy } from "svelte";
  import { formatTokenValue } from '$lib/utils/tokenFormatters';

  export let payToken: FE.Token;
  export let payAmount: string;
  export let receiveToken: FE.Token;
  export let receiveAmount: string;
  export let routingPath: string[] = [];
  export let userMaxSlippage: number;
  export let onClose: () => void;
  export let onConfirm: () => Promise<boolean>;
  export let gasFees: string[] = [];
  export let lpFees: string[] = [];

  let isLoading = false;
  let isCountingDown = false;
  let error = "";
  let countdown = 2;
  let countdownInterval: NodeJS.Timeout;
  let initialQuoteLoaded = false;
  let initialQuoteData = {
    routingPath: [],
    gasFees: [],
    lpFees: [],
    payToken: payToken,
    receiveToken: receiveToken,
  };

  $: payUsdValue = formatTokenValue(payAmount.toString(), payToken?.price, payToken?.decimals);
  $: receiveUsdValue = formatTokenValue(receiveAmount.toString(), receiveToken?.price, receiveToken?.decimals);

  onMount(async () => {
    cleanComponent();
    try {
      const payDecimals = payToken.decimals;
      const payAmountBigInt = SwapService.toBigInt(payAmount, payDecimals);

      const quote = await SwapService.swap_amounts(
        payToken,
        payAmountBigInt,
        receiveToken,
      );

      if ("Ok" in quote) {
        const receiveDecimals = receiveToken.decimals;
        receiveAmount = SwapService.fromBigInt(
          quote.Ok.receive_amount,
          receiveDecimals,
        );

        if (quote.Ok.txs.length > 0 && !initialQuoteLoaded) {
          initialQuoteLoaded = true;
          routingPath = [
            payToken.symbol,
            ...quote.Ok.txs.map((tx) => tx.receive_symbol),
          ];
          gasFees = [];
          lpFees = [];

          quote.Ok.txs.forEach((tx) => {
            const receiveDecimals = getTokenDecimals(tx.receive_symbol);
            gasFees.push(
              SwapService.fromBigInt(tx.gas_fee, receiveToken.decimals),
            );
            lpFees.push(
              SwapService.fromBigInt(tx.lp_fee, receiveToken.decimals),
            );
          });
          initialQuoteData = {
            routingPath: routingPath,
            gasFees: gasFees,
            lpFees: lpFees,
            payToken: payToken,
            receiveToken: receiveToken,
          };
        }
      } else {
        error = quote.Err;
        setTimeout(() => onClose(), 2000);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to get quote";
      setTimeout(() => onClose(), 2000);
    }
  });

  async function handleConfirm() {
    if (isLoading || isCountingDown) return;

    isLoading = true;
    isCountingDown = true;
    error = "";
    countdown = 2;
    
    try {
      // Run countdown and swap execution in parallel
      const [, success] = await Promise.all([
        // Countdown Promise
        new Promise<void>((resolve) => {
          countdownInterval = setInterval(() => {
            if (countdown > 0) {
              countdown--;
            } else {
              clearInterval(countdownInterval);
              countdownInterval = undefined;
              isCountingDown = false;
              swapState.update(state => ({
                ...state,
                showConfirmation: false
              }));
              onClose?.();
              resolve();
            }
          }, 1000);
        }),
        // Swap execution Promise
        onConfirm()
      ]);
      
      if (success) {
        swapState.update(state => ({
          ...state,
          isProcessing: false,
          error: null,
          showSuccessModal: true
        }));
      } else {
        error = "Swap failed";
        swapState.update(state => ({
          ...state,
          isProcessing: false,
          error: "Swap failed"
        }));
      }
    } catch (e) {
      error = e.message || "An error occurred";
      swapState.update(state => ({
        ...state,
        isProcessing: false,
        error: e.message || "An error occurred"
      }));
    } finally {
      isLoading = false;
    }
  }

  function handleClose() {
    cleanComponent();
    swapState.update(state => ({
      ...state,
      isProcessing: false,
      showConfirmation: false,
      error: null
    }));
    onClose?.();
  }

  onDestroy(() => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
    cleanComponent();
  });

  $: totalGasFee = calculateTotalFee(initialQuoteData.gasFees);
  $: totalLPFee = calculateTotalFee(initialQuoteData.lpFees);

  function calculateTotalFee(fees: string[]): number {
    if (!routingPath.length || !fees.length) return 0;

    return routingPath.slice(1).reduce((acc, _, i) => {
      const token = $tokenStore.tokens.find(
        (t) => t.symbol === routingPath[i + 1],
      );
      if (!token) return acc;

      const decimals = token.decimals || 8;
      const feeValue = parseFloat(fees[i]) || 0;

      try {
        const stepFee = SwapService.fromBigInt(
          scaleDecimalToBigInt(feeValue, decimals),
          decimals,
        );
        return acc + (Number(stepFee) || 0);
      } catch (error) {
        console.error("Error calculating fee:", error);
        return acc;
      }
    }, 0);
  }

  function scaleDecimalToBigInt(decimal: number, decimals: number): bigint {
    if (isNaN(decimal) || !isFinite(decimal)) return 0n;

    const scaleFactor = 10n ** BigInt(decimals);
    const scaledValue = decimal * Number(scaleFactor);
    return BigInt(Math.floor(Math.max(0, scaledValue)));
  }

  function cleanComponent() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = undefined;
    }
    isCountingDown = false;
    countdown = 2;
    isLoading = false;
    error = "";
  }
</script>

<Modal
  isOpen={true}
  title="Review Swap"
  {onClose}
  variant="green"
  height="auto"
>
  {#if error}
    <div class="error-container">
      <div class="error-icon">!</div>
      <p class="error-message">{error}</p>
    </div>
  {:else if payToken && receiveToken}
    <div class="confirmation-container">
      <div class="sections-wrapper">
        <PayReceiveSection
          {payToken}
          {payAmount}
          {receiveToken}
          {receiveAmount}
        />
        <RouteSection
          routingPath={initialQuoteData.routingPath}
          gasFees={initialQuoteData.gasFees}
          lpFees={initialQuoteData.lpFees}
        />
        <FeesSection
          totalGasFee={totalGasFee}
          totalLPFee={totalLPFee}
          {userMaxSlippage}
          {receiveToken}
        />
      </div>

      <div class="button-container">
        <button
          class="swap-button"
          class:processing={isLoading}
          on:click={handleConfirm}
          disabled={isLoading}
        >
          <div class="button-content">
            <span class="button-text">
              {#if isCountingDown}
                Confirming in {countdown}...
              {:else if isLoading}
                Processing...
              {:else}
                Confirm Swap
              {/if}
            </span>
            {#if isLoading}
              <div class="loading-spinner"></div>
            {/if}
          </div>
          {#if !isLoading}
            <div class="button-glow"></div>
          {/if}
        </button>
      </div>
    </div>
  {/if}
</Modal>

<style>
  .confirmation-container {
    display: flex;
    flex-direction: column;
    min-height: 400px;
    max-height: 80vh;
  }

  .sections-wrapper {
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
    margin-bottom: 16px;
  }

  .sections-wrapper::-webkit-scrollbar {
    width: 6px;
  }

  .sections-wrapper::-webkit-scrollbar-track {
    background: transparent;
  }

  .sections-wrapper::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  .button-container {
    margin-top: auto;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 300px;
  }

  .loading-spinner {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .spinner-ring {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(255, 255, 255, 0.2);
    border-top: 4px solid #60A5FA;
    border-radius: 50%;
  }

  .loading-text {
    color: rgba(255, 255, 255, 0.8);
    margin-top: 16px;
  }

  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 200px;
    padding: 32px;
    text-align: center;
  }

  .error-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.2);
    color: rgb(239, 68, 68);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    font-weight: bold;
  }

  .error-message {
    color: rgb(239, 68, 68);
    font-size: 16px;
    max-width: 300px;
  }

  .swap-button {
    position: relative;
    width: 100%;
    padding: 16px 24px;
    min-height: 64px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: linear-gradient(135deg, 
      rgba(55, 114, 255, 0.95) 0%, 
      rgba(69, 128, 255, 0.95) 100%
    );
    box-shadow: 0 2px 6px rgba(55, 114, 255, 0.2);
    transform: translateY(0);
    transition: all 0.2s ease-out;
    overflow: hidden;
  }

  .swap-button:hover:not(:disabled) {
    background: linear-gradient(135deg, 
      rgba(85, 134, 255, 1) 0%, 
      rgba(99, 148, 255, 1) 100%
    );
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
    box-shadow: 
      0 4px 12px rgba(55, 114, 255, 0.3),
      0 0 0 1px rgba(255, 255, 255, 0.1);
  }

  .swap-button:active:not(:disabled) {
    transform: translateY(0);
    background: linear-gradient(135deg, 
      rgba(45, 104, 255, 1) 0%, 
      rgba(59, 118, 255, 1) 100%
    );
    box-shadow: 0 2px 4px rgba(55, 114, 255, 0.2);
    transition-duration: 0.1s;
  }

  .swap-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .button-content {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .button-text {
    font-size: 1.125rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    min-width: 140px;
    text-align: center;
  }

  .loading-spinner {
    width: 22px;
    height: 22px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .button-glow {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(
      circle at center,
      rgba(255, 255, 255, 0.15),
      rgba(255, 255, 255, 0) 70%
    );
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .swap-button:hover .button-glow {
    opacity: 1;
  }

  .swap-button.processing {
    animation: pulse 2s infinite ease-in-out;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes pulse {
    0% { opacity: 0.8; }
    50% { opacity: 0.6; }
    100% { opacity: 0.8; }
  }
</style>
