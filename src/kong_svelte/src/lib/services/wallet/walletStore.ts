import { get, writable, type Writable } from "svelte/store";
import { AuthClient } from "@dfinity/auth-client";
import { Principal } from "@dfinity/principal";
import { Ed25519KeyIdentity, DelegationIdentity } from "@dfinity/identity";
import { HttpAgent, Actor, type Identity, type ActorSubclass } from "@dfinity/agent";
import { Signer } from "@slide-computer/signer";
import { PostMessageTransport } from "@slide-computer/signer-web";
import { SignerAgent } from "@slide-computer/signer-agent";
import { PlugTransport } from "@slide-computer/signer-transport-plug";
import { WalletService } from "$lib/services/wallet/WalletService";
import { ICRC2_IDL } from "$lib/idls/icrc2.idl.js";
import { browser } from "$app/environment";
import { tokenStore } from "$lib/services/tokens/tokenStore";
import {
  idlFactory as kongBackendIDL,
  canisterId as kongBackendCanisterId,
} from "../../../../../declarations/kong_backend";
import {
  idlFactory as kongFaucetIDL,
  canisterId as kongFaucetCanisterId,
} from "../../../../../declarations/kong_faucet";

// Constants
export const DEV = process.env.DFX_NETWORK === "local";
export const HOST = DEV ? "http://localhost:4943" : "https://ic0.app";
const DAPP_DERIVATION_ORIGIN = DEV
  ? "http://localhost:5173"
  : "https://n3i53-gyaaa-aaaam-acfaq-cai.icp0.io";
const IDENTITY_PROVIDER = DEV
  ? `http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943`
  : "https://identity.ic0.app";
const AUTH_MAX_TIME_TO_LIVE = BigInt(60 * 60 * 1000 * 1000 * 1000); // 1 hour in nanoseconds
export const NFID_RPC = "https://nfid.one/rpc" as const;
export const OISY_RPC = "https://oisy.com/sign" as const;

// IDL Mappings
export type CanisterType = "kong_backend" | "icrc1" | "icrc2" | "kong_faucet";
export const canisterIDLs = {
  kong_backend: kongBackendIDL,
  kong_faucet: kongFaucetIDL,
  icrc1: ICRC2_IDL,
  icrc2: ICRC2_IDL,
};

const httpAgent = HttpAgent.createSync({
  host: HOST,
})

if(DEV) {
  try {
    httpAgent.fetchRootKey().catch((err) => {
      console.warn(
        "Unable to fetch root key. Check to ensure that your local replica is running",
      );
      console.error(err);
    });
  } catch (error) {
    console.warn(
      "Continuing without fetching root key. This is expected in local development.",
    );
  }
}

// Stores
export const selectedWalletId = writable<string>("");
export const isReady = writable<boolean>(false);
export const userStore: Writable<any> = writable(null);
export const walletStore = writable<{
  agent: HttpAgent | null,
  signerAgent: SignerAgent<any> | null,
  account: any | null;
  error: Error | null;
  isConnecting: boolean;
  isConnected: boolean;
  count: number
}>({
  agent: httpAgent,
  signerAgent: null,
  account: null,
  error: null,
  isConnecting: false,
  isConnected: false,
  count: 0
});

let actorCache: { [key: string]: Actor } = {};

// Update wallet store
function updateWalletStore(
  updates: Partial<{
    agent: any;
    signerAgent: any;
    account: any | null;
    error: Error | null;
    isConnecting: boolean;
    isConnected: boolean;
    count: number
    
  }>,
) {
  walletStore.update((store) => ({ ...store, ...updates }));
}

// Handle connection errors
function handleConnectionError(error: Error) {
  updateWalletStore({ error, isConnecting: false });
  console.error("Error:", error);
}

export async function connectWithInternetIdentity() {
  updateWalletStore({ isConnecting: true });
  try {
    const authClient = await AuthClient.create();

    if (await authClient.isAuthenticated()) {
      const identity = authClient.getIdentity();
      const agent = HttpAgent.createSync({
        host: HOST,
        identity,
        verifyQuerySignatures: false, // Required for local development
      });

      if (DEV) {
        try {
          await agent.fetchRootKey().catch((err) => {
            console.warn(
              "Unable to fetch root key. Check to ensure that your local replica is running",
            );
            console.error(err);
          });
        } catch (error) {
          console.warn(
            "Continuing without fetching root key. This is expected in local development.",
          );
        }
      }

      updateWalletStore({
        agent,
        account: {
          owner: identity.getPrincipal(),
          subaccount: identity.getPrincipal().toHex(),
        },
        error: null,
        isConnecting: false,
        isConnected: true,
      });

      const user = await WalletService.getWhoami();
      userStore.set(user);
      isReady.set(true);

      localStorage.setItem("selectedWalletId", "ii");
      selectedWalletId.set("ii");
    } else {
      await authClient.login({
        maxTimeToLive: AUTH_MAX_TIME_TO_LIVE,
        allowPinAuthentication: true,
        derivationOrigin: DAPP_DERIVATION_ORIGIN,
        identityProvider: IDENTITY_PROVIDER,
        onSuccess: async () => {
          const identity = authClient.getIdentity();
          const agent = HttpAgent.createSync({
            host: HOST,
            identity,
            verifyQuerySignatures: false, // Required for local development
          });

          if (DEV) {
            try {
              await agent.fetchRootKey().catch((err) => {
                console.warn(
                  "Unable to fetch root key. Check to ensure that your local replica is running",
                );
                console.error(err);
              });
            } catch (error) {
              console.warn(
                "Continuing without fetching root key. This is expected in local development.",
              );
            }
          }

          updateWalletStore({
            agent,
            account: {
              owner: identity.getPrincipal(),
              subaccount: identity.getPrincipal().toHex(),
            },
            error: null,
            isConnecting: false,
            isConnected: true,
          });

          const user = await WalletService.getWhoami();
          userStore.set(user);
          isReady.set(true);

          localStorage.setItem("selectedWalletId", "ii");
          selectedWalletId.set("ii");
        },
        onError: (error) => {
          console.error("Error:", error);
        },
      });
    }
  } catch (error) {
    handleConnectionError(error);
  }
}

export async function connectWithNFID(wallet: 'plug' | 'nfid') {
  updateWalletStore({ isConnecting: true, count: get(walletStore).count + 1 });
  console.log(get(walletStore).count);
  try {
    console.log("WALLET", wallet);
    // Setup transport and signer
    const transport = wallet === 'plug' ? new PlugTransport() : new PostMessageTransport({
      url: NFID_RPC,
    });
    const signer = new Signer({ transport });

    // First get the user's account to ensure we're authenticated
    // const accounts = await signer.accounts();

    // Create session key
    const sessionKey = Ed25519KeyIdentity.generate();
    
    // Get delegation from signer with targets and the account's principal
    const delegationChain = await signer.delegation({
      publicKey: sessionKey.getPublicKey().toDer(),
      maxTimeToLive: BigInt(24 * 60 * 60 * 1000 * 1000 * 1000), // 24 hours
    });

    // Create delegation identity
    const delegationIdentity = DelegationIdentity.fromDelegation(
      sessionKey,
      delegationChain,
    );

    // Create agent with delegation identity
    const agent = HttpAgent.createSync({
      host: HOST,
      identity: delegationIdentity,
    });

    if (DEV) {
      try {
        await agent.fetchRootKey().catch((err) => {
          console.warn(
            "Unable to fetch root key. Check to ensure that your local replica is running",
          );
          console.error(err);
        });
      } catch (error) {
        console.warn(
          "Continuing without fetching root key. This is expected in local development.",
        );
      }
    }

    // Verify we're not anonymous
    const principal = await agent.getPrincipal();
    console.log("NFID Principal:", delegationIdentity.getPrincipal().toString());
    if (principal.isAnonymous()) {
      throw new Error("Failed to authenticate with NFID - got anonymous principal");
    }
    
    console.log("Connected with principal:", principal.toString());

    const signerAgent = SignerAgent.createSync({
      signer,
      account: await agent.getPrincipal(),
    });

    updateWalletStore({
      agent,
      signerAgent,
      account: {
        owner: await agent.getPrincipal(), // Use the account from NFID
        subaccount: (await agent.getPrincipal()).toHex(),
      },
      error: null,
      isConnecting: false,
      isConnected: true,
    });

    const user = await WalletService.getWhoami();
    userStore.set(user);
    isReady.set(true);

    localStorage.setItem("selectedWalletId", "nfid");
    selectedWalletId.set("nfid");
  } catch (error) {
    console.error("NFID connection error:", error);
    handleConnectionError(error);
  }
}

const createDelegationPermissionScope = () => {
  return {
    method: "icrc34_delegation",
    targets: [kongBackendCanisterId.toString(), kongFaucetCanisterId.toString()] // optional array of Principal targets
  };
};

const createAccountsPermissionScope = () => {
  return {
    method: "icrc27_accounts"
  };
};

const createCallCanisterPermissionScope = () => {
  return {
    method: "icrc49_call_canister"
  };
};

// Track last connection attempt and transport
let lastConnectionAttempt = 0;
const CONNECTION_COOLDOWN = 3000; // 3 seconds
let activeTransport: any | null = null; // Change type to any since PostMessageTransport doesn't expose disconnect
let isInitializing = false;

// Track agents
let anonymousAgent: HttpAgent | null = null;

export async function getAnonymousAgent(): Promise<HttpAgent> {
  if (!anonymousAgent) {
    anonymousAgent = new HttpAgent({
      host: HOST
    });

    if (DEV) {
      try {
        await anonymousAgent.fetchRootKey();
      } catch (error) {
        console.warn(
          "Continuing without fetching root key for anonymous agent. This is expected in local development.",
        );
      }
    }
  }
  return anonymousAgent;
}

// Queue for managing signature requests
class SignatureQueue {
  private queue: Array<() => Promise<any>> = [];
  private isProcessing = false;

  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    try {
      const request = this.queue.shift();
      if (request) {
        await request();
      }
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        // Process next request after a small delay
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }

  clear() {
    this.queue = [];
    this.isProcessing = false;
  }
}

const signatureQueue = new SignatureQueue();

// Export for use in other services
export const queueSignatureRequest = <T>(request: () => Promise<T>): Promise<T> => {
  return signatureQueue.add(request);
};

export async function connectWithOisy() {
  // Prevent rapid successive connection attempts
  const now = Date.now();
  if (now - lastConnectionAttempt < CONNECTION_COOLDOWN) {
    console.log("Please wait before trying to connect again");
    return;
  }
  lastConnectionAttempt = now;

  try {
    // Check if already connecting or connected
    const currentState = get(walletStore);
    if (currentState.isConnecting || currentState.isConnected || isInitializing) {
      console.log("Connection already in progress or already connected");
      return;
    }

    isInitializing = true;

    // Clean up any existing transport
    if (activeTransport) {
      try {
        activeTransport.disconnect();
      } catch (e) {
        console.warn("Error disconnecting existing transport:", e);
      }
      activeTransport = null;
    }

    updateWalletStore({ 
      isConnecting: true,
      isConnected: false,
      error: null,
      agent: null,
      account: null
    });
    
    // Create transport for OISY with proper window opening
    activeTransport = new PostMessageTransport({
      url: OISY_RPC,

    });

    const signer = new Signer({ transport: activeTransport });

    // Request permissions with timeout
    const permissionPromise = signer.requestPermissions([
      createAccountsPermissionScope(),
      createDelegationPermissionScope(),
      createCallCanisterPermissionScope()
    ]);

    const permissions = await Promise.race([
      permissionPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Permission request timed out")), 120000)
      )
    ]);

    console.log("OISY Permissions:", permissions);
    // Get accounts only after permissions are granted
    const accounts = await signer.accounts();
    if (!accounts.length) {
      throw new Error("No accounts returned from OISY");
    }
    const [account] = accounts;
    
    console.log("OISY Account:", account);

    // Create signer agent for direct canister calls
    const signerAgent = SignerAgent.createSync({
      signer,
      account: account.owner,
    });

    const anonAgent = await getAnonymousAgent();
    if (DEV) {
      try {
        await signerAgent.fetchRootKey().catch((err) => {
          console.warn(
            "Unable to fetch root key. Check to ensure that your local replica is running",
          );
          console.error(err);
        });
      } catch (error) {
        console.warn(
          "Continuing without fetching root key. This is expected in local development.",
        );
      }
    }

    // Verify we're not anonymous
    const principal = await signerAgent.getPrincipal();
    console.log("OISY Principal:", principal.toString());
    if (principal.isAnonymous()) {
      throw new Error("Failed to authenticate with OISY - got anonymous principal");
    }
    
    console.log("Connected with principal:", principal.toString());

    // Update wallet store with connected state
    updateWalletStore({
      agent: anonAgent,
      signerAgent,
      account,
      isConnecting: false,
      isConnected: true,
      error: null,
    });

    // Wait a bit before allowing subsequent operations
    await new Promise(resolve => setTimeout(resolve, 1000));
    isInitializing = false;

    const user = await WalletService.getWhoami();
          userStore.set(user);
          isReady.set(true);


  } catch (error) {
    console.error("Error connecting with OISY:", error);
    handleConnectionError(error);
    isInitializing = false;
    if (activeTransport) {
      try {
        activeTransport.disconnect();
      } catch (e) {
        console.warn("Error disconnecting transport after error:", e);
      }
      activeTransport = null;
    }
  }
}

export async function disconnectWallet() {
  try {
    const authClient = await AuthClient.create();
    await authClient.logout();

    updateWalletStore({
      agent: null,
      account: null,
      error: null,
      isConnecting: false,
      isConnected: false,
    });
    tokenStore.clearUserData();
    localStorage.removeItem("selectedWalletId");
    selectedWalletId.set("");
    isReady.set(false);
    userStore.set(null);
    actorCache = {}; // Clear actor cache on disconnect
  } catch (error) {
    handleConnectionError(error);
  }
}

export async function restoreWalletConnection() {
  if (browser) {
    const storedWalletId = localStorage.getItem("selectedWalletId");
    if (!storedWalletId) return;

    updateWalletStore({ isConnecting: true });
    selectedWalletId.set(storedWalletId);

    try {
      if (storedWalletId === "ii") {
        await connectWithInternetIdentity();
      } else if (storedWalletId === "nfid") {
        await connectWithNFID();
      } else if (storedWalletId === "oisy") {
        await connectWithOisy();
      }
    } catch (error) {
      localStorage.removeItem("selectedWalletId");
      handleConnectionError(error);
    }
  }
}

export type WalletAgent = HttpAgent | SignerAgent<any>;

async function createActor(
  canisterId: string,
  idlFactory: any,
  agent?: HttpAgent | SignerAgent<any> // Optional agent parameter
): Promise<ActorSubclass<any>> {
  const store = get(walletStore);
  const effectiveAgent = agent || store.agent;
  
  if (!effectiveAgent) {
    throw new Error("No agent available");
  }

  return Actor.createActor(idlFactory, {
    agent: effectiveAgent,
    canisterId,
  });
}

export async function getActor(
  canisterId = kongBackendCanisterId,
  canisterType: CanisterType = "kong_backend",
  requiresSigning = false // New parameter to determine if we need signing capabilities
): Promise<ActorSubclass<any>> {
  const store = get(walletStore);
  
  let agent: HttpAgent | SignerAgent<any> | null = store.agent;
  
  if (requiresSigning) {
    // For operations requiring signing, use the signer agent
    agent = store.signerAgent;
    if (!agent) {
      throw new Error("No signing agent available. Please connect your wallet.");
    }
  } else {
    // For read operations, try wallet agent first, then fall back to anonymous
    agent = store.agent;

    if (!agent) {
      agent = await getAnonymousAgent();
    }
  }

  if(DEV){
    await agent.fetchRootKey()
  }

  const actor = await createActor(canisterId, canisterIDLs[canisterType], agent);
  return actor;
}

// Check if wallet is connected by checking the wallet store
export function isConnected(): boolean {
  let connected = false;
  walletStore.subscribe((store) => {
    connected = store?.account?.owner !== null;
  })();
  return connected;
}

// Available wallets configuration
export const availableWallets = [
  {
    id: "ii",
    name: "Internet Identity",
    icon: "/images/wallets/internet-identity.svg",
    connect: connectWithInternetIdentity,
  },
  {
    id: "nfid",
    name: "NFID",
    icon: "/images/wallets/nfid.svg",
    connect: () =>  connectWithNFID('nfid'),
  },
  {
    id: "plug",
    name: "Plug",
    icon: "/images/wallets/plug.svg",
    connect: () => connectWithNFID('plug'),
  },
  {
    id: "oisy",
    name: "Oisy",
    icon: "/images/wallets/oisy.svg",
    connect: connectWithOisy,
  },
];

// Connect to a wallet
export async function connectWallet(walletId: string) {
  const wallet = availableWallets.find((w) => w.id === walletId);
  if (!wallet) {
    throw new Error(`Wallet ${walletId} not found`);
  }

  await wallet.connect();
}
