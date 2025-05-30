import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { auth } from '$lib/stores/auth';
import { getSolanaBalances, getUserSolanaAddress, type SolanaBalance } from '$lib/config/solana.config';

// Solana balance store interface
interface SolanaBalanceState {
  balances: Record<string, SolanaBalance>;
  userAddress: string | null;
  isLoading: boolean;
  lastUpdated: number | null;
  error: string | null;
}

// Initial state
const initialState: SolanaBalanceState = {
  balances: {},
  userAddress: null,
  isLoading: false,
  lastUpdated: null,
  error: null
};

// Create the store
function createSolanaBalanceStore() {
  const { subscribe, set, update } = writable<SolanaBalanceState>(initialState);

  return {
    subscribe,
    
    // Get current state
    getState: () => get({ subscribe }),
    
    // Load Solana balances for the current user
    async loadBalances(forceRefresh = false): Promise<void> {
      if (!browser) return;
      
      const currentState = get({ subscribe });
      
      // Don't load if already loading
      if (currentState.isLoading && !forceRefresh) return;
      
      // Check if we need to refresh (5 minutes cache)
      const now = Date.now();
      const cacheExpiry = 5 * 60 * 1000; // 5 minutes
      if (!forceRefresh && currentState.lastUpdated && (now - currentState.lastUpdated) < cacheExpiry) {
        return;
      }
      
      // Also refresh prices when loading balances
      const { CrossChainSwapService } = await import('$lib/services/swap/CrossChainSwapService');
      await CrossChainSwapService.refreshPrices();

      update(state => ({ ...state, isLoading: true, error: null }));

      try {
        // Get user's Solana address
        const userAddress = await getUserSolanaAddress();
        
        if (!userAddress) {
          update(state => ({
            ...state,
            isLoading: false,
            userAddress: null,
            balances: {},
            error: 'No Solana wallet connected'
          }));
          return;
        }

        // Fetch balances
        const balances = await getSolanaBalances(userAddress);
        const balanceMap: Record<string, SolanaBalance> = {};
        
        balances.forEach(balance => {
          balanceMap[balance.mint_address] = balance;
        });

        update(state => ({
          ...state,
          balances: balanceMap,
          userAddress,
          isLoading: false,
          lastUpdated: now,
          error: null
        }));

        console.log('✅ Solana balances loaded:', Object.keys(balanceMap).length, 'tokens');
      } catch (error) {
        console.error('❌ Error loading Solana balances:', error);
        update(state => ({
          ...state,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load Solana balances'
        }));
      }
    },

    // Get balance for a specific mint address
    getBalance(mintAddress: string): SolanaBalance | null {
      const state = get({ subscribe });
      return state.balances[mintAddress] || null;
    },

    // Check if user has Solana wallet connected
    async checkConnection(): Promise<boolean> {
      if (!browser) return false;
      
      try {
        const userAddress = await getUserSolanaAddress();
        update(state => ({ ...state, userAddress }));
        return !!userAddress;
      } catch (error) {
        console.error('Error checking Solana connection:', error);
        return false;
      }
    },

    // Reset store
    reset(): void {
      set(initialState);
    },

    // Auto-load balances when authenticated
    async autoLoad(): Promise<void> {
      const authState = get(auth);
      if (authState.isConnected) {
        const hasConnection = await this.checkConnection();
        if (hasConnection) {
          await this.loadBalances();
        }
      }
    }
  };
}

// Export the store instance
export const solanaBalanceStore = createSolanaBalanceStore();

// Auto-load balances when auth state changes
if (browser) {
  auth.subscribe(async (authState) => {
    if (authState.isConnected) {
      await solanaBalanceStore.autoLoad();
    } else {
      solanaBalanceStore.reset();
    }
  });
} 