import { writable, derived } from 'svelte/store';

interface WalletBalances {
  [canisterId: string]: TokenBalance;
}

interface WalletTokenState {
  balances: WalletBalances;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

const initialState: WalletTokenState = {
  balances: {},
  isLoading: false,
  error: null,
  lastUpdated: null,
};

function createWalletTokenStore() {
  const { subscribe, set, update } = writable<WalletTokenState>(initialState);

  return {
    subscribe,
    setBalances: (balances: WalletBalances) => {
      update(state => ({
        ...state,
        balances,
        lastUpdated: Date.now(),
      }));
    },
    setLoading: (isLoading: boolean) => {
      update(state => ({ ...state, isLoading }));
    },
    setError: (error: string | null) => {
      update(state => ({ ...state, error }));
    },
    reset: () => {
      set(initialState);
    },
  };
}

export const walletBalancesStore = createWalletTokenStore();

// Derived store for total portfolio value
export const walletPortfolioValue = derived(
  walletBalancesStore,
  $store => {
    return Object.values($store.balances).reduce((total, balance) => {
      return total + (Number(balance.in_usd) || 0);
    }, 0);
  }
);

// Function to load balances for a specific wallet
export async function loadWalletBalances(principalId: string, options = { forceRefresh: false }) {
  const store = walletBalancesStore;
  
  store.setLoading(true);
  store.setError(null);
  
  try {
    
    const balances = await fetchWalletBalances(principalId);
    store.setBalances(balances);
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Failed to load wallet balances');
    throw error;
  } finally {
    store.setLoading(false);
  }
}

// Helper function to fetch wallet balances - implement this based on your API
async function fetchWalletBalances(principalId: string): Promise<WalletBalances> {
  // TODO: Implement the actual API call
  throw new Error('Not implemented');
} 