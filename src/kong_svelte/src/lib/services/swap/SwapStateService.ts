import { writable, derived, type Readable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { fromTokenDecimals } from '$lib/services/tokens/tokenStore';
import { tokenStore } from '$lib/services/tokens/tokenStore';
import { getTokenDecimals } from "$lib/services/tokens/tokenStore";
import { SwapService } from './SwapService';
import { get } from 'svelte/store';
import { KONG_CANISTER_ID, ICP_CANISTER_ID } from '$lib/constants/canisterConstants';

export interface SwapState {
  payToken: FE.Token | null;
  receiveToken: FE.Token | null;
  payAmount: string;
  receiveAmount: string;
  isCalculating: boolean;
  isProcessing: boolean;
  error: string | null;
  tokenSelectorOpen: 'pay' | 'receive' | null;
  tokenSelectorPosition: { x: number; y: number; windowWidth: number } | null;
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
    principalId: string;
  } | null;
}

export interface SwapStore extends Writable<SwapState> {
  isInputExceedingBalance: Readable<boolean>;
  initializeTokens(initialFromToken: FE.Token | null, initialToToken: FE.Token | null): void;
  setPayAmount(amount: string): void;
  setReceiveAmount(amount: string): void;
  setPayToken(token: FE.Token | null): void;
  setReceiveToken(token: FE.Token | null): void;
  setIsProcessing(isProcessing: boolean): void;
  setShowConfirmation(show: boolean): void;
  setShowSuccessModal(show: boolean): void;
  setError(error: string | null): void;
  updateSuccessDetails(details: SwapState['successDetails']): void;
  reset(): void;
  toggleTokenSelector(type: 'pay' | 'receive'): void;
  closeTokenSelector(): void;
  setToken(type: 'pay' | 'receive', token: FE.Token | null): void;
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
    tokenSelectorOpen: null,
    tokenSelectorPosition: null,
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
    successDetails: null
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
      const tokens = get(tokenStore);
      
      // If we have initial tokens, use them directly
      if (initialFromToken && initialToToken) {
        update(state => ({
          ...state,
          payToken: initialFromToken,
          receiveToken: initialToToken,
          manuallySelectedTokens: {
            pay: true,
            receive: true
          }
        }));
        return;
      }

      // If we have tokens loaded, set defaults
      if (tokens.tokens.length > 0) {
        const defaultPayToken = tokens.tokens.find(t => t.canister_id === ICP_CANISTER_ID);
        const defaultReceiveToken = tokens.tokens.find(t => t.canister_id === KONG_CANISTER_ID);

        update(state => ({
          ...state,
          payToken: initialFromToken || defaultPayToken || null,
          receiveToken: initialToToken || defaultReceiveToken || null,
          manuallySelectedTokens: {
            pay: !!initialFromToken,
            receive: !!initialToToken
          }
        }));
      }
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

    setPayToken(token: FE.Token | null) {
      update(state => ({ ...state, payToken: token }));
    },

    setReceiveToken(token: FE.Token | null) {
      update(state => ({ ...state, receiveToken: token }));
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

    setError(error: string | null) {
      update(state => ({ ...state, error }));
    },

    updateSuccessDetails(details: SwapState['successDetails']) {
      update(state => ({
        ...state,
        successDetails: details
      }));
    },

    reset() {
      set(initialState);
    },

    toggleTokenSelector(type: 'pay' | 'receive') {
      update(state => ({
        ...state,
        tokenSelectorOpen: state.tokenSelectorOpen === type ? null : type
      }));
    },

    closeTokenSelector() {
      update(state => ({
        ...state,
        tokenSelectorOpen: null
      }));
    },

    setToken(type: 'pay' | 'receive', token: FE.Token | null) {
      if (type === 'pay') {
        update(state => ({ ...state, payToken: token }));
      } else {
        update(state => ({ ...state, receiveToken: token }));
      }
    },
  };

  return store;
}

export const swapState = createSwapStore();
