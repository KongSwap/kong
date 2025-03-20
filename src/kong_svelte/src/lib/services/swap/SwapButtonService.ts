import type { Settings } from "../../types/settings";
import type { SwapState } from "./SwapStateService";

interface AuthState {
  isConnected: boolean;
}

export class SwapButtonService {
    static getButtonText(
        swapState: SwapState,
        settingsStore: Settings,
        isQuoteLoading: boolean,
        insufficientFunds: boolean,
        auth: AuthState
    ): string {
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

    static isButtonDisabled(
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
} 