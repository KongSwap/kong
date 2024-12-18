import { writable } from "svelte/store";

interface AllowanceState {
  // wallet_id -> allowancedata[]
  allowances: Record<string, FE.AllowanceData[]>; // wallet_id -> canister_ids[]
  isLoading: boolean;
}

function createAllowanceStore() {
  const store = writable<AllowanceState>({
    allowances: {},
    isLoading: false,
  });

  return {
    subscribe: store.subscribe,
    setAllowances: (allowances: Record<string, FE.AllowanceData[]>) => {
      store.update((state) => ({
        ...state,
        allowances,
      }));
    },
    update: store.update,
    setIsLoading: (isLoading: boolean) => {
      store.update((state) => ({
        ...state,
        isLoading,
      }));
    },
    addAllowance: (tokenId: string, allowance: FE.AllowanceData) => {
      store.update((state) => {
        const currentAllowances = state.allowances[tokenId] || [];
        return {
          ...state,
          allowances: {
            ...state.allowances,
            [tokenId]: [...currentAllowances, allowance],
          },
        };
      });
    },
    getAllowance: (tokenId: string, walletAddress: string, spender: string) => {
      let currentValue: AllowanceState;
      store.subscribe((value) => (currentValue = value))();

      const tokenAllowances = currentValue.allowances[tokenId] || [];
      return tokenAllowances.find(
        (a) => a.wallet_address === walletAddress && a.spender === spender,
      );
    },
  };
}

export const allowanceStore = createAllowanceStore();
