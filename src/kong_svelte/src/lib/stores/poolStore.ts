import { derived, writable, type Readable } from 'svelte/store';
import { PoolService } from '$lib/services/PoolService';
import { formatPoolData } from '$lib/utils/statsUtils';
import { tokenStore } from '$lib/stores/tokenStore';
import BigNumber from 'bignumber.js';

interface PoolState {
  pools: BE.Pool[];
  userPoolBalances: UserPoolBalance[];
  totals: {
    tvl: number;
    rolling_24h_volume: number;
    fees_24h: number;
  };
  isLoading: boolean;
  error: string | null;
  lastUpdate: number | null;
}

interface UserPoolBalance {
  name: string;
  balance: string;
  amount_0: string;
  amount_1: string;
  symbol_0: string;
  symbol_1: string;
}

function createPoolStore() {
  const { subscribe, set, update } = writable<PoolState>({
    pools: [],
    userPoolBalances: [],
    totals: {
      tvl: 0,
      rolling_24h_volume: 0,
      fees_24h: 0,
    },
    isLoading: false,
    error: null,
    lastUpdate: null,
  });

  return {
    subscribe,
    loadPools: async () => {
      update(state => {
        return { ...state, isLoading: true, error: null };
      });
      
      try {
        const poolsData = await PoolService.fetchPoolsData();        
        if (!poolsData?.pools) {
          throw new Error('Invalid pools data received');
        }

        const formattedPools = formatPoolData(poolsData.pools);
        
        update(state => {
          const newState = {
            ...state,
            pools: formattedPools,
            totals: {
              tvl: Number(poolsData.total_tvl) / 1e6,
              rolling_24h_volume: Number(poolsData.total_24h_volume) / 1e6,
              fees_24h: Number(poolsData.total_24h_lp_fee) / 1e6
            },
            isLoading: false,
            lastUpdate: Date.now()
          };
          return newState;
        });
      } catch (error) {
        console.error('[PoolStore] Error:', error);
        update(state => ({
          ...state,
          error: error.message,
          isLoading: false
        }));
      }
    },

    getPool: async (poolId: string) => {
      try {
        return await PoolService.getPoolDetails(poolId);
      } catch (error) {
        console.error('[PoolStore] Error fetching pool:', error);
        throw error;
      }
    },

    loadUserPoolBalances: async () => {
      update((state) => {
        return { ...state, isLoading: true, error: null };
      });

      try {
        const balances = await PoolService.fetchUserPoolBalances();

        // Get token prices from tokenStore
        const tokenPrices = tokenStore.getTokenPrices();

        // Ensure tokenPrices is defined
        if (!tokenPrices) {
          throw new Error('Token prices are not available');
        }

        // Process balances similar to the old React function
        const updatedPoolBalances = balances
          .map((item) => {
            const key = Object.keys(item)[0];
            const token = item[key];
            const poolPrice =
              tokenPrices[`${token.symbol_0}_${token.symbol_1}`] ||
              tokenPrices[`${token.symbol_1}_${token.symbol_0}`]; // Try both combinations

            // Implement formatPriceRoundedAmount as needed
            const formattedAmount_0 = token.amount_0
            const formattedAmount_1 = token.amount_1;
          

            return {
              name: `${token.symbol_0}/${token.symbol_1}`,
              balance: new BigNumber(token.balance).toFormat(8),
              amount_0: formattedAmount_0,
              amount_1: formattedAmount_1,
              symbol_0: token.symbol_0,
              symbol_1: token.symbol_1,
            };
          })
          .filter(Boolean);

        update((state) => ({
          ...state,
          userPoolBalances: updatedPoolBalances,
          isLoading: false,
          lastUpdate: Date.now(),
        }));
      } catch (error) {
        console.error('[PoolStore] Error loading user pool balances:', error);
        update((state) => ({
          ...state,
          error: error.message,
          isLoading: false,
        }));
      }
    },

    reset: () => {
      set({
        pools: [],
        userPoolBalances: [],
        totals: {
          tvl: 0,
          rolling_24h_volume: 0,
          fees_24h: 0,
        },
        isLoading: false,
        error: null,
        lastUpdate: null,
      });
    }
  };
}

export const poolStore = createPoolStore();

// Derived stores with debug logging
export const poolTotals: Readable<{ tvl: number; rolling_24h_volume: number; fees_24h: number }> = derived(poolStore, ($store, set) => {
  set($store.totals);
});

export const poolsList: Readable<BE.Pool[]> = derived(poolStore, ($store, set) => {
  set($store.pools);
});

export const poolsLoading: Readable<boolean> = derived(poolStore, $store => $store.isLoading);
export const poolsError: Readable<string | null> = derived(poolStore, $store => $store.error);

// Derived store for user pool balances
export const userPoolBalances: Readable<UserPoolBalance[]> = derived(
  poolStore,
  ($store) => $store.userPoolBalances
);
