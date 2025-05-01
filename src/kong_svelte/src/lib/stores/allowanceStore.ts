import { writable } from "svelte/store";
import { STORAGE_KEYS, createNamespacedStore } from '$lib/config/localForage.config';
import { browser } from '$app/environment';
import { get } from 'svelte/store';
// Import auth directly to avoid circular references since we've moved initialization to an explicit method
import { auth } from '$lib/stores/auth';

interface AllowanceState {
  // wallet_id -> allowancedata[]
  allowances: Record<string, FE.AllowanceData[]>; // wallet_id -> canister_ids[]
  isLoading: boolean;
  initialized: boolean;
}

const initialState: AllowanceState = {
  allowances: {},
  isLoading: false,
  initialized: false
};

// Create a dedicated localForage instance for allowances
const allowanceStorage = createNamespacedStore(STORAGE_KEYS.ALLOWANCES);

function createAllowanceStore() {
  const store = writable<AllowanceState>(initialState);
  let unsubscribe: Function | null = null;

  // Get the current wallet ID
  const getCurrentWalletId = (): string => {
    const wallet = get(auth);
    // Type assertion to handle the unknown type
    return (wallet as any)?.account?.owner || "anonymous";
  };

  // Generate the storage key for the current wallet
  const getStorageKey = (): string => {
    const walletId = getCurrentWalletId();
    return `${STORAGE_KEYS.ALLOWANCES}_${walletId}`;
  };

  // Load the allowances from localForage
  const loadAllowances = async (): Promise<void> => {
    if (!browser) return;
    
    store.update(state => ({ ...state, isLoading: true }));
    
    try {
      const key = getStorageKey();
      const storedAllowances = await allowanceStorage.getItem<Record<string, FE.AllowanceData[]>>(key);
      
      if (storedAllowances) {
        store.update(state => ({
          ...state,
          allowances: storedAllowances,
          isLoading: false
        }));
      } else {
        store.update(state => ({ ...state, isLoading: false }));
      }
    } catch (error) {
      console.error('[AllowanceStore] Error loading allowances:', error);
      store.update(state => ({ ...state, isLoading: false }));
    }
  };

  // Save the current allowances to localForage
  const saveAllowances = async (allowances: Record<string, FE.AllowanceData[]>): Promise<void> => {
    if (!browser) return;
    
    try {
      const key = getStorageKey();
      await allowanceStorage.setItem(key, allowances);
    } catch (error) {
      console.error('[AllowanceStore] Error saving allowances:', error);
    }
  };

  // Initialize the store
  let storeInitialized = false;
  
  const initialize = () => {
    if (!browser || storeInitialized) return;
    
    // Subscribe to auth changes
    unsubscribe = auth.subscribe(() => {
      loadAllowances();
    });
    
    // Mark as initialized
    storeInitialized = true;
  };

  return {
    subscribe: store.subscribe,
    initialize,
    setAllowances: (allowances: Record<string, FE.AllowanceData[]>) => {
      store.update((state) => ({
        ...state,
        allowances,
      }));
      
      // Save to localForage
      saveAllowances(allowances);
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
        const newAllowances = {
          ...state.allowances,
          [tokenId]: [...currentAllowances, allowance],
        };
        
        // Save to localForage
        saveAllowances(newAllowances);
        
        return {
          ...state,
          allowances: newAllowances,
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
    loadAllowances,
    clearAllowances: async () => {
      store.set(initialState);
      if (browser) {
        try {
          const key = getStorageKey();
          await allowanceStorage.removeItem(key);
        } catch (error) {
          console.error('[AllowanceStore] Error clearing allowances:', error);
        }
      }
    },
    destroy: () => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    }
  };
}

export const allowanceStore = createAllowanceStore();
