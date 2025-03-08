import { get, writable } from "svelte/store";
import { type PNP } from "@windoge98/plug-n-play";
import { pnp, canisterIDLs as pnpCanisterIDLs, type CanisterType as PnpCanisterType } from "$lib/config/auth.config";
import { createAnonymousActorHelper } from "$lib/utils/actorUtils";
import { browser } from "$app/environment";
import { DEFAULT_TOKENS } from "$lib/constants/tokenConstants";
import { fetchTokensByCanisterId } from "$lib/api/tokens";
import { fetchBalances } from "$lib/api/balances";
import { currentUserBalancesStore } from "$lib/stores/balancesStore";

// Constants
const STORAGE_KEYS = {
  LAST_WALLET: "kongSelectedWallet",
  AUTO_CONNECT_ATTEMPTED: "kongAutoConnectAttempted",
  WAS_CONNECTED: "wasConnected",
  CONNECTION_RETRY_COUNT: "connectionRetryCount"
} as const;

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

  // Simplified storage operations
  const storage = {
    get: (key: keyof typeof STORAGE_KEYS) => browser ? localStorage.getItem(STORAGE_KEYS[key]) : null,
    set: (key: keyof typeof STORAGE_KEYS, value: string) => browser && localStorage.setItem(STORAGE_KEYS[key], value),
    clear: () => browser && Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k))
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
        
        if (!result?.owner) throw new Error("Invalid connection result");
        
        const owner = result.owner.toString();
        set({ isConnected: true, account: result, isInitialized: true });
        
        // Update state and storage
        selectedWalletId.set(walletId);
        isConnected.set(true);
        storage.set("LAST_WALLET", walletId);
        storage.set("WAS_CONNECTED", "true");

        // Load balances using the new API client
        setTimeout(async () => {
          try {
            // Import userTokens dynamically to avoid circular dependency
            const { userTokens } = await import("$lib/stores/userTokens");
            const userTokensStore = get(userTokens);
            
            // Load balances using the API client
            await fetchBalances(
              userTokensStore.tokens,
              owner,
              true
            );
            
            // Initialize default tokens if needed
            if (Object.keys(userTokensStore.enabledTokens).length === 0) {
              userTokens.enableTokens(await fetchTokensByCanisterId(Object.values(DEFAULT_TOKENS)));
            }
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
      storage.clear();
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
