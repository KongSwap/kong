<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import { SwapService } from "$lib/services/swap/SwapService";
  import PayReceiveSection from "./confirmation/PayReceiveSection.svelte";
  import FeesSection from "./confirmation/FeesSection.svelte";
  import { onMount, onDestroy } from "svelte";
  import { fade } from "svelte/transition";
  import { toastStore } from "$lib/stores/toastStore";
  import { createEventDispatcher } from "svelte";
  import { formatBalance, formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import BigNumber from "bignumber.js";

  export let payToken: FE.Token;
  export let payAmount: string;
  export let receiveToken: FE.Token;
  export let receiveAmount: string;
  export let routingPath: string[] = [];
  export let userMaxSlippage: number;
  export let onClose: () => void;
  export let onConfirm: () => Promise<boolean>;

  // New state variables for enhanced functionality
  let quoteValiditySeconds = 30;
  let priceImpact = 0;
  let estimatedTime = '1-2 minutes';
  let exchangeRate = '0';
  let showPriceImpactWarning = false;
  let countdownInterval: ReturnType<typeof setInterval>;

  interface Fee {
    amount: string;
    token: string;
    decimals: number;
  }

  let gasFees: Fee[] = [];
  let lpFees: Fee[] = [];
  let currentRoutingPath: string[] = [];

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
      onConfirm();
      onClose?.();
      return true;
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
    if (countdownInterval) clearInterval(countdownInterval);
  });

  function cleanComponent() {
    isLoading = false;
    error = "";
    if (quoteUpdateInterval) {
      clearInterval(quoteUpdateInterval);
    }
  }

  // Add new function to calculate exchange rate
  function updateExchangeRate() {
    if (payAmount && receiveAmount && payToken && receiveToken) {
      const payValue = Number(payAmount);
      const receiveValue = Number(receiveAmount);
      if (payValue && receiveValue) {
        exchangeRate = formatToNonZeroDecimal(receiveValue / payValue);
      }
    }
  }

  // Enhance the updateQuote function
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

        // Calculate price impact using BigNumber for precision
        const payAmountNum = new BigNumber(payAmount).times(10 ** payToken.decimals);
        const receiveAmountNum = new BigNumber(quote.Ok.receive_amount.toString());
        
        if (payAmountNum.isGreaterThan(0) && receiveAmountNum.isGreaterThan(0)) {
          // Calculate price impact using mid_price
          const expectedAmount = new BigNumber(payAmountNum).times(quote.Ok.mid_price);
          const actualAmount = receiveAmountNum;
          
          if (expectedAmount.isGreaterThan(0)) {
            priceImpact = expectedAmount.minus(actualAmount).div(expectedAmount).times(100).toNumber();
          } else {
            priceImpact = 0;
          }
        } else {
          priceImpact = 0;
        }

        // Show warning for high price impact (>2%)
        showPriceImpactWarning = priceImpact > 2;

        updateExchangeRate();
        dispatch("quoteUpdate", { receiveAmount });

        if (quote.Ok.txs.length > 0) {
          currentRoutingPath = [
            payToken.canister_id,
            ...quote.Ok.txs.map((tx) => tx.receive_address),
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
  variant="transparent"
  height="auto"
  isPadded={true}
  width="500px"
>
<div class="flex flex-col gap-3 pb-2">
  {#if error}
    <Panel variant="transparent" type="secondary" unpadded={false}>
      <div class="error-container">
        <div class="error-icon">!</div>
        <p class="error-message">{error}</p>
      </div>
    </Panel>
  {:else if payToken && receiveToken}
    <div class="confirmation-container" transition:fade={{ duration: 200 }}>
      <div class="content-wrapper">        
        <div class="sections-wrapper">
          <Panel variant="transparent" type="secondary" unpadded={true}>
            <PayReceiveSection
              {payToken}
              {payAmount}
              {receiveToken}
              {receiveAmount}
              routingPath={currentRoutingPath}
            />
          </Panel>
          
          <Panel variant="transparent" type="secondary" unpadded={true}>
            <FeesSection
              {gasFees}
              {lpFees}
              {userMaxSlippage}
              {priceImpact}
              {showPriceImpactWarning}
            />
          </Panel>
        </div>
      </div>
    </div>
    <div class="button-container">
      <button
        class="swap-button"
        class:processing={isLoading}
        class:shine-animation={!isLoading}
        class:warning={showPriceImpactWarning}
        on:click={handleConfirm}
        disabled={isLoading}
      >
        <div class="button-content">
          <span class="button-text">
            {#if isLoading}
              Processing...
            {:else if showPriceImpactWarning}
              Confirm Swap (High Impact)
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

<style lang="postcss">
  .confirmation-container {
    @apply flex flex-col w-full rounded-md transition-all duration-300 px-2;
  }

  .content-wrapper {
    @apply flex flex-col h-full;
  }

  .sections-wrapper {
    @apply flex flex-col gap-3 flex-1 rounded-md;
  }

  .sections-wrapper > :global(*) {
    @apply relative rounded-md border border-kong-border transition-all duration-200 w-full box-border;
  }

  .button-container {
    @apply w-full sticky bottom-0 rounded-b-xl px-2 py-3;
  }

  .error-container {
    @apply flex flex-col items-center justify-center gap-3 p-4 text-center;
  }

  .error-icon {
    @apply w-10 h-10 rounded-full bg-kong-bg-dark text-kong-error flex items-center justify-center text-xl font-bold;
  }

  .error-message {
    @apply text-kong-error text-sm max-w-[300px];
  }

  .swap-button {
    @apply relative w-full p-3 rounded-xl border border-kong-border/10 cursor-pointer transform transition-all duration-200 overflow-hidden;
    background: linear-gradient(
      135deg,
      rgb(var(--accent-blue) / 0.95) 0%,
      rgb(var(--accent-purple) / 0.95) 100%
    );
    box-shadow: 0 2px 6px rgb(var(--accent-blue) / 0.2);
  }

  .swap-button:disabled {
    @apply opacity-70 cursor-not-allowed;
  }

  .button-content {
    @apply relative z-[1] flex items-center justify-center gap-2;
  }

  .button-text {
    @apply text-base font-semibold text-white text-center;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .loading-spinner {
    @apply w-4 h-4 rounded-full;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    animation: spin 0.8s linear infinite;
  }

  .button-glow {
    @apply absolute inset-0 opacity-0 transition-opacity duration-300;
    background: radial-gradient(
      circle at var(--x, 50%) var(--y, 50%),
      rgba(255, 255, 255, 0.2),
      rgba(255, 255, 255, 0) 70%
    );
  }

  .swap-button:hover .button-glow {
    @apply opacity-100;
  }

  .swap-button.processing {
    animation: pulse 2s infinite cubic-bezier(0.4, 0, 0.2, 1);
  }

  .swap-button.warning {
    background: linear-gradient(
      135deg,
      rgb(var(--accent-yellow) / 0.95) 0%,
      rgb(var(--accent-red) / 0.95) 100%
    );
  }

  @media (max-width: 640px) {
    .confirmation-container {
      height: auto;
    }

    .content-wrapper {
      @apply p-2;
      height: auto;
    }

    .sections-wrapper {
      @apply gap-2;
    }

    .button-container {
      @apply p-2 rounded-none;
    }

    .error-container {
      @apply p-3 gap-2;
    }

    .error-icon {
      @apply w-8 h-8 text-lg;
    }

    .error-message {
      @apply text-xs;
    }

    .swap-button {
      @apply p-2.5 rounded-lg;
    }

    .button-text {
      @apply text-sm;
    }

    .loading-spinner {
      @apply w-3.5 h-3.5;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 0.9;
    }
    50% {
      opacity: 0.7;
    }
  }

  .shine-effect {
    @apply absolute top-0 left-[-100%] w-1/2 h-full pointer-events-none;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.2),
      transparent
    );
    transform: skewX(-20deg);
  }

  .shine-animation .shine-effect {
    animation: shine 3s infinite;
  }

  .ready-glow {
    @apply absolute inset-[-2px] rounded-[18px] opacity-0 transition-opacity duration-300;
    background: linear-gradient(
      135deg,
      rgb(var(--accent-blue) / 0.5),
      rgb(var(--accent-purple) / 0.5)
    );
    filter: blur(8px);
  }

  .shine-animation .ready-glow {
    animation: pulse-glow 2s ease-in-out infinite;
  }

  @keyframes shine {
    0%, 100% {
      left: -100%;
    }
    35%, 65% {
      left: 200%;
    }
  }

  @keyframes pulse-glow {
    0%, 100% {
      opacity: 0;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.02);
    }
  }
</style>
