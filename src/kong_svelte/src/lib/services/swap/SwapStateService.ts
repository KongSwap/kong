import { writable, derived, type Readable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { fromTokenDecimals } from '$lib/stores/tokenStore';
import { SwapService } from './SwapService';
import { get } from 'svelte/store';
import { KONG_LEDGER_CANISTER_ID, CKUSDT_CANISTER_ID, ICP_CANISTER_ID } from '$lib/constants/canisterConstants';
import { BigNumber } from 'bignumber.js';
import { livePools } from '$lib/stores/poolStore';
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
    payToken: Kong.Token | null;
    receiveAmount: string;
    receiveToken: Kong.Token | null;
    principalId: string;
  } | null;
}

export interface SwapStore extends Writable<SwapState> {
  isInputExceedingBalance: Readable<boolean>;
  initializeTokens(initialFromToken: Kong.Token | null, initialToToken: Kong.Token | null): Promise<void>;
  setPayAmount(amount: string): void;
  setReceiveAmount(amount: string): void;
  setPayToken(token: Kong.Token | null): void;
  setReceiveToken(token: Kong.Token | null): void;
  setIsProcessing(isProcessing: boolean): void;
  setShowConfirmation(show: boolean): void;
  setShowSuccessModal(show: boolean): void;
  setError(error: string | null): void;
  updateSuccessDetails(details: SwapState['successDetails']): void;
  reset(): void;
  toggleTokenSelector(type: 'pay' | 'receive'): void;
  closeTokenSelector(): void;
  setToken(type: 'pay' | 'receive', token: Kong.Token | null): void;
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

  // Create a store for the swap state
  const swapStore = { subscribe };

  // Create a local balances store to avoid import issues
  const localBalancesStore = writable<Record<string, TokenBalance>>({});
  
  // Create a derived store using the local balances store
  const isInputExceedingBalance = derived(
    [localBalancesStore, swapStore],
    ([$balances, $swapState]) => {
      // Check if necessary values are present
      if (!$balances || !$swapState?.payToken || !$swapState?.payAmount) {
        return false;
      }
      
      // Safely access properties with optional chaining
      const balance = $balances[$swapState.payToken.address] ?? BigInt(0);
      const payAmountBN = new BigNumber($swapState.payAmount || '0');
      const payAmountInTokens = fromTokenDecimals(payAmountBN, $swapState.payToken.decimals);
      return Number(payAmountInTokens) > Number(balance);
    }
  );

  const store: SwapStore = {
    subscribe,
    set,
    update,
    isInputExceedingBalance,

    async initializeTokens(initialFromToken: Kong.Token | null, initialToToken: Kong.Token | null) {
      // If no initial tokens are provided, use defaults: ICP and CKUSDT
      const tokenIds = (initialFromToken || initialToToken) ? [initialFromToken?.address, initialToToken?.address] : [ICP_CANISTER_ID, KONG_LEDGER_CANISTER_ID];
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
        const pools = get(livePools);
        const hasValidPool = pools.some(pool => 
          (pool.symbol_0 === currentState.payToken?.symbol && pool.symbol_1 === currentState.receiveToken?.symbol) ||
          (pool.symbol_0 === currentState.receiveToken?.symbol && pool.symbol_1 === currentState.payToken?.symbol)
        );

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
      update(state => ({
        ...state,
        receiveAmount: amount,
        isCalculating: true,
        error: null
      }));
    },

    setPayToken(token: Kong.Token | null) {
      update(state => ({ ...state, payToken: token }));
    },

    setReceiveToken(token: Kong.Token | null) {
      update(state => ({ ...state, receiveToken: token }));
    },

    setIsProcessing(isProcessing: boolean) {
      update(state => ({ ...state, isProcessing }));
    },

    setShowConfirmation(show: boolean) {
      update(state => ({ ...state, showConfirmation: show }));
    },

    setShowSuccessModal(show: boolean) {
      update(state => {
        const newState = { ...state, showSuccessModal: show };
        return newState;
      });
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

    setToken(type: 'pay' | 'receive', token: Kong.Token | null) {
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
