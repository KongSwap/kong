// Utility functions for swap operations

import { replaceState } from "$app/navigation";
import type { Settings } from "$lib/types/settings";
import type { SwapState } from "$lib/stores/swapStateStore";

export function getButtonText(params: {
  isCalculating: boolean;
  isValidInput: boolean;
  isProcessing: boolean;
  error: string | null;
  swapSlippage: number;
  userMaxSlippage: number;
  isConnected: boolean;
  payTokenSymbol: string;
  receiveTokenSymbol: string;
}): string {
  const {
    isCalculating,
    isValidInput,
    isProcessing,
    error,
    swapSlippage,
    userMaxSlippage,
    isConnected,
    payTokenSymbol,
    receiveTokenSymbol,
  } = params;

  if (!isConnected) return "Connect Wallet";
  if (isProcessing) return "Processing...";
  if (isCalculating) return "Calculating...";
  if (error) return error;
  if (!payTokenSymbol || !receiveTokenSymbol) return "Select Tokens";
  if (!isValidInput) return "Enter Amount";
  if (swapSlippage > userMaxSlippage) return "Swap Anyway";
  return "Ready to Swap";
}

export function updateURL(params: { from: string; to: string }) {
  const url = new URL(window.location.href);
  url.searchParams.set("from", params.from);
  url.searchParams.set("to", params.to);
  replaceState(url.toString(), {});
}

export function clickOutside(node: HTMLElement, { enabled = true, callback }: { enabled: boolean, callback: () => void }) {
  const handleClick = (event: MouseEvent) => {
    if (!node.contains(event.target as Node)) {
      callback();
    }
  };

  function update({ enabled }: { enabled: boolean }) {
    if (enabled) {
      window.addEventListener('click', handleClick);
    } else {
      window.removeEventListener('click', handleClick);
    }
  }

  update({ enabled });

  return {
    update,
    destroy() {
      window.removeEventListener('click', handleClick);
    }
  };
}

// Swap button utilities (moved from SwapButtonService)
interface AuthState {
  isConnected: boolean;
}

export function getSwapButtonText(
  swapState: SwapState,
  settingsStore: Settings,
  isQuoteLoading: boolean,
  insufficientFunds: boolean,
  auth: AuthState
): string {
  // If user isn't connected, always show connect wallet button
  // This is now handled in the Swap.svelte component itself
  
  if (!swapState.payToken || !swapState.receiveToken) return "Select Tokens";
  if (swapState.isProcessing) return "Processing...";
  if (isQuoteLoading) return "Fetching Quote...";
  if (swapState.error) return swapState.error;
  if (insufficientFunds) return "Insufficient Funds";
  if (swapState.swapSlippage > settingsStore.max_slippage)
    return `High Slippage (${swapState.swapSlippage.toFixed(2)}% > ${settingsStore.max_slippage}%) - Click to Adjust`;
  if (!swapState.payAmount) return "Enter Amount";
  return "SWAP";
}

export function isSwapButtonDisabled(
  swapState: SwapState,
  insufficientFunds: boolean,
  isQuoteLoading: boolean,
  auth: AuthState
): boolean {
  // Allow clicking to connect wallet
  if (!auth.isConnected) return false;
  
  // Disable if processing or loading
  if (swapState.isProcessing || isQuoteLoading) return true;
  
  // Disable if missing required data
  if (!swapState.payToken || !swapState.receiveToken || !swapState.payAmount) return true;
  
  // Disable if there are insufficient funds
  if (insufficientFunds) return true;
  
  return false;
}
