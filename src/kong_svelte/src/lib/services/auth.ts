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

        // Reset data and load fresh
        await kongDB.token_balances.clear();
        await kongDB.user_pools.clear();

        await Promise.all([
          loadBalances(owner, { forceRefresh: true }),
          PoolService.fetchUserPoolBalances(true)
        ]);

        // Initialize default tokens if needed
        if (Object.keys(get(userTokens).enabledTokens).length === 0) {
          userTokens.enableTokens(await fetchTokensByCanisterId(Object.values(DEFAULT_TOKENS)));
        }

        return result;
      } catch (error) {
        this.handleConnectionError(error);
        throw error;
      }
    },

    async disconnect() {
      await pnp.disconnect();
      set({ isConnected: false, account: null, isInitialized: true });
      await kongDB.token_balances.clear();
      await kongDB.user_pools.clear();
      selectedWalletId.set(null);
      isConnected.set(false);
      connectionError.set(null);
      storedBalancesStore.set({});
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
