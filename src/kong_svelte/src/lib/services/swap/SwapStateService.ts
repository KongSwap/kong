import { writable, derived, type Readable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { fromTokenDecimals } from '$lib/services/tokens/tokenStore';
import { tokenStore } from '$lib/services/tokens/tokenStore';
import { getTokenDecimals } from "$lib/services/tokens/tokenStore";
import { SwapService } from './SwapService';
import { get } from 'svelte/store';

export interface SwapState {
  payToken: FE.Token | null;
  receiveToken: FE.Token | null;
  payAmount: string;
  receiveAmount: string;
  isCalculating: boolean;
  isProcessing: boolean;
  error: string | null;
  showPayTokenSelector: boolean;
  showReceiveTokenSelector: boolean;
  showConfirmation: boolean;
  showSuccessModal: boolean;
  showBananaRain: boolean;
  gasFees: string[];
  lpFees: string[];
  swapSlippage: number;
  routingPath: string[];
  manuallySelectedTokens: {
    pay: boolean;
    receive: boolean;
  };
  successDetails: {
    payAmount: string;
    payToken: FE.Token | null;
    receiveAmount: string;
    receiveToken: FE.Token | null;
  };
}

export interface SwapStore extends Writable<SwapState> {
  isInputExceedingBalance: Readable<boolean>;
  initializeTokens(initialFromToken: FE.Token | null, initialToToken: FE.Token | null): void;
  setPayAmount(amount: string): void;
  setReceiveAmount(amount: string): void;
  setIsProcessing(isProcessing: boolean): void;
  setShowConfirmation(show: boolean): void;
  setShowSuccessModal(show: boolean): void;
  updateSuccessDetails(details: SwapState['successDetails']): void;
  reset(): void;
}

function createSwapStore(): SwapStore {
  const initialState: SwapState = {
    payToken: null,
    receiveToken: null,
    payAmount: '',
    receiveAmount: '',
    isCalculating: false,
    isProcessing: false,
    error: null,
    showPayTokenSelector: false,
    showReceiveTokenSelector: false,
    showConfirmation: false,
    showSuccessModal: false,
    showBananaRain: false,
    gasFees: [],
    lpFees: [],
    swapSlippage: 0,
    routingPath: [],
    manuallySelectedTokens: {
      pay: false,
      receive: false
    },
    successDetails: {
      payAmount: '',
      payToken: null,
      receiveAmount: '',
      receiveToken: null
    }
  };

  const { subscribe, set, update } = writable<SwapState>(initialState);

  const isInputExceedingBalance = derived(
    [tokenStore, { subscribe }],
    ([$tokenStore, $swapState]) => {
      if (!$swapState.payToken || !$swapState.payAmount) return false;
      
      const balance = $tokenStore.balances[$swapState.payToken.canister_id]?.in_tokens || BigInt(0);
      return fromTokenDecimals($swapState.payAmount, $swapState.payToken.decimals).toNumber() > Number(balance);
    }
  );

  const store: SwapStore = {
    subscribe,
    set,
    update,
    isInputExceedingBalance,

    initializeTokens(initialFromToken: FE.Token | null, initialToToken: FE.Token | null) {
      const $tokenStore = get(tokenStore);
      update(state => ({
        ...state,
        payToken: initialFromToken || $tokenStore.tokens.find(t => t.symbol === 'ICP') || null,
        receiveToken: initialToToken || $tokenStore.tokens.find(t => t.symbol === 'ckBTC') || null
      }));
    },

    async setPayAmount(amount: string) {
      update(state => ({ 
        ...state, 
        payAmount: amount,
        isCalculating: true,
        error: null
      }));

      const currentState = get({ subscribe });
      if (!currentState.payToken || !currentState.receiveToken || !amount || isNaN(Number(amount))) {
        update(state => ({
          ...state,
          receiveAmount: '',
          isCalculating: false,
          error: null
        }));
        return;
      }

      try {
        const quote = await SwapService.getSwapQuote(
          currentState.payToken,
          currentState.receiveToken,
          amount
        );

        update(state => ({
          ...state,
          receiveAmount: quote.receiveAmount,
          swapSlippage: quote.slippage,
          isCalculating: false,
          error: null
        }));
      } catch (error) {
        update(state => ({
          ...state,
          receiveAmount: '',
          error: error instanceof Error ? error.message : 'Failed to calculate swap',
          isCalculating: false
        }));
      }
    },

    setReceiveAmount(amount: string) {
      // No-op since receive panel input is disabled
      return;
    },

    setIsProcessing(isProcessing: boolean) {
      update(state => ({ ...state, isProcessing }));
    },

    setShowConfirmation(show: boolean) {
      update(state => ({ ...state, showConfirmation: show }));
    },

    setShowSuccessModal(show: boolean) {
      update(state => ({ ...state, showSuccessModal: show }));
    },

    updateSuccessDetails(details: SwapState['successDetails']) {
      update(state => ({
        ...state,
        successDetails: details
      }));
    },

    reset() {
      set(initialState);
    }
  };

  return store;
}

export const swapState = createSwapStore();
