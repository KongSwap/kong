import { writable, derived } from 'svelte/store';
import { fetchTokensByCanisterId } from "$lib/api/tokens";
import { createAnonymousActorHelper } from "$lib/utils/actorUtils";
import { KONG_BACKEND_CANISTER_ID } from "$lib/constants/canisterConstants";
import { canisterIDLs } from "$lib/services/auth";

interface PoolListState {
  processedPools: ProcessedPool[];
  loading: boolean;
  error: string | null;
}

interface ProcessedPool {
  id: string;
  symbol_0: string;
  symbol_1: string;
  balance: string;
  usd_balance: string;
  amount_0: string;
  amount_1: string;
  name?: string;
  address_0: string;
  address_1: string;
  token0?: FE.Token;
  token1?: FE.Token;
  rolling_24h_apy?: number;
  rolling_24h_volume?: string;
}

const initialState: PoolListState = {
  processedPools: [],
  loading: true,
  error: null,
};

function createWalletPoolListStore() {
  const { subscribe, update, set } = writable<PoolListState>(initialState);
  
  return {
    subscribe,
    
    reset: () => {
      set(initialState);
    },

    fetchPoolsForWallet: async (walletId: string) => {
      // Reset state first
      set(initialState);
      
      try {
        const actor = createAnonymousActorHelper(
          KONG_BACKEND_CANISTER_ID, 
          canisterIDLs.kong_backend
        );
        
        const response = await actor.user_balances(walletId);
        
        if (response.Ok) {
          // Process pools from response
          const rawPools = response.Ok.map(pool => pool.LP);
          const poolsWithIds = rawPools.map(pool => ({
            ...pool,
            id: `${pool.address_0}-${pool.address_1}`
          }));
          
          // Initial processing without tokens
          update(s => ({
            ...s,
            processedPools: poolsWithIds
          }));
          
          // Fetch tokens and update pools
          await fetchTokensForPools(poolsWithIds, update);
        }
      } catch (error) {
        console.error("Failed to load wallet pools:", error);
        update(s => ({ ...s, error: "Failed to load wallet pools" }));
      } finally {
        update(s => ({ ...s, loading: false }));
      }
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
      acc[token.canister_id] = token;
      return acc;
    }, {} as Record<string, FE.Token>);
    
    update(s => ({
      ...s,
      processedPools: pools.map(pool => ({
        ...pool,
        token0: tokenMap[pool.address_0],
        token1: tokenMap[pool.address_1],
        usd_balance: pool.usd_balance || "0"
      }))
    }));
  } catch (error) {
    console.error("Failed to load token information:", error);
    update(s => ({ ...s, error: "Failed to load token information" }));
  }
}

export const walletPoolListStore = createWalletPoolListStore(); 