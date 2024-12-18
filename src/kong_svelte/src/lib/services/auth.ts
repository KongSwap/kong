import { writable, get } from "svelte/store";
import { walletsList, type PNP } from "@windoge98/plug-n-play";
import {
  idlFactory as kongBackendIDL,
} from "../../../../declarations/kong_backend";
import {
  idlFactory as kongFaucetIDL,
} from "../../../../declarations/kong_faucet";
import { ICRC2_IDL } from "$lib/idls/icrc2.idl";
import { pnp } from "./pnp/PnpInitializer";
import { tokenStore } from "$lib/services/tokens/tokenStore";
import { createAnonymousActorHelper } from "$lib/utils/actorUtils";
import { browser } from '$app/environment';
import { TokenService } from "./tokens";

// Export the list of available wallets
export const availableWallets = walletsList;

// Create stores for auth state
export const selectedWalletId = writable<string | null>(null);
export const isConnected = writable<boolean>(false);
export const principalId = writable<string | null>(null);

// IDL Mappings
export type CanisterType = "kong_backend" | "icrc1" | "icrc2" | "kong_faucet";
export const canisterIDLs = {
  kong_backend: kongBackendIDL,
  kong_faucet: kongFaucetIDL,
  icrc1: ICRC2_IDL,
  icrc2: ICRC2_IDL,
};

// Add a constant for the storage key
const LAST_WALLET_KEY = 'kongSelectedWallet';

function createAuthStore(pnp: PNP) {
  const store = writable({
    isConnected: false,
    account: null,
    isInitialized: false
  });

  const { subscribe, set, update } = store;

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
          selectedWalletId.set(walletId);
          isConnected.set(true);
          principalId.set(result.owner.toString());

          saveLastWallet(walletId);

          const balances = await TokenService.fetchBalances(null, result.owner.toString())
          tokenStore.updateBalances(balances);
          return result;
        } else {
          console.log("Invalid connection result:", result);
          set({ isConnected: false, account: null, isInitialized: true });
          localStorage.removeItem(LAST_WALLET_KEY);
          return null;
        }
      } catch (error) {
        console.error('Connection error:', error);
        set({ isConnected: false, account: null, isInitialized: true });
        localStorage.removeItem(LAST_WALLET_KEY);
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
          localStorage.removeItem("kongSelectedWallet");
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
            return await pnp.getActor(canisterId, idl, { anon: options.anon, requiresSigning: options.requiresSigning });;
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

// Create the auth store instance
const authStore = createAuthStore(pnp);

// Create Auth class instance with the store
export const auth = authStore;

export async function requireWalletConnection(): Promise<void> {
  const connected = pnp.isConnected;
  if (!connected) {
    throw new Error('Wallet is not connected.');
  }
}

export const connectWallet = async (walletId: string) => {
  try {
      const account = await auth.connect(walletId);
      return account;
  } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
  }
};
