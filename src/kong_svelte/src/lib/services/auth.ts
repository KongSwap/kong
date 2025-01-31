import { get, writable } from "svelte/store";
import { type PNP } from "@windoge98/plug-n-play";
import { idlFactory as kongBackendIDL } from "../../../../declarations/kong_backend";
import { idlFactory as kongFaucetIDL } from "../../../../declarations/kong_faucet";
import { ICRC2_IDL as icrc2IDL } from "$lib/idls/icrc2.idl.js";
import { idlFactory as kongDataIDL } from "../../../../declarations/kong_data";
import { pnp } from "./pnp/PnpInitializer";
import { createAnonymousActorHelper } from "$lib/utils/actorUtils";
import { browser } from "$app/environment";
import { kongDB } from "./db";
import { idlFactory as snsGovernanceIDL } from "$lib/idls/snsGovernance.idl.js";
import { loadBalances, storedBalancesStore } from "./tokens/tokenStore";
import { userTokens } from "$lib/stores/userTokens";
import { DEFAULT_TOKENS } from "$lib/constants/tokenConstants";
import { fetchTokensByCanisterId } from "$lib/api/tokens";
import { PoolService } from "./pools/PoolService";

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

// Create stores with initial states
export const selectedWalletId = writable<string | null>(null);
export const isConnected = writable<boolean>(false);
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

  const { subscribe, set } = store;

  // Simplified storage access with error handling
  const storage = {
    save: (key: keyof typeof STORAGE_KEYS, value: string): void => {
      if (!browser) return;
      try {
        localStorage.setItem(STORAGE_KEYS[key], value);
      } catch (e) {
        console.warn(`Storage operation failed for ${key}:`, e);
      }
    },
    get: (key: keyof typeof STORAGE_KEYS): string | null => {
      if (!browser) return null;
      try {
        return localStorage.getItem(STORAGE_KEYS[key]);
      } catch (e) {
        console.warn(`Storage operation failed for ${key}:`, e);
        return null;
      }
    },
    clear: () => {
      if (!browser) return;
      Object.keys(STORAGE_KEYS).forEach(key => {
        try {
          localStorage.removeItem(STORAGE_KEYS[key as keyof typeof STORAGE_KEYS]);
        } catch (e) {
          console.warn(`Failed to clear ${key}:`, e);
        }
      });
      sessionStorage.removeItem(STORAGE_KEYS.AUTO_CONNECT_ATTEMPTED);
    }
  };

  const storeObj = {
    subscribe,
    pnp,

    async initialize() {
      if (!browser) return;
      console.log("Initializing auth");
      
      const lastWallet = storage.get("LAST_WALLET");
      if (!lastWallet || lastWallet === "plug") return;

      const hasAttempted = sessionStorage.getItem(STORAGE_KEYS.AUTO_CONNECT_ATTEMPTED);
      const wasConnected = storage.get("WAS_CONNECTED");
      
      if (hasAttempted && !wasConnected) {
        return;
      }

      try {
        await this.connect(lastWallet, true);
      } catch (error) {
        console.warn("Auto-connect failed:", error);
        storage.clear();
        connectionError.set(error.message);
      } finally {
        sessionStorage.setItem(STORAGE_KEYS.AUTO_CONNECT_ATTEMPTED, "true");
      }
    },

    async connect(walletId: string, isAutoConnect = false) {
      try {
        connectionError.set(null);
        const result = await pnp.connect(walletId);

        if (!result?.owner) {
          throw new Error("Invalid connection result format");
        }

        const owner = result.owner.toString();
        
        // Update state
        const newState = { isConnected: true, account: result, isInitialized: true };
        set(newState);
        selectedWalletId.set(walletId);
        isConnected.set(true);
        
        // Update storage
        storage.save("LAST_WALLET", walletId);
        storage.save("WAS_CONNECTED", "true");
        sessionStorage.setItem(STORAGE_KEYS.AUTO_CONNECT_ATTEMPTED, "false");
        
        // Clear existing data
        await Promise.all([
          kongDB.token_balances.clear(),
          kongDB.user_pools.clear(),
        ]);

        const userTokensStore = get(userTokens)
        if(Object.keys(userTokensStore.enabledTokens).length === 0) {
          const defaultTokens = await fetchTokensByCanisterId(Object.values(DEFAULT_TOKENS))
          userTokens.enableTokens(defaultTokens)
        }


        // Load new data
        await Promise.all([
          loadBalances(owner, { forceRefresh: true }),
          PoolService.fetchUserPoolBalances(true)
        ]).catch(error => console.warn("Failed to load initial data:", error));

        
        return result;
      } catch (error) {
        this.handleConnectionError(error);
        throw error;
      }
    },

    async disconnect() {
      try {
        await pnp.disconnect();
        
        // Clear all state
        set({ isConnected: false, account: null, isInitialized: true });
        selectedWalletId.set(null);
        isConnected.set(false);
        connectionError.set(null);
        
        // Clear data
        await Promise.all([
          kongDB.token_balances.clear(),
          kongDB.user_pools.clear()
        ]);

        storedBalancesStore.set({});

        storage.clear();
        return true;
      } catch (error) {
        console.error("Disconnect error:", error);
        connectionError.set(error.message);
        throw error;
      }
    },

    handleConnectionError(error: any) {
      console.error("Connection error:", error);
      set({ isConnected: false, account: null, isInitialized: true });
      storage.clear();
      connectionError.set(error.message);
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

      return pnp.getActor(canisterId, idl, options);
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
