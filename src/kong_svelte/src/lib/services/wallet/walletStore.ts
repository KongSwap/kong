import { get, writable, type Writable } from "svelte/store";
import { AuthClient } from "@dfinity/auth-client";
import { Principal } from "@dfinity/principal";
import {
  HttpAgent,
  Actor,
  type Identity,
  type ActorSubclass,
} from "@dfinity/agent";
import { Signer } from "@slide-computer/signer";
import { PostMessageTransport } from "@slide-computer/signer-web";
import { SignerAgent } from "@slide-computer/signer-agent";
import { PlugTransport } from "@slide-computer/signer-transport-plug";
import { WalletService } from "$lib/services/wallet/WalletService";
import { ICRC2_IDL } from "$lib/idls/icrc2.idl.js";
import { browser } from "$app/environment";
import { tokenStore } from "$lib/services/tokens/tokenStore";
import {
  canisterId as kongBackendCanisterId,
  idlFactory as kongBackendIDL,
} from "../../../../../declarations/kong_backend";
import {
  idlFactory as kongFaucetIDL,
  canisterId as kongFaucetCanisterId,
} from "../../../../../declarations/kong_faucet";
import { Ed25519KeyIdentity, DelegationIdentity } from "@dfinity/identity";
import { SignerClient } from "@slide-computer/signer-client";

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
}>({
  agent: null,
  signerAgent: null,
  account: null,
  error: null,
  isConnecting: false,
  isConnected: false,
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

export async function connectWithNFID() {
  updateWalletStore({ isConnecting: true });
  try {
    // Setup transport and signer
    const transport = new PostMessageTransport({
      url: NFID_RPC,
    });
    const signer = new Signer({ transport });

    // First get the user's account to ensure we're authenticated
    const accounts = await signer.accounts();
    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts returned from NFID");
    }
    const [account] = accounts;
    
    console.log("NFID Account:", account);
    console.log(
      "The wallet set the following permission scope:",
      await signer.permissions(),
    );

    // Create session key
    const sessionKey = Ed25519KeyIdentity.generate();
    
    // Get delegation from signer with targets and the account's principal
    const delegationChain = await signer.delegation({
      publicKey: sessionKey.getPublicKey().toDer(),
      targets: [
        Principal.fromText(kongFaucetCanisterId),
        Principal.fromText(kongBackendCanisterId),
      ],
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

    updateWalletStore({
      agent,
      account: {
        owner: account.owner, // Use the account from NFID
        subaccount: account.owner.toHex(),
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

export async function connectWithOisy() {
  updateWalletStore({ isConnecting: true });
  try {
    // Setup transport and signer
    const transport = new PostMessageTransport({
      url: OISY_RPC,
    });
    const signer = new Signer({ transport });
    const [account] = await signer.accounts();

    const keys = Ed25519KeyIdentity.generate();
    signer.delegation({
      publicKey: account.owner.toUint8Array(),
      targets: [
        Principal.fromText(kongFaucetCanisterId),
        Principal.fromText(kongBackendCanisterId),
      ],
      maxTimeToLive: BigInt(24 * 60 * 60 * 1000 * 1000 * 1000), // 24 hours
    });
    
    console.log("Oisy Account:", account);
    console.log(
      "The wallet set the following permission scope:",
      await signer.permissions(),
    );

    const agent = HttpAgent.createSync({
      host: HOST,
      identity: keys
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

    // Create signer agent
    const signerAgent = SignerAgent.createSync({
      signer,
      account: account.owner,
      agent
    });

    // Verify we're not anonymous
    console.log("Oisy Principal:", account.owner.toString());
    
    updateWalletStore({
      agent,
      signerAgent,
      account: {
        owner: account.owner,
        subaccount: account.owner.toHex(),
      },
      error: null,
      isConnecting: false,
      isConnected: true,
    });

    const user = await WalletService.getWhoami();
    userStore.set(user);
    isReady.set(true);

    localStorage.setItem("selectedWalletId", "oisy");
    selectedWalletId.set("oisy");
  } catch (error) {
    console.error("Oisy connection error:", error);
    handleConnectionError(error);
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

async function createActor(
  canisterId: string,
  idlFactory: any,
): Promise<ActorSubclass<any>> {
  const cacheKey = `${canisterId}-${idlFactory}`;
  if (actorCache[cacheKey]) {
    return actorCache[cacheKey];
  }

  const wallet = get(walletStore);
  if (!wallet.agent) {
    throw new Error("No Agent could be found. Please connect your wallet first.");
  }

  const actor = Actor.createActor(idlFactory, {
    agent: wallet.agent,
    canisterId,
  });
  actorCache[cacheKey] = actor;
  return actor;
}

export async function getActor(
  canisterId = kongBackendCanisterId,
  canisterType: CanisterType = "kong_backend",
): Promise<ActorSubclass<any>> {
  const wallet = get(walletStore);
  if (!wallet.agent || !wallet.isConnected) {
    throw new Error("No Agent could be found. Please connect your wallet first.");
  }

  const idl = canisterIDLs[canisterType];
  if (!idl) {
    throw new Error(`No IDL found for canister type: ${canisterType}`);
  }

  const actor = await createActor(canisterId, idl);

  if (canisterType === "icrc2" && !actor.icrc2_approve) {
    throw new Error("Created actor does not have ICRC2 methods");
  }

  return actor;
}

// Check if wallet is connected by checking the wallet store
export function isConnected(): boolean {
  let connected = false;
  walletStore.subscribe((store) => {
    connected = store.isConnected;
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
    connect: connectWithNFID,
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
