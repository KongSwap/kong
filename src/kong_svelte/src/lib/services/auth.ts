import { writable, get } from "svelte/store";
import { walletsList, type PNP } from "@windoge98/plug-n-play";
import { idlFactory as kongBackendIDL } from "../../../../declarations/kong_backend";
import { idlFactory as kongFaucetIDL } from "../../../../declarations/kong_faucet";
import { ICRC2_IDL as icrc2IDL } from "$lib/idls/icrc2.idl.js";
import { idlFactory as kongDataIDL } from "../../../../declarations/kong_data";
import { pnp } from "./pnp/PnpInitializer";
import { createAnonymousActorHelper } from "$lib/utils/actorUtils";
import { browser } from "$app/environment";
import { TokenService } from "./tokens/TokenService";
import { kongDB } from "./db";
import { PoolService } from "./pools/PoolService";
import { idlFactory as snsGovernanceIDL } from "$lib/idls/snsGovernance.idl.js";
import { loadBalances } from "./tokens/tokenStore";

// Constants
const STORAGE_KEYS = {
  LAST_WALLET: "kongSelectedWallet",
  AUTO_CONNECT_ATTEMPTED: "kongAutoConnectAttempted",
  WAS_CONNECTED: "wasConnected",
  CONNECTION_RETRY_COUNT: "connectionRetryCount"
} as const;

// Configuration
const CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  CONNECTION_TIMEOUT: 30000, // 30 seconds
} as const;

// Export filtered wallet list (memoized)
function filterWallets(wallets: PNP[]) {
  if(process.env.DFX_NETWORK === "ic") {
    return wallets.filter(wallet => wallet.id !== 'oisy');
  }
  return wallets;
}
//export const availableWallets = filterWallets(walletsList);
// Export the list of available wallets
export const availableWallets = filterWallets(walletsList);

// Create stores with initial states
export const selectedWalletId = writable<string | null>(null);
export const isConnected = writable<boolean>(false);
export const principalId = writable<string | null>(null);
export const connectionError = writable<string | null>(null);

// Type definitions
export type CanisterType = "kong_backend" | "icrc1" | "icrc2" | "kong_faucet";

// Memoized IDL mappings
export const canisterIDLs = Object.freeze({
  kong_backend: kongBackendIDL,
  kong_faucet: kongFaucetIDL,
  icrc1: icrc2IDL,
  icrc2: icrc2IDL,
  kong_data: kongDataIDL,
  sns_governance: snsGovernanceIDL,
});

function createAuthStore(pnp: PNP) {
  const store = writable({
    isConnected: false,
    account: null,
    isInitialized: false,
  });

  const { subscribe, set, update } = store;

  // Memoized storage access functions with error handling
  const storage = {
    save: (key: keyof typeof STORAGE_KEYS, value: string): void => {
      if (!browser) return;
      try {
        localStorage.setItem(STORAGE_KEYS[key], value);
      } catch (e) {
        console.warn(`Failed to write ${key} to localStorage:`, e);
      }
    },
    remove: (key: keyof typeof STORAGE_KEYS): void => {
      if (!browser) return;
      try {
        localStorage.removeItem(STORAGE_KEYS[key]);
      } catch (e) {
        console.warn(`Failed to remove ${key} from localStorage:`, e);
      }
    },
    get: (key: keyof typeof STORAGE_KEYS): string | null => {
      if (!browser) return null;
      try {
        return localStorage.getItem(STORAGE_KEYS[key]);
      } catch (e) {
        console.warn(`Failed to read ${key} from localStorage:`, e);
        return null;
      }
    },
    increment: (key: keyof typeof STORAGE_KEYS): number => {
      if (!browser) return 0;
      try {
        const value = Number(localStorage.getItem(STORAGE_KEYS[key])) || 0;
        localStorage.setItem(STORAGE_KEYS[key], String(value + 1));
        return value + 1;
      } catch (e) {
        console.warn(`Failed to increment ${key} in localStorage:`, e);
        return 0;
      }
    }
  };

  const clearConnectionState = () => {
    Object.keys(STORAGE_KEYS).forEach(key => {
      storage.remove(key as keyof typeof STORAGE_KEYS);
    });
    sessionStorage.removeItem(STORAGE_KEYS.AUTO_CONNECT_ATTEMPTED);
  };

  const storeObj = {
    subscribe,
    pnp,

    async initialize() {
      if (!browser) return;
      console.log("Initializing auth");
      
      try {
        const lastWallet = storage.get("LAST_WALLET");
        if (!lastWallet || lastWallet === "plug") return;

        const hasAttempted = sessionStorage.getItem(STORAGE_KEYS.AUTO_CONNECT_ATTEMPTED);
        const wasConnected = storage.get("WAS_CONNECTED");
        const retryCount = Number(storage.get("CONNECTION_RETRY_COUNT")) || 0;
        
        if ((hasAttempted && !wasConnected) || retryCount >= CONFIG.MAX_RETRIES) {
          return;
        }

        await this.connect(lastWallet, true);
        storage.remove("CONNECTION_RETRY_COUNT");
        
      } catch (error) {
        console.warn("Auto-connect failed:", error);
        storage.increment("CONNECTION_RETRY_COUNT");
        clearConnectionState();
        connectionError.set(error.message);
      } finally {
        sessionStorage.setItem(STORAGE_KEYS.AUTO_CONNECT_ATTEMPTED, "true");
      }
    },

    async connect(walletId: string, isAutoConnect = false) {
      try {
        connectionError.set(null);
        const result = await pnp.connect(walletId);

        if (result && "owner" in result) {
          const owner = result.owner.toString();
          const newState = {
            isConnected: true,
            account: result,
            isInitialized: true,
          };
          
          // Update all states atomically
          set(newState);
          selectedWalletId.set(walletId);
          isConnected.set(true);
          principalId.set(owner);
          
          // Update storage
          storage.save("LAST_WALLET", walletId);
          storage.save("WAS_CONNECTED", "true");
          storage.remove("CONNECTION_RETRY_COUNT");
          sessionStorage.setItem(STORAGE_KEYS.AUTO_CONNECT_ATTEMPTED, "false");
          
          // Load balances in parallel with timeout
          await Promise.all([
            loadBalances(owner),
            PoolService.fetchUserPoolBalances(true),
          ]).catch(error => {
            console.warn("Failed to load initial balances:", error);
          });

          return result;
        }
        
        throw new Error("Invalid connection result format");
      } catch (error) {
        console.error("Connection error:", error);
        set({ isConnected: false, account: null, isInitialized: true });
        clearConnectionState();
        connectionError.set(error.message);
        throw error;
      }
    },

    async disconnect() {
      try {
        const result = await pnp.disconnect();
        
        // Clear state
        set({ isConnected: false, account: null, isInitialized: true });
        selectedWalletId.set(null);
        isConnected.set(false);
        principalId.set(null);
        connectionError.set(null);
        
        // Clear DB in parallel
        await Promise.all([
          kongDB.token_balances.clear(),
          kongDB.user_pools.clear()
        ]).catch(error => {
          console.warn("Failed to clear databases:", error);
        });

        // Clear storage
        if (browser) {
          clearConnectionState();
        }

        return result;
      } catch (error) {
        console.error("Disconnect error:", error);
        connectionError.set(error.message);
        throw error;
      }
    },

    getActor(
      canisterId: string,
      idl: any,
      options: { anon?: boolean; requiresSigning?: boolean } = {},
    ) {
      if (options.anon) {
        return createAnonymousActorHelper(canisterId, idl);
      }

      if (!pnp.isWalletConnected()) {
        throw new Error('Anonymous user');
      }

      return pnp.getActor(canisterId, idl, {
        anon: options.anon,
        requiresSigning: options.requiresSigning,
      });
    },
  };

  return storeObj;
}

export type AuthStore = ReturnType<typeof createAuthStore>;

// Create singleton auth store instance
export const auth = createAuthStore(pnp);

// Helper functions
export function requireWalletConnection(): void {
  if (!pnp.isWalletConnected()) {
    throw new Error("Wallet is not connected.");
  }
}

export const connectWallet = async (walletId: string) => {
  try {
    return await auth.connect(walletId);
  } catch (error) {
    console.error("Failed to connect wallet:", error);
    throw error;
  }
};
