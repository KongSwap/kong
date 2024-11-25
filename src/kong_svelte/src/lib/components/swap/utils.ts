// Utility functions for swap operations

import { replaceState } from "$app/navigation";

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
