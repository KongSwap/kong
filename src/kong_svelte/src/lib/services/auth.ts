import { writable } from "svelte/store";
import { walletsList, type PNP } from "@windoge98/plug-n-play";
import { idlFactory as kongBackendIDL } from "../../../../declarations/kong_backend";
import { idlFactory as kongFaucetIDL } from "../../../../declarations/kong_faucet";
import { idlFactory as icrc2IDL } from "$lib/idls/ksusdt_ledger/ksusdt_ledger.did.js";
import { idlFactory as kongDataIDL } from "../../../../declarations/kong_data";
import { pnp } from "./pnp/PnpInitializer";
import { createAnonymousActorHelper } from "$lib/utils/actorUtils";
import { browser } from "$app/environment";
import { loadBalances } from "./tokens";
import { kongDB } from "./db";
import { PoolService } from "./pools/PoolService";
import { idlFactory as snsGovernanceIDL } from "$lib/idls/snsGovernance.idl.js";

// Export the list of available wallets
export const availableWallets = walletsList.filter(wallet => wallet.id !== 'oisy');

// Create stores for auth state
export const selectedWalletId = writable<string | null>(null);
export const isConnected = writable<boolean>(false);
export const principalId = writable<string | null>(null);

// IDL Mappings
export type CanisterType = "kong_backend" | "icrc1" | "icrc2" | "kong_faucet";
export const canisterIDLs = {
  kong_backend: kongBackendIDL,
  kong_faucet: kongFaucetIDL,
  icrc1: icrc2IDL,
  icrc2: icrc2IDL,
  kong_data: kongDataIDL,
  sns_governance: snsGovernanceIDL,
};

// Add a constant for the storage key
const LAST_WALLET_KEY = "kongSelectedWallet";
const AUTO_CONNECT_ATTEMPTED_KEY = "kongAutoConnectAttempted";

function createAuthStore(pnp: PNP) {
  const store = writable({
    isConnected: false,
    account: null,
    isInitialized: false,
  });

  const { subscribe, set, update } = store;

  const saveLastWallet = (walletId: string) => {
    if (!browser) return;
    try {
      localStorage.setItem(LAST_WALLET_KEY, walletId);
    } catch (e) {
      console.warn("Failed to write to localStorage:", e);
    }
  };

  const storeObj = {
    subscribe,
    pnp,
    async connect(walletId: string, isAutoConnect = false) {
      try {
        const result = await pnp.connect(walletId);

        if (result && "owner" in result) {
          const newState = {
            isConnected: true,
            account: result,
            isInitialized: true,
          };
          set(newState);
          Promise.all([
            loadBalances(result.owner.toString()),
            PoolService.fetchUserPoolBalances(true),
          ]);
          selectedWalletId.set(walletId);
          isConnected.set(true);
          principalId.set(result.owner.toString());
          saveLastWallet(walletId);
          return result;
        } else {
          console.error("Invalid connection result format:", result);
          set({ isConnected: false, account: null, isInitialized: true });
          if (!isAutoConnect) {
            localStorage.removeItem(LAST_WALLET_KEY);
          }
          return null;
        }
      } catch (error) {
        console.error("Connection error:", error);
        set({ isConnected: false, account: null, isInitialized: true });
        if (!isAutoConnect) {
          localStorage.removeItem(LAST_WALLET_KEY);
        }
        throw error;
      }
    },

    async disconnect() {
      try {
        const result = pnp.disconnect();
        set({ isConnected: false, account: null, isInitialized: true });
        // zero out token balances
        await kongDB.token_balances.clear();
        await kongDB.user_pools.clear();
        // Clear saved wallet on disconnect
        if (browser) {
          localStorage.removeItem(LAST_WALLET_KEY);
          localStorage.removeItem("kongSelectedWallet");
          // Clear the auto-connect attempt flag
          sessionStorage.removeItem(AUTO_CONNECT_ATTEMPTED_KEY);
        }

        return result;
      } catch (error) {
        console.error("Disconnect error:", error);
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

      if (!pnp.isWalletConnected()) throw new Error('Anonymous user');

      return pnp.getActor(canisterId, idl, {
        anon: options.anon,
        requiresSigning: options.requiresSigning,
      });
    },
  };

  return storeObj;
}

export type AuthStore = ReturnType<typeof createAuthStore>;

// Create the auth store instance
const authStore = createAuthStore(pnp);

// Create Auth class instance with the store
export const auth = authStore;

export function requireWalletConnection(): void {
  const connected = pnp.isWalletConnected();
  if (!connected) {
    throw new Error("Wallet is not connected.");
  }
}

export const connectWallet = async (walletId: string) => {
  try {
    const account = await auth.connect(walletId);
    return account;
  } catch (error) {
    console.error("Failed to connect wallet:", error);
    throw error;
  }
};
