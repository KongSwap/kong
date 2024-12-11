<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { tokenStore, getTokenDecimals } from "$lib/services/tokens/tokenStore";
  import { SwapService } from "$lib/services/swap/SwapService";
  import { swapState } from "$lib/services/swap/SwapStateService";
  import { swapStatusStore } from "$lib/services/swap/swapStore";
  import PayReceiveSection from "./confirmation/PayReceiveSection.svelte";
  import RouteSection from "./confirmation/RouteSection.svelte";
  import FeesSection from "./confirmation/FeesSection.svelte";
  import { onMount, onDestroy } from "svelte";
  import { formatTokenValue } from "$lib/utils/tokenFormatters";

  /**
   * This component presents a confirmation modal for a token swap.
   * It calculates and displays the routing path, fees, and final amounts.
   * After the user confirms the swap, it listens for the actual completion
   * status from the backend through the swapStatusStore to ensure that the
   * modal only closes and shows success once the swap is truly completed.
   */

  // Props provided from the parent:
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
  // A unique identifier for the swap, needed to monitor its final completion status
  export let swapId: string;

  // Internal state variables:
  let isLoading = false;
  let isWaitingForCompletion = false;
  let errorMessage = "";
  let progress = 0;
  let currentStatusMessage = "";

  // These messages will be shown during the waiting period for swap completion
  // to provide a more engaging and entertaining user experience.
  const statusMessages = [
    "Exploring the KONG SWAP jungle for liquidity pools...",
    "Bribing gorillas with bananas to speed up the swap...",
    "Swinging across vines of complex blockchain data...",
    "Consulting the ancient DEFI banana oracle...",
    "Convincing monkeys to index the ledger faster...",
    "Humming at validators to decode cryptic runes...",
    "Juggling bananas to impress the blockchain gods...",
    "Digging through banana peels of transaction history...",
    "Channeling the spirit of KONG to finalize the swap...",
    "Embracing the DEFI wilderness and emerging victorious!"
  ];

  let initialQuoteLoaded = false;
  let initialQuoteData = {
    routingPath: [],
    gasFees: [],
    lpFees: [],
    payToken: payToken,
    receiveToken: receiveToken,
  };

  // Reactive values:
  $: payUsdValue = formatTokenValue(payAmount.toString(), payToken?.price, payToken?.decimals);
  $: receiveUsdValue = formatTokenValue(receiveAmount.toString(), receiveToken?.price, receiveToken?.decimals);
  $: modalTitle = errorMessage
    ? "Swap Error"
    : isWaitingForCompletion
      ? "Swap In Progress..."
      : isLoading
        ? "Initiating Swap..."
        : "Confirm Swap";

  // Subscription handle for tracking swap status
  let unsubscribeFromSwapStatus: () => void;

  onMount(async () => {
    cleanComponent();
    // Subscribe to swapStatusStore to detect when the swap actually finishes.
    unsubscribeFromSwapStatus = swapStatusStore.subscribe((store) => {
      const swapStatus = store[swapId];
      // Only proceed if we have a valid swapStatus and we are currently waiting for completion.
      if (swapStatus && isWaitingForCompletion) {
        if (swapStatus.status === "Success") {
          // The swap is now fully completed according to the backend polling.
          completeSwapUIFlow(true);
          onClose(); // Close modal when swap is successful
        } else if (swapStatus.status === "Failed" || swapStatus.status === "Error" || swapStatus.status === "Timeout") {
          // The swap has definitively failed.
          completeSwapUIFlow(false, swapStatus.error || "Swap failed");
        }
      }
    });

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

          quote.Ok.txs.forEach((transaction) => {
            const transactionDecimals = getTokenDecimals(transaction.receive_symbol);
            gasFees.push(
              SwapService.fromBigInt(transaction.gas_fee, receiveToken.decimals),
            );
            lpFees.push(
              SwapService.fromBigInt(transaction.lp_fee, receiveToken.decimals),
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
        errorMessage = quote.Err;
        // In case of initial quote error, allow the user to see the error and close manually.
        // No automatic closing.
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Failed to get quote";
      // Show the error and let the user close the modal.
    }
  });

  onDestroy(() => {
    cleanComponent();
    if (unsubscribeFromSwapStatus) {
      unsubscribeFromSwapStatus();
    }
  });

  async function handleConfirm() {
    if (isLoading || isWaitingForCompletion) return;

    // Reset state and start loading
    isLoading = true;
    errorMessage = "";
    progress = 0;
    currentStatusMessage = "";
    isWaitingForCompletion = false;

    try {
      // The onConfirm function presumably initiates the swap execution.
      // It returns true or false depending on immediate request success,
      // not the final on-chain confirmation.
      const immediateSuccess = await onConfirm();

      if (immediateSuccess) {
        // If immediate request succeeded, we now wait for the backend to report actual completion.
        // Start showing progress and fun status messages.
        startProgressAnimation();
        isWaitingForCompletion = true;
        isLoading = false;

        // We do NOT close the modal here. We rely on swapStatusStore updates to finalize.
        // When swapStatusStore signals success or failure, completeSwapUIFlow will be called.
      } else {
        // If the immediate request failed, show error message.
        errorMessage = "Swap request could not be initiated.";
        swapState.update(state => ({
          ...state,
          isProcessing: false,
          error: "Swap request failed"
        }));
        isLoading = false;
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "An error occurred";
      errorMessage = errMsg;
      swapState.update(state => ({
        ...state,
        isProcessing: false,
        error: errMsg
      }));
      isLoading = false;
    }
  }

  function completeSwapUIFlow(success: boolean, failureMessage?: string) {
    stopProgressAnimation();
    isWaitingForCompletion = false;

    if (success) {
      // Close immediately on success and show success modal
      swapState.update(state => ({
        ...state,
        isProcessing: false,
        error: null,
        showSuccessModal: true,
        showConfirmation: false
      }));
      onClose?.();
    } else {
      // Show the error message and do not close automatically
      errorMessage = failureMessage || "Swap failed";
      swapState.update(state => ({
        ...state,
        isProcessing: false,
        error: errorMessage
      }));
    }
  }

  // Handle a periodic update of the progress bar and status messages while waiting.
  let progressInterval: NodeJS.Timeout | undefined;

  function startProgressAnimation() {
    stopProgressAnimation();
    let stepCount = 0;
    progressInterval = setInterval(() => {
      stepCount += 1;

      // Increase progress slowly until 90% to indicate ongoing waiting,
      // final confirmation will jump to 100% when done.
      if (progress < 90) {
        progress += 2;
      }

      // Update the status message from the array based on progress
      const messageIndex = Math.floor((statusMessages.length * progress) / 100);
      if (messageIndex >= 0 && messageIndex < statusMessages.length) {
        currentStatusMessage = statusMessages[messageIndex];
      }

    }, 500);
  }

  function stopProgressAnimation() {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = undefined;
    }
  }

  $: totalGasFee = calculateTotalFee(initialQuoteData.gasFees);
  $: totalLPFee = calculateTotalFee(initialQuoteData.lpFees);

  function calculateTotalFee(fees: string[]): number {
    if (!routingPath.length || !fees.length) return 0;

    return routingPath.slice(1).reduce((accumulator, _, i) => {
      const token = $tokenStore.tokens.find((t) => t.symbol === routingPath[i + 1]);
      if (!token) return accumulator;

      const decimals = token.decimals || 8;
      const feeValue = parseFloat(fees[i]) || 0;

      try {
        const stepFee = SwapService.fromBigInt(
          scaleDecimalToBigInt(feeValue, decimals),
          decimals,
        );
        return accumulator + (Number(stepFee) || 0);
      } catch (calculationError) {
        console.error("Error calculating fee:", calculationError);
        return accumulator;
      }
    }, 0);
  }

  function scaleDecimalToBigInt(decimalValue: number, decimals: number): bigint {
    if (isNaN(decimalValue) || !isFinite(decimalValue)) return 0n;

    const scaleFactor = 10n ** BigInt(decimals);
    const scaledValue = decimalValue * Number(scaleFactor);
    return BigInt(Math.floor(Math.max(0, scaledValue)));
  }

  function cleanComponent() {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = undefined;
    }
    isLoading = false;
    isWaitingForCompletion = false;
    progress = 0;
    currentStatusMessage = "";
    errorMessage = "";
  }
</script>

<Modal
  isOpen={true}
  title={modalTitle}
  {onClose}
  variant={errorMessage ? 'yellow' : isWaitingForCompletion || isLoading ? 'yellow' : 'green'}
  height="auto"
  minHeight="350px"
>
  {#if errorMessage}
    <!-- Show error state -->
    <div class="error-container">
      <div class="error-icon">!</div>
      <p class="error-message">{errorMessage}</p>
    </div>

  {:else if isWaitingForCompletion || isLoading}
    <!-- Loading state -->
    <div class="loading-container">
      <p class="status-message">Processing your swap...</p>
    </div>

  {:else if payToken && receiveToken}
    <!-- Default confirmation view before swap initiation -->
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

  .loading-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 250px;
    padding: 24px;
  }

  .status-message {
    font-size: 1rem;
    color: rgba(255, 255, 255, 0.9);
    text-align: center;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
</style>
