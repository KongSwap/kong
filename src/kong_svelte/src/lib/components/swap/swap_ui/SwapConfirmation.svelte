<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import {
    tokenStore,
    getTokenDecimals,
  } from "$lib/services/tokens/tokenStore";
  import { SwapService } from "$lib/services/swap/SwapService";
  import Button from "$lib/components/common/Button.svelte";
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
  let isCountingDown = false; // Added for countdown state
  let error = "";
  let isInitializing = true;
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
      isInitializing = true;
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

        // Only update routing path and fees on initial load
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
    } finally {
      isInitializing = false;
    }
  });

  async function handleConfirm() {
    if (isLoading || isCountingDown) return; // Prevent multiple triggers

    isLoading = true;
    error = "";

    try {
      const success = onConfirm();
      if (success) {
        // Start countdown
        isCountingDown = true;
        countdown = 2; // Reset countdown
        countdownInterval = setInterval(() => {
          countdown--;
          if (countdown <= 0) {
            clearInterval(countdownInterval);
            cleanComponent();
            onClose();
          }
        }, 1000);
      } else {
        isLoading = false;
        error = "Swap failed";
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Swap failed";
      isLoading = false;
    }
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
      // Parse the fee value safely
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
    // Ensure we're converting a valid number
    return BigInt(Math.floor(Math.max(0, scaledValue)));
  }

  function cleanComponent() {
    isLoading = false;
    isCountingDown = false;
    countdown = 2;
    initialQuoteLoaded = false;
    initialQuoteData = {
      routingPath: [],
      gasFees: [],
      lpFees: [],
      payToken: payToken,
      receiveToken: receiveToken,
    };
  }
</script>

<Modal
  isOpen={true}
  title="Review Swap"
  {onClose}
  variant="green"
  height="auto"
>
  {#if isInitializing}
    <div class="loading-container">
      <div class="loading-spinner">
        <div class="spinner-ring"></div>
        <span class="loading-text">Getting latest price...</span>
      </div>
    </div>
  {:else if error}
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
          payToken={initialQuoteData.payToken}
          {receiveToken}
        />
        <FeesSection
          totalGasFee={totalGasFee}
          totalLPFee={totalLPFee}
          {userMaxSlippage}
          {receiveToken}
        />
      </div>

      <div class="button-container">
        <Button
          text={isCountingDown ? `Confirming ${countdown}...` : "Confirm Swap"}
          variant="yellow"
          size="big"
          onClick={handleConfirm}
          disabled={isLoading || isCountingDown}
          width="100%"
        />
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
    padding-right: 8px;
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
</style>
