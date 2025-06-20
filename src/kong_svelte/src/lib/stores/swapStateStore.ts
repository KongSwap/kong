import { writable, derived, get } from 'svelte/store';
import type { Readable, Writable } from 'svelte/store';
import { BigNumber } from 'bignumber.js';
import { KONG_LEDGER_CANISTER_ID, ICP_CANISTER_ID } from '$lib/constants/canisterConstants';
import { fetchTokensByCanisterId } from '$lib/api/tokens';

export interface SwapState {
  payToken: Kong.Token | null;
  receiveToken: Kong.Token | null;
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
  gasFees: Array<{ amount: string; token: string }>;
  lpFees: Array<{ amount: string; token: string }>;
  swapSlippage: number;
  routingPath: Array<{
    paySymbol: string;
    receiveSymbol: string;
    poolSymbol: string;
    payAmount: string;
    receiveAmount: string;
    price: number;
  }>;
  manuallySelectedTokens: {
    pay: boolean;
    receive: boolean;
  };
  successDetails: {
    payAmount: string;
    payToken: Kong.Token | null;
    receiveAmount: string;
    receiveToken: Kong.Token | null;
    principalId: string;
  } | null;
}

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

function createSwapStateStore() {
  const { subscribe, set, update } = writable<SwapState>(initialState);

  return {
    subscribe,
    update,
    set,
    
    // Initialize tokens
    async initializeTokens(initialFromToken: Kong.Token | null, initialToToken: Kong.Token | null) {
      // If no initial tokens are provided, use defaults: ICP and KONG
      const tokenIds = (initialFromToken || initialToToken) 
        ? [initialFromToken?.address, initialToToken?.address].filter(Boolean) 
        : [ICP_CANISTER_ID, KONG_LEDGER_CANISTER_ID];
      
      const tokens = await fetchTokensByCanisterId(tokenIds);
      
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
      if (tokens.length > 0) {
        const defaultPayToken = tokens.find(t => t.address === ICP_CANISTER_ID);
        const defaultReceiveToken = tokens.find(t => t.address === KONG_LEDGER_CANISTER_ID);

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

    // Set pay amount
    setPayAmount(amount: string) {
      update(state => ({ 
        ...state, 
        payAmount: amount,
        error: null
      }));
    },

    // Set receive amount
    setReceiveAmount(amount: string) {
      update(state => ({
        ...state,
        receiveAmount: amount,
        error: null
      }));
    },

    // Set tokens
    setPayToken(token: Kong.Token | null) {
      update(state => ({ ...state, payToken: token }));
    },

    setReceiveToken(token: Kong.Token | null) {
      update(state => ({ ...state, receiveToken: token }));
    },

    // Set processing state
    setIsProcessing(isProcessing: boolean) {
      update(state => ({ ...state, isProcessing }));
    },

    // Set calculation state
    setIsCalculating(isCalculating: boolean) {
      update(state => ({ ...state, isCalculating }));
    },

    // Show/hide modals
    setShowConfirmation(show: boolean) {
      update(state => ({ ...state, showConfirmation: show }));
    },

    setShowSuccessModal(show: boolean) {
      update(state => ({ ...state, showSuccessModal: show }));
    },

    // Set error
    setError(error: string | null) {
      update(state => ({ ...state, error }));
    },

    // Update success details
    updateSuccessDetails(details: SwapState['successDetails']) {
      update(state => ({
        ...state,
        successDetails: details
      }));
    },

    // Reset store
    reset() {
      set(initialState);
    },

    // Token selector methods
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

    // Set token for specific type
    setToken(type: 'pay' | 'receive', token: Kong.Token | null) {
      if (type === 'pay') {
        update(state => ({ ...state, payToken: token }));
      } else {
        update(state => ({ ...state, receiveToken: token }));
      }
    },
    
    // Update quote-related state
    updateQuote(quote: {
      receiveAmount: string;
      slippage: number;
      gasFees?: Array<{ amount: string; token: string }>;
      lpFees?: Array<{ amount: string; token: string }>;
      routingPath?: Array<{
        paySymbol: string;
        receiveSymbol: string;
        poolSymbol: string;
        payAmount: string;
        receiveAmount: string;
        price: number;
      }>;
    }) {
      update(state => ({
        ...state,
        receiveAmount: quote.receiveAmount,
        swapSlippage: quote.slippage,
        gasFees: quote.gasFees || [],
        lpFees: quote.lpFees || [],
        routingPath: quote.routingPath || [],
        isCalculating: false,
        error: null
      }));
    }
  };
}

export const swapState = createSwapStateStore();