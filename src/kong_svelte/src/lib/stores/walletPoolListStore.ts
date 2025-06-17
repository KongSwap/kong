import { writable, get } from 'svelte/store';
import { fetchTokensByCanisterId } from "$lib/api/tokens";
import { auth, swapActor } from "$lib/stores/auth";
import { canisters, type CanisterType } from "$lib/config/auth.config";
import { UserPool, type UserPoolData } from '$lib/models/UserPool';
import { fetchPools } from '$lib/api/pools';

interface PoolListState {
  processedPools: ProcessedPool[];
  loading: boolean;
  error: string | null;
  walletId: string | null;
  lastUpdated: number | null;
}

type ProcessedPool = UserPoolData;

const initialState: PoolListState = {
  processedPools: [],
  loading: false,
  error: null,
  walletId: null,
  lastUpdated: null
};

// Track pool loading to prevent concurrent requests
let poolLoadingInProgress = false;
let lastLoadedWalletId: string | null = null;
let poolLoadingPromise: Promise<void> | null = null;
let lastFetchTime = 0;
const DEBOUNCE_TIME = 2000; // 2 seconds

function createWalletPoolListStore() {
  const { subscribe, update, set } = writable<PoolListState>(initialState);
  
  return {
    subscribe,
    
    reset: () => {
      set(initialState);
      poolLoadingInProgress = false;
      lastLoadedWalletId = null;
      poolLoadingPromise = null;
      lastFetchTime = 0;
    },

    fetchPoolsForWallet: async (walletId: string): Promise<void> => {
      // Skip if no wallet ID
      if (!walletId || walletId === "anonymous") {
        return Promise.resolve();
      }
      
      // If the wallet ID has changed, reset the store first
      if (lastLoadedWalletId && lastLoadedWalletId !== walletId) {
        set(initialState);
        poolLoadingInProgress = false;
        poolLoadingPromise = null;
      }
      
      // Debounce requests for the same wallet
      const now = Date.now();
      if (lastLoadedWalletId === walletId && now - lastFetchTime < DEBOUNCE_TIME) {
        return poolLoadingPromise || Promise.resolve();
      }
      
      // If loading for this wallet is already in progress, return the existing promise
      if (poolLoadingInProgress && lastLoadedWalletId === walletId && poolLoadingPromise) {
        return poolLoadingPromise;
      }
      
      // Set loading flags
      poolLoadingInProgress = true;
      lastLoadedWalletId = walletId;
      lastFetchTime = now;
      
      // Update store to indicate loading and set the wallet ID
      update(s => ({
        ...s,
        loading: true,
        error: null,
        walletId,
        // Clear processed pools to prevent showing stale data
        processedPools: []
      }));
      
      // Create a promise for this loading operation
      poolLoadingPromise = new Promise<void>(async (resolve) => {
        try {
          const actor = swapActor({anon: true, requiresSigning: false});
          
          const response = await actor.user_balances(walletId);          
          if ('Ok' in response) {
            const rawPools = response.Ok.map(pool => pool.LP);
            
            // First pass: store raw pools
            update(s => ({
              ...s,
              processedPools: []
            }));
            
            await fetchTokensForPools(rawPools, update);
            
            // Final update with success state
            update(s => ({ 
              ...s, 
              loading: false,
              lastUpdated: Date.now()
            }));
          } else if ('Err' in response) {
            console.error("Error from backend:", response.Err);
            update(s => ({ 
              ...s, 
              error: `Backend error: ${JSON.stringify(response.Err)}`,
              loading: false
            }));
          }
        } catch (error) {
          console.error("Failed to load wallet pools:", error);
          update(s => ({ 
            ...s, 
            error: "Failed to load wallet pools",
            loading: false
          }));
        } finally {
          // Reset loading flags
          poolLoadingInProgress = false;
          poolLoadingPromise = null;
          
          resolve();
        }
      });
      
      return poolLoadingPromise;
    },
    
    // Helper method to check if pools are already loaded for a wallet
    hasPoolsForWallet: (walletId: string): boolean => {
      const state = get({ subscribe });
      return state.walletId === walletId && 
             state.processedPools.length > 0 && 
             !state.loading;
    },
    
    // Helper method to check if pools are currently loading for a wallet
    isLoadingForWallet: (walletId: string): boolean => {
      const state = get({ subscribe });
      return state.loading && state.walletId === walletId;
    }
  };
}

async function fetchTokensForPools(pools: any[], update: Function): Promise<void> {
  if (pools.length === 0) return;
  
  const tokenIds = [...new Set(pools.flatMap(pool => 
    [pool.address_0, pool.address_1]
  ))];
  
  try {
    const fetchedTokens = await fetchTokensByCanisterId(tokenIds);
    const tokenMap = fetchedTokens.reduce((acc, token) => {
      acc[token.address] = token;
      return acc;
    }, {} as Record<string, Kong.Token>);
    
    // Fetch all pool data to get current balances and LP supply
    let allPools: BE.Pool[] = [];
    try {
      const poolsResponse = await fetchPools({ limit: 1000 }); // Get all pools
      allPools = poolsResponse.pools;
    } catch (error) {
      console.error("Failed to fetch pool data for calculations:", error);
    }
    
    // Use the model to parse pools with calculations
    const parsedPools = UserPool.parseMultiple(pools, tokenMap, allPools);
    
    update((s: PoolListState) => ({
      ...s,
      processedPools: parsedPools
    }));
  } catch (error) {
    console.error("Failed to load token information:", error);
    update((s: PoolListState) => ({ ...s, error: "Failed to load token information" }));
  }
}

export const walletPoolListStore = createWalletPoolListStore(); 