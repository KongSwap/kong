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
  import { toastStore } from "$lib/stores/toastStore";

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
  let error = "";
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
        toastStore.error(error);
        setTimeout(() => onClose(), 2000);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to get quote";
      toastStore.error(error);
      setTimeout(() => onClose(), 2000);
    }
  });

  async function handleConfirm() {
    if (isLoading) return;

    isLoading = true;
    error = "";
    
    try {
      const success = await onConfirm();
      
      if (success) {
        swapState.update(state => ({
          ...state,
          showConfirmation: false,
          isProcessing: false,
          error: null,
          showSuccessModal: true
        }));
        onClose?.();
      } else {
        error = "Swap failed";
        toastStore.error(error);
        swapState.update(state => ({
          ...state,
          isProcessing: false,
          error: "Swap failed"
        }));
      }
    } catch (e) {
      error = e.message || "An error occurred";
      toastStore.error(error);
      swapState.update(state => ({
        ...state,
        isProcessing: false,
        error: e.message || "An error occurred"
      }));
    } finally {
      isLoading = false;
    }
  }

  onDestroy(() => {
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
        toastStore.error("Error calculating fee");
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
      <div class="content-wrapper">
        <div class="sections-wrapper">
          <PayReceiveSection
            {payToken}
            {payAmount}
            {receiveToken}
            {receiveAmount}
          />
          <RouteSection
            routingPath={initialQuoteData.routingPath}
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
                {#if isLoading}
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
    </div>
  {/if}
</Modal>

<style>
  .confirmation-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    backdrop-filter: blur(16px);
    border-radius: 24px;
    transition: all 0.3s ease-in-out;
  }

  .content-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .sections-wrapper {
    display: flex;
    flex-direction: column;
    gap: 16px;    
    padding: 4px;
    flex: 1;
    border-radius: 24px;
  }

  .sections-wrapper > :global(*) {
    position: relative;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.2s ease;
    width: 100%;
    box-sizing: border-box;
  }

  .button-container {
    padding-top: 16px;
    margin-top: auto;
  }

  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 24px;
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
    padding: 16px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: linear-gradient(135deg, 
      rgba(55, 114, 255, 0.95) 0%, 
      rgba(111, 66, 193, 0.95) 100%
    );
    box-shadow: 0 2px 6px rgba(55, 114, 255, 0.2);
    transform: translateY(0);
    transition: all 0.2s ease-out;
    overflow: hidden;
    cursor: pointer;
  }

  .swap-button:disabled {
    opacity: 0.7;
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
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    text-align: center;
  }

  .loading-spinner {
    width: 20px;
    height: 20px;
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
      circle at var(--x, 50%) var(--y, 50%),
      rgba(255, 255, 255, 0.2),
      rgba(255, 255, 255, 0) 70%
    );
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .swap-button:hover .button-glow {
    opacity: 1;
  }

  .swap-button.processing {
    animation: pulse 2s infinite cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes pulse {
    0% { opacity: 0.9; }
    50% { opacity: 0.7; }
    100% { opacity: 0.9; }
  }

  @media (max-width: 640px) {
    .confirmation-container {
      padding: 0;
    }

    .content-wrapper {
      padding: 0;
      justify-content: space-between;
    }

    .sections-wrapper {
      gap: 12px;
      padding: 0;
    }

    .button-container {
      padding-top: 0;
      margin-top: 0;
    }

    .error-container {
      padding: 0;
      gap: 12px;
    }

    .error-icon {
      width: 40px;
      height: 40px;
      font-size: 20px;
    }

    .error-message {
      font-size: 14px;
    }

    .swap-button {
      padding: 12px;
      border-radius: 12px;
    }

    .button-text {
      font-size: 1rem;
    }

    .loading-spinner {
      width: 18px;
      height: 18px;
    }
  }
</style>
