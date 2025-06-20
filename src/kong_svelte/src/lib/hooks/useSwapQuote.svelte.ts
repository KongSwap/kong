import { get } from 'svelte/store';
import { swapState } from '$lib/stores/swapStateStore';
import { SwapService } from '$lib/services/swap/SwapService';

export function useSwapQuote() {
  let quoteUpdateTimeout: NodeJS.Timeout;
  let reverseQuoteTimeout: NodeJS.Timeout;
  let isQuoteLoading = $state(false);

  async function updateSwapQuote(hasValidPool: boolean) {
    const state = get(swapState);

    if (
      !state.payToken ||
      !state.receiveToken ||
      !hasValidPool ||
      !state.payAmount ||
      state.payAmount === "0"
    ) {
      swapState.update((s) => ({
        ...s,
        receiveAmount: "0",
        swapSlippage: 0,
        gasFees: [],
        lpFees: [],
      }));
      return;
    }

    // Clear any pending timeout
    if (quoteUpdateTimeout) {
      clearTimeout(quoteUpdateTimeout);
    }

    // Set loading state immediately
    isQuoteLoading = true;

    // Debounce the quote update
    quoteUpdateTimeout = setTimeout(async () => {
      try {
        const currentState = get(swapState);

        // Verify the state is still valid before making the API call
        if (
          !currentState.payToken ||
          !currentState.receiveToken ||
          !hasValidPool ||
          !currentState.payAmount ||
          currentState.payAmount === "0"
        ) {
          swapState.update((s) => ({
            ...s,
            receiveAmount: "0",
            swapSlippage: 0,
            gasFees: [],
            lpFees: [],
          }));
          isQuoteLoading = false;
          return;
        }

        const quote = await SwapService.getSwapQuote(
          currentState.payToken,
          currentState.receiveToken,
          currentState.payAmount,
        );

        swapState.updateQuote({
          receiveAmount: quote.receiveAmount,
          slippage: quote.slippage,
          gasFees: quote.gasFees || [],
          lpFees: quote.lpFees || [],
          routingPath: quote.routingPath || [],
        });
      } catch (error) {
        console.error("Error getting quote:", error);
        swapState.update((s) => ({
          ...s,
          receiveAmount: "0",
          swapSlippage: 0,
          gasFees: [],
          lpFees: [],
          error: "Failed to get quote",
        }));
      } finally {
        isQuoteLoading = false;
      }
    }, 600);
  }

  async function updateReverseQuote(hasValidPool: boolean) {
    const state = get(swapState);
    if (
      !state.payToken ||
      !state.receiveToken ||
      !hasValidPool ||
      !state.receiveAmount ||
      state.receiveAmount === "0"
    ) {
      swapState.update((s) => ({
        ...s,
        payAmount: "",
        swapSlippage: 0,
        gasFees: [],
        lpFees: [],
      }));
      return;
    }

    if (reverseQuoteTimeout) clearTimeout(reverseQuoteTimeout);
    isQuoteLoading = true;
    reverseQuoteTimeout = setTimeout(async () => {
      try {
        const currentState = get(swapState);
        const quote = await SwapService.getSwapQuote(
          currentState.receiveToken,
          currentState.payToken,
          currentState.receiveAmount,
        );
        swapState.update((s) => ({
          ...s,
          payAmount: quote.receiveAmount,
          swapSlippage: quote.slippage,
          gasFees: quote.gasFees,
          lpFees: quote.lpFees,
        }));
      } catch (error) {
        console.error("Error getting reverse quote:", error);
        swapState.update((s) => ({
          ...s,
          payAmount: "",
          swapSlippage: 0,
          gasFees: [],
          lpFees: [],
          error: "Failed to get reverse quote",
        }));
      } finally {
        isQuoteLoading = false;
      }
    }, 600);
  }

  function cleanup() {
    if (quoteUpdateTimeout) clearTimeout(quoteUpdateTimeout);
    if (reverseQuoteTimeout) clearTimeout(reverseQuoteTimeout);
  }

  return {
    isQuoteLoading: () => isQuoteLoading,
    updateSwapQuote,
    updateReverseQuote,
    cleanup
  };
} 