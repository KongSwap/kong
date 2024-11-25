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

// Helper function to create anonymous actor
// export const createAnonymousActorHelper = async (canisterId: string, idl: any) => {
//   const agent = HttpAgent.createSync({
//     host: process.env.DFX_NETWORK !== "ic" ? "http://localhost:4943" : "https://icp0.io",
//   });

//   // Always fetch root key in local development
//   if (process.env.DFX_NETWORK !== "ic") {
//     await agent.fetchRootKey().catch(console.error);
//   }

//   return Actor.createActor(idl as any, {
//     agent,
//     canisterId,
//   });
// };

function createAuthStore(pnp: PNP) {
  // Create a single source of truth for the store
  const store = writable({
    isConnected: false,
    account: null
  });

  const { subscribe, set } = store;

  return {
    subscribe,
    pnp,
    async connect(walletId: string) {
      try {
        const result = await pnp.connect(walletId);
        
        // Check if we have a valid connection result with owner property
        if (result && 'owner' in result) {
          // Update the store state
          const newState = { 
            isConnected: true,
            account: result 
          };
          set(newState);

          // Force a refresh of the userStore by getting the user data
          const actor = await this.getActor(kongBackendCanisterId, kongBackendIDL, { anon: false });
          const userData = await actor.get_user();
        } else {
          console.log("Invalid connection result:", result);
          set({ isConnected: false, account: null });
        }
        return result;
      } catch (error) {
        console.error('Connection error:', error);
        set({ isConnected: false, account: null });
        throw error;
      }
    },

    async disconnect() {
      try {
        const result = await pnp.disconnect();
        set({ isConnected: false, account: null });
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