<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { SwapService } from "$lib/services/swap/SwapService";
  import { swapState } from "$lib/services/swap/SwapStateService";
  import PayReceiveSection from "./confirmation/PayReceiveSection.svelte";
  import RouteSection from "./confirmation/RouteSection.svelte";
  import FeesSection from "./confirmation/FeesSection.svelte";
  import { onMount, onDestroy } from "svelte";
  import { fade } from "svelte/transition";
  import { toastStore } from "$lib/stores/toastStore";
  import { createEventDispatcher } from "svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
    import BigNumber from "bignumber.js";

  export let payToken: FE.Token;
  export let payAmount: string;
  export let receiveToken: FE.Token;
  export let receiveAmount: string;
  export let routingPath: string[] = [];
  export let userMaxSlippage: number;
  export let onClose: () => void;
  export let onConfirm: () => Promise<boolean>;

  interface Fee {
    amount: string;
    token: string;
    decimals: number;
  }

  let gasFees: Fee[] = [];
  let lpFees: Fee[] = [];

  let isLoading = false;
  let error = "";
  let quoteUpdateInterval: ReturnType<typeof setInterval>;
  const QUOTE_UPDATE_INTERVAL = 1000; // 1 second

  $: payUsdValue = formatBalance(payAmount.toString(), payToken?.decimals);
  $: receiveUsdValue = formatBalance(
    receiveAmount.toString(),
    receiveToken?.decimals,
  );

  $: quoteData = {
    routingPath,
    gasFees,
    lpFees,
    payToken,
    receiveToken,
  };

  const dispatch = createEventDispatcher<{
    quoteUpdate: { receiveAmount: string };
  }>();

  onMount(async () => {
    cleanComponent();
    await updateQuote(); // Initial quote update

    // Set up periodic quote updates
    quoteUpdateInterval = setInterval(async () => {
      if (!isLoading) {
        // Only update if not processing a swap
        await updateQuote();
      }
    }, QUOTE_UPDATE_INTERVAL);
  });

  async function handleConfirm() {
    if (isLoading) {
      return;
    }

    // Clear the quote update interval when starting the swap
    if (quoteUpdateInterval) {
      clearInterval(quoteUpdateInterval);
    }

    isLoading = true;
    error = "";

    try {
      const result = await onConfirm();

      if (result === true) {
        swapState.update((state) => ({
          ...state,
          showConfirmation: false,
          isProcessing: false,
          error: null,
          showSuccessModal: true,
        }));
        onClose?.();
        return true;
      } else {
        console.log("Swap failed or returned non-true value");
        error = "Swap failed";
        toastStore.error(error);
        return false;
      }
    } catch (e) {
      console.error("Swap confirmation error:", e);
      error = e.message || "An error occurred";
      toastStore.error(error);
      return false;
    } finally {
      isLoading = false;
    }
  }

  onDestroy(() => {
    cleanComponent();
    if (quoteUpdateInterval) {
      clearInterval(quoteUpdateInterval);
    }
  });

  function calculateTotalFee(fees: Fee[]): string {
    if (!fees || !Array.isArray(fees)) {
      return "0";
    }

    return fees.reduce((total, fee) => {
      return new BigNumber(total).plus(new BigNumber(fee.amount)).toString();
    }, "0");
  }

  function cleanComponent() {
    isLoading = false;
    error = "";
    if (quoteUpdateInterval) {
      clearInterval(quoteUpdateInterval);
    }
  }

  async function updateQuote() {
    try {
      const payDecimals = payToken.decimals;
      const payAmountBigInt = SwapService.toBigInt(payAmount, payDecimals);

      const quote = await SwapService.swap_amounts(
        payToken,
        payAmountBigInt,
        receiveToken,
      );

      if ("Ok" in quote) {
        receiveAmount = formatBalance(
          quote.Ok.receive_amount,
          receiveToken.decimals,
        );

        dispatch("quoteUpdate", { receiveAmount });

        if (quote.Ok.txs.length > 0) {
          routingPath = [
            payToken.symbol,
            ...quote.Ok.txs.map((tx) => tx.receive_symbol),
          ];

          // Update fees for each step in the path
          gasFees = quote.Ok.txs.map((tx) => {
            return {
              amount: formatBalance(tx.gas_fee.toString(), tx.receive_symbol === "ICP" ? 8 : receiveToken.decimals),
              token: tx.receive_symbol,
              decimals: tx.receive_symbol === "ICP" ? 8 : receiveToken.decimals
            };
          });

          lpFees = quote.Ok.txs.map((tx) => {
            return {
              amount: formatBalance(tx.lp_fee.toString(), tx.receive_symbol === "ICP" ? 8 : receiveToken.decimals),
              token: tx.receive_symbol,
              decimals: tx.receive_symbol === "ICP" ? 8 : receiveToken.decimals
            };
          });
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
  }
</script>

<Modal
  isOpen={true}
  title="Review Swap"
  {onClose}
  variant="solid"
  height="auto"
  className="mobile:!p-0"
>
<div class="flex flex-col gap-4">
  {#if error}
    <div class="error-container">
      <div class="error-icon">!</div>
      <p class="error-message">{error}</p>
    </div>
  {:else if payToken && receiveToken}
    <div class="confirmation-container px-2" transition:fade={{ duration: 200 }}>
      <div class="content-wrapper">
        <div class="sections-wrapper">
          <PayReceiveSection
            {payToken}
            {payAmount}
            {receiveToken}
            {receiveAmount}
            {payUsdValue}
            {receiveUsdValue}
          />
          <RouteSection routingPath={quoteData.routingPath} />
          <FeesSection
            {gasFees}
            {lpFees}
            {userMaxSlippage}
            {receiveToken}
          />
        </div>
      </div>
    </div>
    <div class="button-container py-4 px-2">
      <button
        class="swap-button"
        class:processing={isLoading}
        class:shine-animation={!isLoading}
        on:click={handleConfirm}
        disabled={isLoading}
        on:mousedown={() => {}}
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
          <div class="shine-effect"></div>
          <div class="ready-glow"></div>
        {/if}
      </button>
    </div>
  {/if}
</div>
</Modal>

<style>
  .confirmation-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    backdrop-filter: blur(16px);
    @apply rounded-md;
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
    gap: 16px;;
    flex: 1;
    @apply rounded-md;
  }

  .sections-wrapper > :global(*) {
    position: relative;
    background: rgba(255, 255, 255, 0.03);
    @apply rounded-md;
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.2s ease;
    width: 100%;
    box-sizing: border-box;
  }

  .button-container {
    @apply pt-2;
    margin-top: auto;
    width: 100%;
    position: sticky;
    bottom: 0;
    backdrop-filter: blur(8px);
    border-radius: 0 0 12px 12px;
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
    @apply bg-kong-bg-dark;
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
    @apply rounded-md;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: linear-gradient(
      135deg,
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
    0% {
      opacity: 0.9;
    }
    50% {
      opacity: 0.7;
    }
    100% {
      opacity: 0.9;
    }
  }

  .shine-effect {
    position: absolute;
    top: 0;
    left: -100%;
    width: 50%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.2),
      transparent
    );
    transform: skewX(-20deg);
    pointer-events: none;
  }

  .shine-animation .shine-effect {
    animation: shine 3s infinite;
  }

  .ready-glow {
    position: absolute;
    inset: -2px;
    border-radius: 18px;
    background: linear-gradient(
      135deg,
      rgba(55, 114, 255, 0.5),
      rgba(111, 66, 193, 0.5)
    );
    opacity: 0;
    filter: blur(8px);
    transition: opacity 0.3s ease;
  }

  .shine-animation .ready-glow {
    animation: pulse-glow 2s ease-in-out infinite;
  }

  @keyframes shine {
    0%,
    100% {
      left: -100%;
    }
    35%,
    65% {
      left: 200%;
    }
  }

  @keyframes pulse-glow {
    0%,
    100% {
      opacity: 0;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.02);
    }
  }

  @media (max-width: 640px) {
    .confirmation-container {
      padding: 0;
      height: auto;
    }

    .content-wrapper {
      padding: 16px;
      height: auto;
    }

    .sections-wrapper {
      gap: 12px;
      padding: 0;
    }

    .button-container {
      padding: 16px;
      margin-top: 0;
      border-radius: 0;
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
