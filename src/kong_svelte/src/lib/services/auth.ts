import { writable, type Writable, get, derived } from "svelte/store";
import { walletsList, type PNP } from "@windoge98/plug-n-play";
import {
  canisterId as kongBackendCanisterId,
  idlFactory as kongBackendIDL,
} from "../../../../declarations/kong_backend";
import {
  idlFactory as kongFaucetIDL,
  canisterId as kongFaucetCanisterId,
} from "../../../../declarations/kong_faucet";
import { idlFactory as icrc1idl } from "../../../../declarations/ckbtc_ledger";
import { idlFactory as icrc2idl } from "../../../../declarations/ckusdt_ledger";
import { Actor, HttpAgent, AnonymousIdentity } from "@dfinity/agent";
import { getPnpInstance } from "./pnp/PnpInitializer";
import { tokenStore } from "$lib/services/tokens/tokenStore";

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
export const createAnonymousActorHelper = async (canisterId: string, idl: any) => {
  const agent = HttpAgent.createSync({
    host: process.env.DFX_NETWORK !== "ic" ? "http://localhost:4943" : "https://icp0.io",
  });

  // Always fetch root key in local development
  if (process.env.DFX_NETWORK !== "ic") {
    await agent.fetchRootKey().catch(console.error);
  }

  // Handle both function and object IDLs
  const interfaceFactory = typeof idl === 'function' ? idl : idl.idlFactory || idl;
  if (typeof interfaceFactory !== 'function') {
    throw new Error('Invalid IDL factory provided');
  }

  return Actor.createActor(interfaceFactory, {
    agent,
    canisterId,
  });
};

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
        console.log("Connecting with PNP, initial state:", pnp.isWalletConnected());
        const result = await pnp.connect(walletId);
        console.log("PNP connect result:", result);
        
        // Check if we have a valid connection result with owner property
        if (result && 'owner' in result) {
          console.log("Setting connected state with account:", result);
          // Update the store state
          const newState = { 
            isConnected: true,
            account: result 
          };
          set(newState);
          console.log("Updated auth state:", newState);
          
          // Force a refresh of the userStore by getting the user data
          const actor = await this.getActor(kongBackendCanisterId, kongBackendIDL, { anon: false });
          const userData = await actor.get_user();
          console.log("User data after connect:", userData);
          // Load tokens after successful connection
          await tokenStore.loadTokens(true);
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

    getActor(canisterId: string, idl: any, options: { anon?: boolean } = {}) {
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
            const actor = await pnp.getActor(canisterId, idl, { anon: false });
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

// Function to fetch user data
async function fetchUserData() {
  try {
    if (!auth.isWalletConnected()) {
      console.log("No wallet connected, setting user data to null");
      userDataStore.set(null);
      return;
    }
    
    console.log("Fetching user data with authenticated actor...");
    const actor = await auth.getActor(kongBackendCanisterId, kongBackendIDL, { anon: false });
    console.log("Got authenticated actor, fetching user...");
    const result = await actor.get_user();
    console.log("User data result:", result);
    
    if ('Ok' in result) {
      userDataStore.set(result.Ok);
    } else {
      console.log("No Ok result in response, setting user data to null");
      userDataStore.set(null);
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
    userDataStore.set(null);
  }
}


// Export the readable user store
export const userStore = {
  subscribe: userDataStore.subscribe
};
