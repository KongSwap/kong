import { writable, get } from "svelte/store";
import { walletsList, type PNP } from "@windoge98/plug-n-play";
import {
  canisterId as kongBackendCanisterId,
  idlFactory as kongBackendIDL,
} from "../../../../declarations/kong_backend";
import {
  idlFactory as kongFaucetIDL,
} from "../../../../declarations/kong_faucet";
import { idlFactory as icrc1idl } from "../../../../declarations/ckbtc_ledger";
import { idlFactory as icrc2idl } from "../../../../declarations/ckusdt_ledger";
import { getPnpInstance } from "./pnp/PnpInitializer";
import { tokenStore } from "$lib/services/tokens/tokenStore";
import { createAnonymousActorHelper } from "$lib/utils/actorUtils";
import { browser } from '$app/environment';
import { TokenService } from "./tokens";

// Export the list of available wallets
export const availableWallets = walletsList;

// Create a store for the selected wallet ID
export const selectedWalletId = writable<string | null>(null);

// IDL Mappings
export type CanisterType = "kong_backend" | "icrc1" | "icrc2" | "kong_faucet";
export const canisterIDLs = {
  kong_backend: kongBackendIDL,
  kong_faucet: kongFaucetIDL,
  icrc1: icrc1idl,
  icrc2: icrc2idl,
};

// Add a constant for the storage key
const LAST_WALLET_KEY = 'kongSelectedWallet';

function createAuthStore(pnp: PNP) {
  const store = writable({
    isConnected: false,
    account: null,
    isInitialized: false  // Add this flag to track initialization state
  });

  const { subscribe, set, update } = store;

  // Add function to get last used wallet
  const getLastWallet = () => {
    if (!browser) return null;
    try {
      return localStorage.getItem(LAST_WALLET_KEY);
    } catch (e) {
      console.warn('Failed to read from localStorage:', e);
      return null;
    }
  };

  // Add function to save last used wallet
  const saveLastWallet = (walletId: string) => {
    if (!browser) return;
    try {
      localStorage.setItem(LAST_WALLET_KEY, walletId);
    } catch (e) {
      console.warn('Failed to write to localStorage:', e);
    }
  };

  return {
    subscribe,
    pnp,
    
    // Add initialization function
    async initialize() {
      try {
        const lastWallet = getLastWallet();
        if (lastWallet) {
          await this.connect(lastWallet, true);
          await TokenService.fetchBalances()
        }
      } catch (error) {
        console.warn('Auto-reconnect failed:', error);
      } finally {
        update(s => ({ ...s, isInitialized: true }));
      }
    },

    async connect(walletId: string, isAutoConnect = false) {
      try {
        const result = await pnp.connect(walletId);
        
        if (result && 'owner' in result) {          
          const newState = { 
            isConnected: true,
            account: result,
            isInitialized: true
          };
          set(newState);

          // Only save wallet if it's not an auto-connect
          if (!isAutoConnect) {
            saveLastWallet(walletId);
          }

          // Force a refresh of the userStore and token balances
          const actor = await this.getActor(kongBackendCanisterId, kongBackendIDL, { anon: false, requiresSigning: false });
          
          try {
            const [_, balances] = await Promise.all([
              actor.get_user(),
              TokenService.fetchBalances(null, result.owner.toString())
            ]);
            tokenStore.updateBalances(balances);
            return result;
          } catch (error) {
            console.error('Error fetching user data or balances:', error);
            localStorage.removeItem("kongSelectedWallet");
            throw error;
          }
        } else {
          console.log("Invalid connection result:", result);
          set({ isConnected: false, account: null, isInitialized: true });
          localStorage.removeItem("kongSelectedWallet");
          return null;
        }
      } catch (error) {
        console.error('Connection error:', error);
        set({ isConnected: false, account: null, isInitialized: true });
        localStorage.removeItem("kongSelectedWallet");
        throw error;
      }
    },

    async disconnect() {
      try {
        const result = await pnp.disconnect();
        set({ isConnected: false, account: null, isInitialized: true });
        // zero out token balances
        tokenStore.update(state => ({
          ...state,
          balances: Object.keys(state.balances).reduce((acc, key) => {
            acc[key] = { in_tokens: 0n, in_usd: '0' };
            return acc;
          }, {} as Record<string, TokenBalance>),
        }));
        // Clear saved wallet on disconnect
        if (browser) {
          localStorage.removeItem(LAST_WALLET_KEY);
        }
        
        return result;
      } catch (error) {
        console.error('Disconnect error:', error);
        throw error;
      }
    },

    getActor(canisterId: string, idl: any, options: { anon?: boolean, requiresSigning?: boolean } = {}) {
      if (options.anon) {
        return createAnonymousActorHelper(canisterId, idl);
      }

      if (!pnp.isWalletConnected()) {
        throw new Error('Anonymous user');
      }

      // Add retry logic for actor creation
      const maxRetries = 3;
      let attempt = 0;
      
      const createActorWithRetry = async () => {
        while (attempt < maxRetries) {
          try {
            const actor = await pnp.getActor(canisterId, idl, { anon: options.anon, requiresSigning: options.requiresSigning });
            return actor;
          } catch (error) {
            attempt++;
            if (attempt === maxRetries) {
              throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      };

      return createActorWithRetry();
    },
  };
}

export type AuthStore = ReturnType<typeof createAuthStore>;
export const auth = createAuthStore(getPnpInstance());


// Create a writable store for user data
const userDataStore = writable<any>(null);

// Export the readable user store
export const userStore = {
  subscribe: userDataStore.subscribe
};

export async function requireWalletConnection(): Promise<void> {
  const pnp = get(auth);
  const connected = pnp.isConnected;
  if (!connected) {
    throw new Error('Wallet is not connected.');
  }
}
