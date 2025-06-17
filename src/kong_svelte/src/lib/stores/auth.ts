import { get, writable } from "svelte/store";
import { type PnpInterface } from "@windoge98/plug-n-play";
import {
  type CanisterType,
  pnp,
  canisters as pnpCanisters,
} from "$lib/config/auth.config";

// Re-export CanisterType for other modules
export type { CanisterType };
import { browser } from "$app/environment";
import { fetchBalances } from "$lib/api/balances";
import { currentUserBalancesStore } from "$lib/stores/balancesStore";
import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
import { trackEvent, AnalyticsEvent } from "$lib/utils/analytics";
import { userTokens } from "$lib/stores/userTokens";

// Constants
const AUTH_NAMESPACE = 'auth';
const STORAGE_KEYS = {
  LAST_WALLET: "selectedWallet",
  AUTO_CONNECT_ATTEMPTED: "autoConnectAttempted",
  WAS_CONNECTED: "wasConnected",
  CONNECTION_RETRY_COUNT: "connectionRetryCount",
} as const;

// Helper to create namespaced localStorage keys
const getStorageKey = (key: string) => `${AUTH_NAMESPACE}:${key}`;
export const selectedWalletId = writable<string | null>(null);
export const isConnected = writable<boolean>(false);
export const connectionError = writable<string | null>(null);
export const isAuthenticating = writable<boolean>(false);
export const canisters = pnpCanisters;

function createAuthStore(pnp: PnpInterface) {
  const store = writable({ isConnected: false, account: null, isInitialized: false });
  const { subscribe, set } = store;
  let isStoreInitialized = false;

  // Storage operations
  const storage = {
    get(key: keyof typeof STORAGE_KEYS): string | null {
      if (!browser) return null;
      try {
        return localStorage.getItem(getStorageKey(STORAGE_KEYS[key]));
      } catch (error) {
        console.error(`Error getting ${key} from storage:`, error);
        return null;
      }
    },
    
    set(key: keyof typeof STORAGE_KEYS, value: string): void {
      if (!browser) return;
      try {
        localStorage.setItem(getStorageKey(STORAGE_KEYS[key]), value);
      } catch (error) {
        console.error(`Error setting ${key} in storage:`, error);
      }
    },
    
    clear(): void {
      if (!browser) return;
      try {
        for (const key of Object.values(STORAGE_KEYS)) {
          localStorage.removeItem(getStorageKey(key));
        }
      } catch (error) {
        console.error('Error clearing storage:', error);
      }
    },
  };

  // Helper to update store state on disconnect or error
  const resetState = (err: string | null = null) => {
    set({ isConnected: false, account: null, isInitialized: true });
    selectedWalletId.set(null);
    isConnected.set(false);
    connectionError.set(err);
  };

  const storeObj = {
    subscribe,
    pnp,

    async initialize() {
      if (!browser || isStoreInitialized) return;
      isStoreInitialized = true;

      try {
        const lastWallet = storage.get("LAST_WALLET");
        if (!lastWallet || lastWallet === "plug") return;

        const hasAttempted = sessionStorage.getItem(STORAGE_KEYS.AUTO_CONNECT_ATTEMPTED);
        const wasConnected = storage.get("WAS_CONNECTED");

        if (!(hasAttempted && !wasConnected)) {
          await this.connect(lastWallet, false, true);
        }
      } catch (error) {
        console.warn("Auto-connect failed:", error);
        storage.clear();
        connectionError.set(error.message);
        isStoreInitialized = false;
      } finally {
        sessionStorage.setItem(STORAGE_KEYS.AUTO_CONNECT_ATTEMPTED, "true");
      }
    },

    async connect(walletId: string, isRetry = false, isAutoConnect = false) {
      try {
        connectionError.set(null);
        isAuthenticating.set(true);
        const result = await pnp.connect(walletId);

        if (!result?.owner) {
          // Don't retry if user cancelled or this is an auto-connect attempt
          if (!isRetry && !isAutoConnect) {
            console.warn(`Connection attempt failed for ${walletId}, retrying once...`);
            await pnp.disconnect();
            await new Promise(resolve => setTimeout(resolve, 500));
            return await this.connect(walletId, true, isAutoConnect);
          }
          
          console.error("Connection failed after retry.");
          await this.disconnect();
          throw new Error("Invalid connection result after retry. Please try again. If the issue persists, reload the page.");
        }

        const owner = result.owner;
        set({ isConnected: true, account: result, isInitialized: true });
        
        // Track successful connection using the utility function
        trackEvent(AnalyticsEvent.ConnectWallet, { 
          wallet_id: walletId 
        });

        // Update state and storage
        selectedWalletId.set(walletId);
        isConnected.set(true);
        storage.set("LAST_WALLET", walletId);
        storage.set("WAS_CONNECTED", "true");

        // Load balances in background
        setTimeout(async () => {
          try {
            await userTokens.setPrincipal(owner);
            await fetchBalances(get(userTokens).tokens, owner, true);
          } catch (error) {
            console.error("Error loading balances:", error);
          }
        }, 0);

        return result;
      } catch (error) {
        console.error("Connection error:", error);
        resetState(error.message);
        throw error;
      } finally {
        isAuthenticating.set(false);
      }
    },

    async disconnect() {
      await pnp.disconnect();
      resetState(null);
      currentUserBalancesStore.set({});
      currentUserPoolsStore.reset();
      isConnected.set(false);
      selectedWalletId.set(null);
      isAuthenticating.set(false);
      connectionError.set(null);
      // Set principal to null but don't reset tokens
      userTokens.setPrincipal(null);
      
      storage.clear();
    },
  };

  return storeObj;
}

export type AuthStore = ReturnType<typeof createAuthStore>;
export const auth = createAuthStore(pnp);

// Helper functions
export function requireWalletConnection(): void {
  if (!pnp.isAuthenticated()) throw new Error("Wallet is not connected.");
}

export const connectWallet = async (walletId: string) => {
  try {
    isAuthenticating.set(true);
    if (get(isConnected)) await auth.disconnect();
    return await auth.connect(walletId);
  } catch (error) {
    console.error("Failed to connect wallet:", error);
    throw error;
  } finally {
    isAuthenticating.set(false);
  }
};

export function icrcActor({canisterId, anon = false, requiresSigning = true}: {canisterId: string, anon?: boolean, requiresSigning?: boolean}) {
  return pnp.getActor<CanisterType["ICRC2_LEDGER"]>({canisterId, idl: canisters.icrc2.idl, anon, requiresSigning});
}

export const icpActor = ({ anon = false, requiresSigning = true}: { anon?: boolean, requiresSigning?: boolean}) => {
  return pnp.getActor<CanisterType["ICP_LEDGER"]>({canisterId: canisters.icp.canisterId, idl: canisters.icp.idl, anon, requiresSigning});
}

export const swapActor = ({ anon = false, requiresSigning = true}: { anon?: boolean, requiresSigning?: boolean}) => {
  return pnp.getActor<CanisterType["KONG_BACKEND"]>({canisterId: canisters.kongBackend.canisterId, idl: canisters.kongBackend.idl, anon, requiresSigning});
}

export const predictionActor = ({ anon = false, requiresSigning = true}: { anon?: boolean, requiresSigning?: boolean}) => {
  return pnp.getActor<CanisterType["PREDICTION_MARKETS"]>({canisterId: canisters.predictionMarkets.canisterId, idl: canisters.predictionMarkets.idl, anon, requiresSigning});
}

export const trollboxActor = ({ anon = false, requiresSigning = true}: { anon?: boolean, requiresSigning?: boolean}) => {
  return pnp.getActor<CanisterType["TROLLBOX"]>({canisterId: canisters.trollbox.canisterId, idl: canisters.trollbox.idl, anon, requiresSigning});
}

export const faucetActor = ({ anon = false, requiresSigning = true}: { anon?: boolean, requiresSigning?: boolean}) => {
  return pnp.getActor<CanisterType["KONG_FAUCET"]>({canisterId: canisters.kongFaucet.canisterId, idl: canisters.kongFaucet.idl, anon, requiresSigning});
} 