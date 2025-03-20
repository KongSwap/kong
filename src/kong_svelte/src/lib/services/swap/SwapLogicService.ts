import { swapState } from "./SwapStateService";
import { get } from "svelte/store";
import { toastStore } from "$lib/stores/toastStore";
import { SwapService } from "./SwapService";
import { swapStatusStore } from "./swapStore";
import { SwapMonitor } from "./SwapMonitor";
import type { Principal } from "@dfinity/principal";
import { userTokens } from "$lib/stores/userTokens";

export class SwapLogicService {
  static async handleSwapSuccess(event: CustomEvent) {
    const tokens = get(userTokens).tokens;
    if (!tokens?.length) {
      console.warn('TokenStore not initialized or empty');
      return;
    }

    const payToken = tokens.find((t: any) => t.symbol === event.detail.payToken);
    const receiveToken = tokens.find((t: any) => t.symbol === event.detail.receiveToken);

    if (!payToken || !receiveToken) {
      console.error('Could not find pay or receive token', {
        paySymbol: event.detail.payToken,
        receiveSymbol: event.detail.receiveToken,
        availableTokens: tokens.map(t => t.symbol)
      });
      return;
    }

    // Reset the swap state
    swapState.update((state) => ({
      ...state,
      payAmount: "",
      receiveAmount: "",
      error: null,
      isProcessing: false,
    }));
  }

  static handleSelectToken(type: "pay" | "receive", token: FE.Token) {
    const state = get(swapState);
    
    if (
      (type === "pay" && token?.canister_id === state.receiveToken?.canister_id) ||
      (type === "receive" && token?.canister_id === state.payToken?.canister_id)
    ) {
      toastStore.error("Cannot select the same token for both sides");
      return;
    }

    const updates: Partial<typeof state> = {
      manuallySelectedTokens: {
        ...state.manuallySelectedTokens,
        [type]: true
      }
    };

    if (type === "pay") {
      updates.payToken = token;
      updates.showPayTokenSelector = false;
    } else {
      updates.receiveToken = token;
      updates.showReceiveTokenSelector = false;
    }

    swapState.update(state => ({ ...state, ...updates }));
  }

  static async executeSwap(params: {
    payToken: FE.Token;
    payAmount: string;
    receiveToken: FE.Token;
    receiveAmount: string;
    userMaxSlippage: number;
    backendPrincipal: Principal;
    lpFees: string[];
  }): Promise<boolean> {
    swapState.update(state => ({ ...state, isProcessing: true }));

    try {
      // Create the swap in the store first
      const swapId = swapStatusStore.addSwap({
        payToken: params.payToken,
        receiveToken: params.receiveToken,
        lastPayAmount: params.payAmount,
        expectedReceiveAmount: params.receiveAmount,
        fees: {
          gas: "0",
          lp: params.lpFees[0] || "0"
        }
      });

      const result = await SwapService.executeSwap({
        ...params,
        swapId
      });
      
      if (result !== false) {
        swapStatusStore.updateSwap(swapId, {
          status: 'pending',
          isProcessing: true,
          error: null
        });
        const toastId = toastStore.info(
          `Swapping ${params.payAmount} ${params.payToken.symbol} to ${params.receiveAmount} ${params.receiveToken.symbol}...`,
          { duration: undefined }
        );
        SwapMonitor.monitorTransaction(result, swapId, toastId);
        return true;
      } else {
        toastStore.error('Swap failed');
        swapState.update(state => ({ ...state, isProcessing: false }));
        return false;
      }
    } catch (error) {
      console.error('Swap execution error:', error);
      toastStore.error('Failed to execute swap');
      swapState.update(state => ({ ...state, isProcessing: false }));
      return false;
    }
  }
}
