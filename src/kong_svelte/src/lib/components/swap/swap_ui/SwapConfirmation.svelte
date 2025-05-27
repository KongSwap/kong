<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import { SwapService } from "$lib/services/swap/SwapService";
  import PayReceiveSection from "./confirmation/PayReceiveSection.svelte";
  import FeesSection from "./confirmation/FeesSection.svelte";
  import { fade } from "svelte/transition";
  import { toastStore } from "$lib/stores/toastStore";
  import { formatBalance, formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import BigNumber from "bignumber.js";
    import { panelRoundness } from "$lib/stores/derivedThemeStore";

  const { 
    payToken,
    payAmount: initialPayAmount,
    receiveToken,
    receiveAmount: initialReceiveAmount,
    userMaxSlippage,
    onClose,
    onConfirm
  } = $props<{
    payToken: Kong.Token;
    payAmount: string;
    receiveToken: Kong.Token;
    receiveAmount: string;
    userMaxSlippage: number;
    onClose: () => void;
    onConfirm: () => Promise<boolean>;
  }>();

  // State variables
  let payAmount = $state(initialPayAmount);
  let receiveAmount = $state(initialReceiveAmount);
  let priceImpact = $state(0);
  let exchangeRate = $state('0');
  let showPriceImpactWarning = $state(false);
  let countdownInterval = $state<ReturnType<typeof setInterval> | null>(null);
  let gasFees = $state<Fee[]>([]);
  let lpFees = $state<Fee[]>([]);
  let currentRoutingPath = $state<string[]>([]);
  let isLoading = $state(false);
  let error = $state("");
  let quoteUpdateInterval = $state<ReturnType<typeof setInterval> | null>(null);
  const QUOTE_UPDATE_INTERVAL = 2000; // 2 seconds

  interface Fee {
    amount: string;
    token: string;
    decimals: number;
  }

  // Initialize and cleanup
  $effect.root(() => {
    cleanComponent();
    updateQuote(); // Initial quote update

    // Set up periodic quote updates
    quoteUpdateInterval = setInterval(async () => {
      if (!isLoading) {
        // Only update if not processing a swap
        await updateQuote();
      }
    }, QUOTE_UPDATE_INTERVAL);

    // Cleanup function
    return () => {
      cleanComponent();
      if (quoteUpdateInterval) {
        clearInterval(quoteUpdateInterval);
      }
      if (countdownInterval) clearInterval(countdownInterval);
    };
  });

  function cleanComponent() {
    isLoading = false;
    error = "";
    if (quoteUpdateInterval) {
      clearInterval(quoteUpdateInterval);
      quoteUpdateInterval = null;
    }
  }

  async function handleConfirm() {
    if (isLoading) {
      return;
    }

    // Clear the quote update interval when starting the swap
    if (quoteUpdateInterval) {
      clearInterval(quoteUpdateInterval);
      quoteUpdateInterval = null;
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
        const payAmountNum = new BigNumber(payAmount);
        const receiveAmountNum = new BigNumber(SwapService.fromBigInt(
          quote.Ok.receive_amount,
          receiveToken.decimals
        ));
        
        if (payAmountNum.isGreaterThan(0) && receiveAmountNum.isGreaterThan(0)) {
          // Calculate price impact using mid_price
          // Use formatted values directly without applying additional scaling
          const expectedAmount = payAmountNum.times(quote.Ok.mid_price);
          const actualAmount = receiveAmountNum;
          
          if (expectedAmount.isGreaterThan(0)) {
            priceImpact = expectedAmount.minus(actualAmount).div(expectedAmount).times(100).toNumber();
            // Ensure we don't have negative price impact (which could happen due to rounding)
            priceImpact = Math.max(0, priceImpact);
            // Cap at 100% to avoid displaying unreasonable values
            priceImpact = Math.min(100, priceImpact);
          } else {
            priceImpact = 0;
          }
        } else {
          priceImpact = 0;
        }

        // Show warning for high price impact (>2%)
        showPriceImpactWarning = priceImpact > 2;

        updateExchangeRate();
        
        // Dispatch event using new pattern
        const event = new CustomEvent('quoteUpdate', {
          detail: { receiveAmount }
        });
        dispatchEvent(event);

        if (quote.Ok.txs.length > 0) {
          currentRoutingPath = [
            payToken.address,
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
<div class="flex flex-col gap-4 h-full max-h-[80vh] sm:max-h-[85vh]">
  {#if error}
    <Panel variant="transparent" type="secondary">
      <div class="flex items-center justify-center gap-3 p-4 sm:p-3">
        <div class="w-8 h-8 rounded-full bg-kong-error/10 text-kong-error flex items-center justify-center text-xl font-bold">!</div>
        <p class="text-kong-error text-sm flex-1 sm:text-base">{error}</p>
      </div>
    </Panel>
  {:else if payToken && receiveToken}
    <div class="flex-1 overflow-y-auto pr-2 sm:pr-0.5 scrollbar-custom">
      <div class="flex flex-col w-full rounded-xl transition-all duration-300" transition:fade={{ duration: 200 }}>
        <div class="flex flex-col gap-y-4 sm:gap-y-3 pb-1">
          <!-- Main swap information card -->
          <PayReceiveSection
            {payToken}
            {payAmount}
            {receiveToken}
            {receiveAmount}
            routingPath={currentRoutingPath}
          />
          
          <!-- Fees and impact information card -->
          <FeesSection
            {gasFees}
            {lpFees}
            {userMaxSlippage}
            {priceImpact}
            {showPriceImpactWarning}
          />
        </div>
      </div>
    </div>
    
    <!-- Action button with improved styling -->
    <div class="w-full sticky bottom-0 bg-kong-bg-primary z-10 pt-3 sm:pt-2">
      <button
        class:processing={isLoading}
        class:warning={showPriceImpactWarning}
        class="swap-confirm-button {$panelRoundness} relative w-full py-3.5 px-4 border cursor-pointer transform transition-all duration-200 overflow-hidden sm:py-3.5 sm:text-base disabled:opacity-70 disabled:cursor-not-allowed"
        on:click={handleConfirm}
        disabled={isLoading}
      >
        <div class="relative z-[1] flex items-center justify-center gap-2">
          <span class="text-lg font-medium text-center sm:text-base" style="text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);">
            {#if isLoading}
              Processing...
            {:else if showPriceImpactWarning}
              Confirm Swap (High Impact)
            {:else}
              Confirm Swap
            {/if}
          </span>
          {#if isLoading}
            <div class="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin sm:w-4 sm:h-4"></div>
          {/if}
        </div>
        
        {#if !isLoading}
          <div class="button-glow"></div>
          <div class="button-shine"></div>
        {/if}
      </button>
      
      {#if showPriceImpactWarning}
        <div class="text-xs text-center mt-2 text-kong-warning sm:text-sm sm:mt-1.5">
          Warning: Price impact is high. Your trade may execute at an unfavorable rate.
        </div>
      {/if}
    </div>
  {/if}
</div>
</Modal>

<style lang="postcss">
  :global(.panel) {
    @apply relative rounded-xl shadow-md transition-all duration-200 w-full;
  }

  /* Base Swap Button Styles */
  .swap-confirm-button {
    border: 1px solid rgba(var(--primary), 0.3);
    color: var(--swap-button-text-color, white);
    background: linear-gradient(135deg, 
      var(--swap-button-primary-gradient-start, rgba(var(--primary), 0.9)) 0%, 
      var(--swap-button-primary-gradient-end, rgba(var(--primary), 0.7)) 100%);
    box-shadow: var(--swap-button-shadow, 0 4px 12px rgba(var(--primary), 0.15), 0 1px 2px rgba(0, 0, 0, 0.1));
  }

  .swap-confirm-button:hover {
    background: linear-gradient(135deg, 
      var(--swap-button-primary-gradient-start, rgba(var(--primary), 1)) 0%, 
      var(--swap-button-primary-gradient-end, rgba(var(--primary), 0.8)) 100%);
    border-color: rgba(var(--primary), 0.5);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(var(--primary), 0.2), 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .swap-confirm-button:active {
    transform: translateY(0);
    box-shadow: 0 2px 8px rgba(var(--primary), 0.15), 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .swap-confirm-button.warning {
    border: 1px solid rgba(var(--accent-yellow), 0.5);
    background: linear-gradient(
      135deg,
      var(--swap-button-error-gradient-start, rgba(var(--accent-yellow), 0.9)) 0%,
      var(--swap-button-error-gradient-end, rgba(var(--accent-yellow), 0.7)) 100%
    );
    box-shadow: 0 4px 12px rgba(var(--accent-yellow), 0.15), 0 1px 2px rgba(0, 0, 0, 0.1);
  }
  
  .swap-confirm-button.warning:hover {
    border-color: rgba(var(--accent-yellow), 0.7);
    background: linear-gradient(
      135deg,
      var(--swap-button-error-gradient-start, rgba(var(--accent-yellow), 1)) 0%,
      var(--swap-button-error-gradient-end, rgba(var(--accent-yellow), 0.8)) 100%
    );
    box-shadow: 0 6px 16px rgba(var(--accent-yellow), 0.2), 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .swap-confirm-button.processing {
    border: 1px solid rgba(var(--accent-blue), 0.5);
    background: linear-gradient(
      135deg,
      var(--swap-button-processing-gradient-start, rgba(var(--accent-blue), 0.8)) 0%,
      var(--swap-button-processing-gradient-end, rgba(var(--accent-blue), 0.6)) 100%
    );
    box-shadow: 0 4px 12px rgba(var(--accent-blue), 0.15), 0 1px 2px rgba(0, 0, 0, 0.1);
    animation: pulse 2s infinite cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Button glow effect */
  .button-glow {
    @apply absolute inset-0 opacity-0 transition-opacity duration-300;
    background: radial-gradient(
      circle at var(--x, 50%) var(--y, 50%),
      var(--swap-button-glow-color, rgba(255, 255, 255, 0.3)),
      rgba(255, 255, 255, 0) 70%
    );
  }

  .swap-confirm-button:hover .button-glow {
    @apply opacity-30;
  }
  
  .swap-confirm-button.warning .button-glow {
    background: radial-gradient(
      circle at var(--x, 50%) var(--y, 50%),
      rgba(var(--accent-yellow), 0.3),
      rgba(255, 255, 255, 0) 70%
    );
  }

  /* Button shine effect */
  .button-shine {
    @apply absolute top-0 left-[-100%] w-1/3 h-full pointer-events-none;
    background: linear-gradient(
      90deg,
      transparent,
      var(--swap-button-shine-color, rgba(255, 255, 255, 0.4)),
      transparent
    );
    transform: skewX(-20deg);
  }
  
  .swap-confirm-button:not(.warning):not(.processing) .button-shine {
    animation: shine 3s infinite ease-in-out;
  }

  .swap-confirm-button.warning .button-shine {
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.3),
      transparent
    );
    animation: none;
  }

  .swap-confirm-button.processing .button-shine {
    display: none;
  }

  @keyframes shine {
    0%, 100% {
      left: -100%;
      opacity: 0.7;
    }
    50% {
      left: 200%;
      opacity: 0.3;
    }
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 0.95;
    }
    50% {
      opacity: 0.7;
    }
  }

  /* Add custom scrollbar utility */
  .scrollbar-custom {
    &::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    &::-webkit-scrollbar-track {
      background-color: rgb(var(--bg-dark) / 0.5);
      border-radius: 3px;
    }
    &::-webkit-scrollbar-thumb {
      background-color: rgb(var(--accent-blue) / 0.7);
      border-radius: 3px;
      border: 1px solid rgb(var(--bg-dark) / 0.5);
    }
    &::-webkit-scrollbar-thumb:hover {
      background-color: rgb(var(--accent-blue));
    }
    scrollbar-width: thin;
    scrollbar-color: rgb(var(--accent-blue) / 0.7) rgb(var(--bg-dark) / 0.5);
  }

  /* Mobile-specific improvements */
  @media (max-width: 640px) {
    /* Improve button touch area */
    .swap-confirm-button {
      min-height: 56px;
      -webkit-tap-highlight-color: transparent;
    }

    /* Reduce shadows for better performance */
    :global(.panel) {
      @apply shadow-sm;
    }
  }
</style>
