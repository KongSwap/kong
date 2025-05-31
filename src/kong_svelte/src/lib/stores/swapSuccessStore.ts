import { writable } from 'svelte/store';
import type { AnyToken } from '$lib/utils/tokenUtils';

interface SwapSuccessState {
  show: boolean;
  payAmount: string;
  payToken: AnyToken | null;
  receiveAmount: string;
  receiveToken: AnyToken | null;
  solanaTransactionHash: string | null;
}

function createSwapSuccessStore() {
  const { subscribe, set, update } = writable<SwapSuccessState>({
    show: false,
    payAmount: '0',
    payToken: null,
    receiveAmount: '0', 
    receiveToken: null,
    solanaTransactionHash: null
  });

  return {
    subscribe,
    showSuccess: (
      payAmount: string,
      payToken: AnyToken,
      receiveAmount: string,
      receiveToken: AnyToken,
      solanaTransactionHash?: string | null
    ) => {
      set({
        show: true,
        payAmount,
        payToken,
        receiveAmount,
        receiveToken,
        solanaTransactionHash: solanaTransactionHash || null
      });
    },
    hide: () => {
      update(state => ({ ...state, show: false }));
    },
    reset: () => {
      set({
        show: false,
        payAmount: '0',
        payToken: null,
        receiveAmount: '0',
        receiveToken: null,
        solanaTransactionHash: null
      });
    }
  };
}

export const swapSuccessStore = createSwapSuccessStore();