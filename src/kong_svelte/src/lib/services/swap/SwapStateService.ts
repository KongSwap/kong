import { writable, derived, type Readable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { fromTokenDecimals } from '$lib/stores/tokenStore';
import { SwapService } from './SwapService';
import { get } from 'svelte/store';
import { KONG_LEDGER_CANISTER_ID, CKUSDT_CANISTER_ID, ICP_CANISTER_ID } from '$lib/constants/canisterConstants';
import { BigNumber } from 'bignumber.js';
import { livePools } from '$lib/stores/poolStore';
import { fetchTokensByCanisterId } from '$lib/api/tokens';
import type { SolanaTokenInfo } from '$lib/config/solana.config'; // Import SolanaTokenInfo
import { CrossChainSwapService } from './CrossChainSwapService';
import type { AnyToken } from '$lib/utils/tokenUtils';

/**
 * Calculate swap amounts for cross-chain tokens using CrossChainSwapService
 */
async function calculateCrossChainSwapAmount(
  payToken: AnyToken | null,
  receiveToken: AnyToken | null,
  payAmount: string
): Promise<string> {
  if (!payToken || !receiveToken || !payAmount || isNaN(Number(payAmount))) {
    return '0';
  }

  // If same token, return same amount
  if (payToken.symbol === receiveToken.symbol) {
    return payAmount;
  }

  try {
    // Convert to bigint with proper decimals
    const payAmountBigInt = BigInt(
      Math.floor(Number(payAmount) * Math.pow(10, payToken.decimals))
    );

    // Get quote from CrossChainSwapService
    const quote = await CrossChainSwapService.getQuote(
      payToken,
      payAmountBigInt,
      receiveToken
    );

    // Convert back to string for display
    const receiveAmount = Number(quote.receiveAmount) / Math.pow(10, receiveToken.decimals);
    return receiveAmount.toFixed(6); // 6 decimal places for display
  } catch (error) {
    console.error('Error calculating cross-chain swap amount:', error);
    return '0';
  }
}

export interface SwapState {
  payToken: AnyToken | null; // Change to AnyToken
  receiveToken: AnyToken | null; // Change to AnyToken
  payAmount: string;
  receiveAmount: string;
  isCalculating: boolean;
  isProcessing: boolean;
  processingMessage?: string; // Add processing message for status updates
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
    payToken: AnyToken | null;
    receiveAmount: string;
    receiveToken: AnyToken | null;
    principalId: string;
    transactionSignature: string | null; // Add transaction signature
    cluster: string | null; // Add cluster (devnet/mainnet)
  } | null;
}

export interface SwapStore extends Writable<SwapState> {
  isInputExceedingBalance: Readable<boolean>;
  initializeTokens(initialFromToken: AnyToken | null, initialToToken: AnyToken | null): Promise<void>; // Change to AnyToken
  setPayAmount(amount: string): void;
  setReceiveAmount(amount: string): void;
  setPayToken(token: AnyToken | null): void; // Change to AnyToken
  setReceiveToken(token: AnyToken | null): void; // Change to AnyToken
  setIsProcessing(isProcessing: boolean): void;
  setShowConfirmation(show: boolean): void;
  setShowSuccessModal(show: boolean): void;
  setError(error: string | null): void;
  updateSuccessDetails(details: SwapState['successDetails']): void;
  reset(): void;
  toggleTokenSelector(type: 'pay' | 'receive'): void;
  closeTokenSelector(): void;
  setToken(type: 'pay' | 'receive', token: AnyToken | null): void; // Change to AnyToken
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
      let balance = BigInt(0);
      if ($swapState.payToken && 'address' in $swapState.payToken) {
        // Access the in_tokens property of TokenBalance
        balance = $balances[$swapState.payToken.address]?.in_tokens ?? BigInt(0);
      }
      
      const payAmountBN = new BigNumber($swapState.payAmount || '0');
      const payAmountInTokens = fromTokenDecimals(payAmountBN, $swapState.payToken?.decimals || 8); // Use optional chaining for decimals
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
      
      // Filter out Solana tokens for fetchTokensByCanisterId as it only handles ICP
      const icpTokenIds = tokenIds.filter(id => id !== undefined && !id.startsWith('So111') && !id.startsWith('6p6xg') && !id.startsWith('EPjFW'));
      const fetchedTokens = await fetchTokensByCanisterId(icpTokenIds as string[]); // Renamed to fetchedTokens
      
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
      if (fetchedTokens.length > 0) {
        const defaultPayToken = fetchedTokens.find(t => t.address === ICP_CANISTER_ID);
        const defaultReceiveToken = fetchedTokens.find(t => t.address === KONG_LEDGER_CANISTER_ID);

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

        // Type guard to ensure we have Kong.Token types (not SolanaTokenInfo)
        const isKongToken = (token: AnyToken | null): token is Kong.Token => {
          return token !== null && 'address' in token && 'fee' in token && 'fee_fixed' in token;
        };

        const isSolanaToken = (token: AnyToken | null): token is SolanaTokenInfo => {
          return token !== null && 'mint_address' in token;
        };

        // Check if we have Solana tokens involved
        const payIsSolana = isSolanaToken(currentState.payToken);
        const receiveIsSolana = isSolanaToken(currentState.receiveToken);

        if (payIsSolana || receiveIsSolana) {
          // Cross-chain swap logic
          try {
            const receiveAmount = await calculateCrossChainSwapAmount(
              currentState.payToken,
              currentState.receiveToken,
              amount
            );

            update(state => ({
              ...state,
              receiveAmount,
              swapSlippage: 0.5, // 0.5% slippage for cross-chain swaps
              isCalculating: false,
              error: null
            }));
          } catch (error) {
            update(state => ({
              ...state,
              receiveAmount: '',
              error: error instanceof Error ? error.message : 'Failed to calculate cross-chain swap',
              isCalculating: false
            }));
          }
          return;
        }

        // Original ICP token logic
        if (!isKongToken(currentState.payToken) || !isKongToken(currentState.receiveToken)) {
          throw new Error('Invalid token types');
        }

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

    setTransactionSignature(signature: string, cluster: string) {
      update(state => {
        if (state.successDetails) {
          return {
            ...state,
            successDetails: {
              ...state.successDetails,
              transactionSignature: signature,
              cluster
            }
          };
        }
        return state;
      });
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
