import { get } from 'svelte/store';
import { swapState } from './SwapStateService';
import { tokenStore } from '$lib/services/tokens/tokenStore';
import { toastStore } from '$lib/stores/toastStore';
import { updateURL } from '$lib/components/swap/utils';
import type { Principal } from '@dfinity/principal';
import { SwapService } from './SwapService';
import { swapStatusStore } from './swapStore';

export class SwapLogicService {
  static async handleSwapSuccess(event: CustomEvent) {
    const $tokenStore = get(tokenStore);
    
    if (!$tokenStore?.tokens?.length) {
      console.error('TokenStore not initialized or empty');
      return;
    }

    const payToken = $tokenStore.tokens.find((t: any) => t.symbol === event.detail.payToken);
    const receiveToken = $tokenStore.tokens.find((t: any) => t.symbol === event.detail.receiveToken);

    if (!payToken || !receiveToken) {
      console.error('Could not find pay or receive token', {
        paySymbol: event.detail.payToken,
        receiveSymbol: event.detail.receiveToken,
        availableTokens: $tokenStore.tokens.map(t => t.symbol)
      });
      return;
    }

    const updatedSuccessDetails = {
      payAmount: event.detail.payAmount,
      payToken,
      receiveAmount: event.detail.receiveAmount,
      receiveToken
    };

    swapState.updateSuccessDetails(updatedSuccessDetails);
    swapState.setPayAmount('');
    swapState.setShowSuccessModal(true);
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

    const SECONDARY_TOKEN_IDS = [
      'ryjl3-tyaaa-aaaaa-aaaba-cai', // ICP
      'cngnf-vqaaa-aaaar-qag4q-cai'  // ckUSDT
    ];

    const updates: Partial<typeof state> = {
      manuallySelectedTokens: {
        ...state.manuallySelectedTokens,
        [type]: true
      }
    };

    // If selecting a secondary token (ICP/ckUSDT)
    const isSecondaryToken = SECONDARY_TOKEN_IDS.includes(token.canister_id);
    const otherToken = type === "pay" ? state.receiveToken : state.payToken;
    const otherTokenIsSecondary = otherToken && SECONDARY_TOKEN_IDS.includes(otherToken.canister_id);

    if (type === "pay") {
      updates.payToken = token;
      updates.showPayTokenSelector = false;
      if (state.receiveToken) {
        updateURL({ from: token.canister_id, to: state.receiveToken.canister_id });
      }
    } else {
      updates.receiveToken = token;
      updates.showReceiveTokenSelector = false;
      if (state.payToken) {
        updateURL({ from: state.payToken.canister_id, to: token.canister_id });
      }
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
    swapState.setIsProcessing(true);

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
        SwapService.monitorTransaction(result, swapId);
        return true;
      } else {
        toastStore.error('Swap failed');
        swapState.setIsProcessing(false);
        return false;
      }
    } catch (error) {
      console.error('Swap execution error:', error);
      toastStore.error('Failed to execute swap');
      swapState.setIsProcessing(false);
      return false;
    }
  }
}
