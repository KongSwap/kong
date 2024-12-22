import { writable, derived } from 'svelte/store';
import { PoolService } from '$lib/services/pools/PoolService';
import { TokenService } from '$lib/services/tokens/TokenService';
import { parseTokenAmount } from '$lib/utils/numberFormatUtils';
import { get } from 'svelte/store';
import debounce from 'lodash-es/debounce';
import { auth } from '../auth';
import { toastStore } from '$lib/stores/toastStore';

interface AddLiquidityState {
  token0: FE.Token | null;
  token1: FE.Token | null;
  amount0: string;
  amount1: string;
  loading: boolean;
  error: string | null;
  poolShare: string;
  token0Balance: string;
  token1Balance: string;
  isProcessingOutput: boolean;
  showReview: boolean;
  previewMode: boolean;
  statusSteps: Array<{ label: string; completed: boolean; }>;
  showToken0Selector: boolean;
  showToken1Selector: boolean;
  tokenSelectorPosition: { x: number; y: number } | null;
}

function createAddLiquidityStore() {
  const { subscribe, set, update } = writable<AddLiquidityState>({
    token0: null,
    token1: null,
    amount0: "",
    amount1: "",
    loading: false,
    error: null,
    poolShare: "0",
    token0Balance: "0",
    token1Balance: "0",
    isProcessingOutput: false,
    showReview: false,
    previewMode: false,
    statusSteps: [
      { label: 'Sending Tokens', completed: false },
      { label: 'Updating LPs', completed: false },
      { label: 'Success', completed: false }
    ],
    showToken0Selector: false,
    showToken1Selector: false,
    tokenSelectorPosition: null
  });

  const debouncedCalculate = debounce(async (amount: string, index: 0 | 1, state: AddLiquidityState) => {
    if (!amount || isNaN(parseFloat(amount))) {
      update(s => ({ ...s, [index === 0 ? 'amount1' : 'amount0']: "" }));
      return;
    }
    await calculateLiquidityAmount(amount, index, state);
  }, 300);

  async function calculateLiquidityAmount(amount: string, index: 0 | 1, state: AddLiquidityState) {
    if (!state.token0 || !state.token1) {
      update(s => ({ ...s, error: "Please select both tokens." }));
      return;
    }

    try {
      update(s => ({ ...s, loading: true, error: null }));
      const requiredAmount = await PoolService.addLiquidityAmounts(
        state.token0.token,
        parseTokenAmount(amount, state.token0.decimals),
        state.token1.token
      );

      update(s => ({
        ...s,
        [index === 0 ? 'amount1' : 'amount0']: requiredAmount.Ok[index === 0 ? 'amount_1' : 'amount_0'],
        loading: false
      }));
    } catch (err) {
      update(s => ({ ...s, error: err.message, loading: false }));
    }
  }

  return {
    subscribe,
    setToken: (index: 0 | 1, token: FE.Token) => {
      update(s => ({ ...s, [`token${index}`]: token }));
    },
    setAmount: (index: 0 | 1, amount: string) => {
      update(s => ({ ...s, [`amount${index}`]: amount }));
    },
    toggleTokenSelector: (index: 0 | 1, position: { x: number; y: number } | null = null) => {
      update(s => ({
        ...s,
        [`showToken${index}Selector`]: !s[`showToken${index}Selector`],
        tokenSelectorPosition: position
      }));
    },
    closeTokenSelector: () => {
      update(s => ({
        ...s,
        showToken0Selector: false,
        showToken1Selector: false,
        tokenSelectorPosition: null
      }));
    },
    startReview: () => update(s => ({ ...s, showReview: true })),
    cancelReview: () => update(s => ({ ...s, showReview: false })),
    confirmAndSubmit: async () => {
      update(s => ({ 
        ...s, 
        showReview: false,
        loading: true,
        error: null,
        previewMode: true,
        statusSteps: s.statusSteps.map(step => ({ ...step, completed: false }))
      }));

      try {
        const state = get({ subscribe });
        const params = {
          token_0: state.token0,
          amount_0: parseTokenAmount(state.amount0, state.token0.decimals),
          token_1: state.token1,
          amount_1: parseTokenAmount(state.amount1, state.token1.decimals),
        };

        const requestId = await PoolService.addLiquidity(params);
        const requestStatus = await PoolService.pollRequestStatus(requestId);
        
        if (requestStatus.statuses.includes('Success')) {
          update(s => ({
            ...s,
            loading: false,
            previewMode: false,
            showReview: false
          }));
          toastStore.success("Successfully added liquidity to the pool", 5000, "Success");
        } else {
          throw new Error('Transaction failed');
        }
      } catch (err) {
        update(s => ({
          ...s,
          error: err.message,
          loading: false,
          previewMode: false,
          showReview: false
        }));
      }
    },
    reset: () => {
      set({
        token0: null,
        token1: null,
        amount0: "",
        amount1: "",
        loading: false,
        error: null,
        poolShare: "0",
        token0Balance: "0",
        token1Balance: "0",
        isProcessingOutput: false,
        showReview: false,
        previewMode: false,
        statusSteps: [
          { label: 'Sending Tokens', completed: false },
          { label: 'Updating LPs', completed: false },
          { label: 'Success', completed: false }
        ],
        showToken0Selector: false,
        showToken1Selector: false,
        tokenSelectorPosition: null
      });
    }
  };
}

export const addLiquidityStore = createAddLiquidityStore();

// Derived stores for convenience
export const tokens = derived(addLiquidityStore, $store => ({
  token0: $store.token0,
  token1: $store.token1
}));

export const amounts = derived(addLiquidityStore, $store => ({
  amount0: $store.amount0,
  amount1: $store.amount1
}));

export const status = derived(addLiquidityStore, $store => ({
  loading: $store.loading,
  error: $store.error,
  showReview: $store.showReview,
  previewMode: $store.previewMode
}));