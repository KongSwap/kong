import { get, writable } from "svelte/store";
import { type PNP } from "@windoge98/plug-n-play";
import {
  pnp,
  canisterIDLs as pnpCanisterIDLs,
  type CanisterType as PnpCanisterType,
} from "$lib/config/auth.config";
import { createAnonymousActorHelper } from "$lib/utils/actorUtils";
import { browser } from "$app/environment";
import { fetchBalances } from "$lib/api/balances";
import { currentUserBalancesStore } from "$lib/stores/balancesStore";
import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
import { createNamespacedStore } from "$lib/config/localForage.config";

// Constants
const AUTH_NAMESPACE = 'auth';
const STORAGE_KEYS = {
  LAST_WALLET: "selectedWallet",
  AUTO_CONNECT_ATTEMPTED: "autoConnectAttempted",
  WAS_CONNECTED: "wasConnected",
  CONNECTION_RETRY_COUNT: "connectionRetryCount",
} as const;

// Create namespaced store
const authStorage = createNamespacedStore(AUTH_NAMESPACE);

// Create stores with initial states
export const selectedWalletId = writable<string | null>(null);
export const isConnected = writable<boolean>(false);
export const connectionError = writable<string | null>(null);

// Type definitions and IDLs
export type CanisterType = PnpCanisterType;
export const canisterIDLs = pnpCanisterIDLs;

function createAuthStore(pnp: PNP) {
  const store = writable({
    isConnected: false,
    account: null,
    isInitialized: false,
  });

  const { subscribe, set } = store;

  // Storage operations using localForage
  const storage = {
    get: async (key: keyof typeof STORAGE_KEYS) => {
      if (!browser) return null;
      try {
        return await authStorage.getItem<string>(STORAGE_KEYS[key]);
      } catch (error) {
        console.error(`Error getting ${key} from storage:`, error);
        return null;
      }
    },
    
    set: async (key: keyof typeof STORAGE_KEYS, value: string) => {
      if (!browser) return;
      try {
        await authStorage.setItem(STORAGE_KEYS[key], value);
      } catch (error) {
        console.error(`Error setting ${key} in storage:`, error);
      }
    },
    
    clear: async () => {
      if (!browser) return;
      try {
        for (const key of Object.values(STORAGE_KEYS)) {
          await authStorage.removeItem(key);
        }
      } catch (error) {
        console.error('Error clearing storage:', error);
      }
    },
  };

  const storeObj = {
    subscribe,
    pnp,

    async initialize() {
      if (!browser) return;

      try {
        const lastWallet = await storage.get("LAST_WALLET");
        if (!lastWallet || lastWallet === "plug") return;

        const hasAttempted = sessionStorage.getItem(
          STORAGE_KEYS.AUTO_CONNECT_ATTEMPTED,
        );
        const wasConnected = await storage.get("WAS_CONNECTED");

        if (hasAttempted && !wasConnected) {
          return;
        }

        await this.connect(lastWallet, true);
      } catch (error) {
        console.warn("Auto-connect failed:", error);
        await storage.clear();
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
          console.error("Invalid connection result", result);
          // reset state
          set({ isConnected: false, account: null, isInitialized: true });
          throw new Error("Invalid connection result");
        }

        const owner = result.owner.toString();
        set({ isConnected: true, account: result, isInitialized: true });

        // Update state and storage
        selectedWalletId.set(walletId);
        isConnected.set(true);
        await storage.set("LAST_WALLET", walletId);
        await storage.set("WAS_CONNECTED", "true");

        // Load balances using the new API client
        setTimeout(async () => {
          try {
            // Import userTokens dynamically to avoid circular dependency
            const { userTokens } = await import("$lib/stores/userTokens");
            
            // Set current principal in userTokens store and load tokens if needed
            await userTokens.setPrincipal(owner);
            
            // Get updated token state
            const userTokensStore = get(userTokens);
            
            // Load balances using the API client
            await fetchBalances(userTokensStore.tokens, owner, true);
          } catch (error) {
            console.error("Error loading balances:", error);
          }
        }, 0);

        return result;
      } catch (error) {
        this.handleConnectionError(error);
        throw error;
      }
    },

    async disconnect() {
      await pnp.disconnect();
      set({ isConnected: false, account: null, isInitialized: true });
      selectedWalletId.set(null);
      isConnected.set(false);
      connectionError.set(null);
      currentUserBalancesStore.set({});
      currentUserPoolsStore.reset();
      
      // Set principal to null but don't reset tokens
      const { userTokens } = await import("$lib/stores/userTokens");
      userTokens.setPrincipal(null);
      
      // Clear storage completely and await its completion
      await storage.clear();
    },

    handleConnectionError(error: any) {
      console.error("Connection error:", error);
      set({ isConnected: false, account: null, isInitialized: true });
      connectionError.set(error.message);
      selectedWalletId.set(null);
      isConnected.set(false);
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
        throw new Error("Anonymous user");
      }

      return pnp.getActor(canisterId, idl, options);
    },
  };

  return storeObj;
}

export type AuthStore = ReturnType<typeof createAuthStore>;

// Create singleton auth store instance
export const auth = browser ? createAuthStore(pnp) : createAuthStore(null as any);

// Initialize auth only in browser
if (browser) {
  auth.initialize();
}

// Helper functions
export function requireWalletConnection(): void {
  if (!pnp.isWalletConnected()) {
    throw new Error("Wallet is not connected.");
  }
}

export const connectWallet = async (walletId: string) => {
  try {
    // If already connected to a wallet, disconnect first and wait for it to complete
    if (get(isConnected)) {
      await auth.disconnect();
    }
    return await auth.connect(walletId);
  } catch (error) {
    console.error("Failed to connect wallet:", error);
    throw error;
  }
};
