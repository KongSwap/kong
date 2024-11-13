import { writable, derived } from 'svelte/store';
import { PoolService } from '$lib/services/pools/PoolService';
import { TokenService } from '$lib/services/tokens/TokenService';
import { parseTokenAmount } from '$lib/utils/numberFormatUtils';
import { get } from 'svelte/store';
import debounce from 'lodash-es/debounce';

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
    ]
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

  async function updateBalances(state: AddLiquidityState) {
    if (!state.token0 || !state.token1) return;

    try {
      const balances = await TokenService.fetchBalances([state.token0, state.token1]);
      update(s => ({
        ...s,
        token0Balance: balances[state.token0.canister_id]?.in_tokens.toString() || "0",
        token1Balance: balances[state.token1.canister_id]?.in_tokens.toString() || "0"
      }));
    } catch (err) {
      console.error("Error fetching balances:", err);
    }
  }

  function updateStatusSteps(rawStatuses: string[]) {
    update(s => {
      const newSteps = s.statusSteps.map(step => {
        const matches = {
          'Sending Tokens': ['Token 0 sent', 'Token 1 sent'],
          'Updating LPs': ['Liquidity pool updated', 'User LP token amount updated'],
          'Success': ['Success']
        }[step.label];

        return {
          ...step,
          completed: matches?.every(match => 
            rawStatuses.some(status => status.includes(match))
          ) || false
        };
      });

      return { ...s, statusSteps: newSteps };
    });
  }

  return {
    subscribe,
    setToken: (index: 0 | 1, token: FE.Token) => {
      update(s => {
        const newState = { 
          ...s, 
          [index === 0 ? 'token0' : 'token1']: token,
          error: null 
        };
        updateBalances(newState);
        return newState;
      });
    },
    handleInput: (index: 0 | 1, value: string) => {
      update(s => {
        const newState = { 
          ...s, 
          [index === 0 ? 'amount0' : 'amount1']: value 
        };
        debouncedCalculate(value, index, newState);
        return newState;
      });
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
        await PoolService.pollRequestStatus(requestId);
      } catch (err) {
        update(s => ({
          ...s,
          error: err.message,
          loading: false,
          previewMode: false
        }));
      }
    },
    reset: () => set({
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
      ]
    })
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