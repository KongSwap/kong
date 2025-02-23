// src/launchpad_frontend/src/lib/services/auth.ts

import { writable, get } from "svelte/store";
import { Principal } from "@dfinity/principal";
import { createPNP, type PNP } from "@windoge98/plug-n-play";
import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory as launchpadBackendIDL } from "../../../../declarations/launchpad_backend";
import { idlFactory as ledgerIDL } from "../../../../declarations/icp_ledger";
import { idlFactory as kongLedgerIDL } from "../../../../declarations/kong_ledger";
import type { _SERVICE as KongLedgerService } from "../../../../declarations/kong_ledger/kong_ledger.did";
import { idlFactory as kongBackendIDL } from "../../../../declarations/kong_backend";
import type { ActorSubclass } from "@dfinity/agent";
import { getWalletIdentity } from "../utils/wallet";
import type { _SERVICE as KongBackendService } from "../../../../declarations/kong_backend/kong_backend.did";
import { ICManagementCanister } from "@dfinity/ic-management";

// Production canister IDs
export const LAUNCHPAD_BACKEND_CANISTER_ID = "pdisl-kiaaa-aaaag-atzwa-cai";
export const ICP_LEDGER_CANISTER_ID = "ryjl3-tyaaa-aaaaa-aaaba-cai";
export const KONG_LEDGER_CANISTER_ID = "o7oak-iyaaa-aaaaq-aadzq-cai";
export const CMC_CANISTER_ID = "rkp4c-7iaaa-aaaaa-aaaca-cai";
export const KONG_BACKEND_CANISTER_ID = "2ipq2-uqaaa-aaaar-qailq-cai";

// Stores
export const selectedWalletId = writable<string | null>(null);
export const backendActor = writable<any>(null);
export const ledgerActor = writable<any>(null);

// Auth state interface
interface AuthState {
  isConnected: boolean;
  account: {
    owner: Principal;
    subaccount?: Uint8Array;
  } | null;
  isInitialized: boolean;
}

// Balance checking cache
let ledgerActorCache: any = null;

// PnP singleton
let globalPnp: PNP | null = null;

// Add ICPRecipient type
export interface ICPRecipient {
  owner: Principal;
  subaccount?: number[];
}

// Remove the manual KongLedgerActor type and use the auto-generated one
export type KongLedgerActor = ActorSubclass<KongLedgerService>;

// Kong actor cache
let kongActorCache: KongLedgerActor | null = null;

// Add KongBackendActor type
export type KongBackendActor = ActorSubclass<KongBackendService>;

// Add kong actor cache
let kongBackendActorCache: KongBackendActor | null = null;

// Enhanced actor cache system
interface ActorCacheEntry {
  actor: any;
  timestamp: number;
}

const actorCache = new Map<string, ActorCacheEntry>();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour cache duration

function createCacheKey(canisterId: string, idl: any, isAnonymous: boolean): string {
  return `${canisterId}-${idl.name}-${isAnonymous ? 'anon' : 'auth'}`;
}

function initializePNP(): PNP {
  if (globalPnp) return globalPnp;

  const isDev = process.env.DFX_NETWORK === "local" || window.location.hostname === "localhost";
  
  // Determine the correct derivation origin based on environment
  const derivationOrigin = isDev 
    ? "http://localhost:3000"
    : `https://${process.env.CANISTER_ID_LAUNCHPAD_FRONTEND}.icp0.io`;

  const config = {
    hostUrl: isDev ? "http://localhost:4943" : "https://icp0.io",
    isDev,
    whitelist: [LAUNCHPAD_BACKEND_CANISTER_ID, KONG_LEDGER_CANISTER_ID, CMC_CANISTER_ID],
    fetchRootKeys: isDev,
    timeout: 1000 * 60 * 60 * 4, // 4 hours
    verifyQuerySignatures: !isDev,
    identityProvider: isDev
      ? "http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943"
      : "https://identity.ic0.app",
    persistSession: true,
    derivationOrigin,
    delegationTargets: [
      Principal.fromText(LAUNCHPAD_BACKEND_CANISTER_ID),
      Principal.fromText(KONG_LEDGER_CANISTER_ID),
      Principal.fromText(CMC_CANISTER_ID),
      Principal.fromText(ICP_LEDGER_CANISTER_ID),
      Principal.fromText(KONG_BACKEND_CANISTER_ID),
      Principal.fromText('aaaaa-aa') // Add IC Management Canister
    ],
  };

  try {
    globalPnp = createPNP(config);
    return globalPnp;
  } catch (error) {
    console.error('Failed to initialize PNP:', error);
    throw error;
  }
}

// Enhanced anonymous actor creation with caching
export async function getAnonymousActor(canisterId: string, idl: any) {
  const cacheKey = createCacheKey(canisterId, idl, true);
  const cached = actorCache.get(cacheKey);
  
  // Return cached actor if still valid
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return cached.actor;
  }
  
  const agent = new HttpAgent({
    host: process.env.DFX_NETWORK === "local" ? "http://localhost:4943" : "https://icp0.io",
  });
  
  if (process.env.DFX_NETWORK === "local") {
    await agent.fetchRootKey();
  }

  const actor = Actor.createActor(idl, {
    agent,
    canisterId,
  });
  
  // Cache the new actor
  actorCache.set(cacheKey, {
    actor,
    timestamp: Date.now()
  });
  
  return actor;
}

// Get authenticated actor with proper caching
async function getAuthenticatedActor(canisterId: string, idl: any, options: {
  anon?: boolean;
  requiresSigning?: boolean;
} = {}) {
  const pnp = globalPnp || initializePNP();
  
  // For operations requiring signing, ensure wallet is connected
  if (!options.anon && options.requiresSigning) {
    if (!pnp.isWalletConnected()) {
      throw new Error('Wallet connection required for this operation');
    }

    const identity = getWalletIdentity(pnp);
    if (!identity) {
      throw new Error('No identity found. Please reconnect your wallet.');
    }

    // Always request permissions for ICP ledger operations
    if (canisterId === ICP_LEDGER_CANISTER_ID) {
      return pnp.getActor(canisterId, idl, {
        requestPermissions: true,
        delegationTargets: [Principal.fromText(canisterId)]
      });
    }

    // Special handling for Kong Backend canister
    if (canisterId === KONG_BACKEND_CANISTER_ID) {
      return pnp.getActor(canisterId, idl, {
        delegationTargets: [Principal.fromText(canisterId)]
      });
    }

    // Special handling for Kong Ledger canister
    if (canisterId === KONG_LEDGER_CANISTER_ID) {
      return pnp.getActor(canisterId, idl, {
        delegationTargets: [Principal.fromText(canisterId)]
      });
    }

    // For other canisters
    return pnp.getActor(canisterId, idl);
  }

  // For non-signing operations, use anonymous actor
  return getAnonymousActor(canisterId, idl);
}

// Anonymous actor creation for read-only operations
export async function getAnonymousBackendActor() {
  const agent = new HttpAgent({
    host: process.env.DFX_NETWORK === "local" ? "http://localhost:4943" : "https://icp0.io"
  });

  if (process.env.DFX_NETWORK === "local") {
    await agent.fetchRootKey();
  }

  return Actor.createActor(launchpadBackendIDL, {
    agent,
    canisterId: LAUNCHPAD_BACKEND_CANISTER_ID
  });
}

// Enhanced balance checking functionality
export async function getLedgerActorForBalanceChecks() {
  return getAnonymousActor(ICP_LEDGER_CANISTER_ID, ledgerIDL);
}

export async function getSubAccountBalance(principal: Principal): Promise<bigint> {
  const subaccount = getSubAccount(principal);
  const ledger = await getLedgerActorForBalanceChecks();
  
  try {
    // Use icrc1_balance_of as per the standard interface
    const balance = await ledger.icrc1_balance_of({
      owner: principal,
      subaccount: [subaccount]
    });
    return balance;
  } catch (error) {
    console.error('Failed to fetch subaccount balance:', error);
    return 0n;
  }
}

// Enhanced getActor helper
async function getActor(canisterId: string, idl: any, options: { 
  anonymous?: boolean;
  requiresSigning?: boolean;
} = {}) {
  // Always use anonymous actor for non-signing operations
  if (options.anonymous || !options.requiresSigning) {
    return getAnonymousActor(canisterId, idl);
  }
  
  // For operations requiring signing, ensure wallet is connected
  const pnp = globalPnp || initializePNP();
  if (!pnp.isWalletConnected()) {
    throw new Error('Wallet connection required for this operation');
  }
  
  // Special handling for Kong Backend canister
  if (canisterId === KONG_BACKEND_CANISTER_ID) {
    return pnp.getActor(canisterId, idl, {
      delegationTargets: [Principal.fromText(canisterId)]
    });
  }

  // Special handling for Kong Ledger canister
  if (canisterId === KONG_LEDGER_CANISTER_ID) {
    return pnp.getActor(canisterId, idl, {
      delegationTargets: [Principal.fromText(canisterId)]
    });
  }
  
  return getAuthenticatedActor(canisterId, idl);
}

// Auth store creation
function createAuthStore(pnp: PNP) {
  const { subscribe, set } = writable<AuthState>({
    isConnected: false,
    account: null,
    isInitialized: false
  });

  return {
    subscribe,
    pnp,

    async connect(walletId: string) {
      try {
        console.log('Attempting to connect wallet:', walletId);
        
        // Connect wallet
        const result = await pnp.connect(walletId, true);
        console.log('Connection result:', result);
        
        if (!result) {
          throw new Error("No connection result received");
        }
        
        if (!result.owner) {
          console.error('Invalid connection result:', result);
          throw new Error("Invalid connection result: missing owner property");
        }

        // Update auth state
        const newState = { 
          isConnected: true, 
          account: result,
          isInitialized: true
        };
        console.log('Setting new auth state:', newState);
        set(newState);

        // Initialize actors
        console.log('Initializing actors...');
        const actor = await getAuthenticatedActor(LAUNCHPAD_BACKEND_CANISTER_ID, launchpadBackendIDL);
        const ledger = await getAuthenticatedActor(ICP_LEDGER_CANISTER_ID, ledgerIDL);
        
        console.log('Setting actors in store...');
        backendActor.set(actor);
        ledgerActor.set(ledger);
        ledgerActorCache = ledger; // Update cache
        
        return result;
      } catch (error) {
        console.error("Connection failed:", error);
        // Add more detailed error information
        const errorDetails = {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          walletId,
          pnpState: {
            isInitialized: !!globalPnp,
            isConnected: globalPnp?.isWalletConnected?.()
          }
        };
        console.error('Error details:', errorDetails);
        
        await this.disconnect();
        throw error;
      }
    },

    async disconnect() {
      try {
        await pnp.disconnect();
        set({ isConnected: false, account: null, isInitialized: true });
        backendActor.set(null);
        ledgerActor.set(null);
        selectedWalletId.set(null);
        clearActorCache(); // Use new clearActorCache helper
      } catch (error) {
        console.error('Disconnect error:', error);
        throw error;
      }
    },

    // Enhanced getActor method
    async getActor(canisterId: string, idl: any, options: { 
      anonymous?: boolean;
      requiresSigning?: boolean;
    } = {}) {
      return getActor(canisterId, idl, options);
    }
  };
}

// Initialize and export auth store
const pnp = initializePNP();
export const auth = createAuthStore(pnp);

// Update send_icp to ensure we get permission popup
export async function send_icp(recipient: ICPRecipient, amount: bigint): Promise<Result<bigint>> {
  try {
    const authenticatedLedger = await getAuthenticatedActor(ICP_LEDGER_CANISTER_ID, ledgerIDL, {
      anon: false,
      requiresSigning: true
    });

    // Convert subaccount to proper format if it exists
    const subaccount = recipient.subaccount ? recipient.subaccount : [];

    const result = await authenticatedLedger.icrc1_transfer({
      to: {
        owner: recipient.owner,
        subaccount: subaccount  // Don't wrap in another array
      },
      amount,
      fee: [BigInt(10000)],
      memo: [],
      from_subaccount: [],
      created_at_time: []
    });
    
    return { Ok: amount };
  } catch (error: any) {
    console.error('Error sending ICP:', error);
    return { Err: typeof error === 'object' && error !== null ? error.message || 'Unknown error' : String(error) };
  }
}

// Helper for subaccount creation if needed
export function getSubAccount(principal: Principal): number[] {
  const bytes = principal.toUint8Array();
  const subaccount = new Uint8Array(32);
  subaccount[0] = bytes.length;
  subaccount.set(bytes, 1);
  // Convert Uint8Array to number[]
  return Array.from(subaccount);
}

// Enhanced Kong balance checking
export async function getKongActorForBalanceChecks() {
  return getAnonymousActor(KONG_LEDGER_CANISTER_ID, kongLedgerIDL);
}

// Get Kong actor with proper anonymous/authenticated handling
export async function getKongActor(options: { 
  anonymous?: boolean;
  requiresSigning?: boolean;
} = {}): Promise<KongLedgerActor> {
  // Only require signing for state-changing operations
  const requiresSigning = options.requiresSigning ?? false;
  return getActor(KONG_LEDGER_CANISTER_ID, kongLedgerIDL, { 
    anonymous: options.anonymous,
    requiresSigning,
  }) as Promise<KongLedgerActor>;
}

// Get Kong Backend actor with proper anonymous/authenticated handling
export async function getKongBackendActor(options: { 
  anonymous?: boolean;
  requiresSigning?: boolean;
} = {}): Promise<KongBackendActor> {
  // Only require signing for state-changing operations
  const requiresSigning = options.requiresSigning ?? false;
  return getActor(KONG_BACKEND_CANISTER_ID, kongBackendIDL, { 
    anonymous: options.anonymous,
    requiresSigning 
  }) as Promise<KongBackendActor>;
}

// Clear cache helper
export function clearActorCache(): void {
  actorCache.clear();
  ledgerActorCache = null;
  kongActorCache = null;
  kongBackendActorCache = null;
}

// Cached instance for the IC Management Canister actor
let icManagementActor: ReturnType<typeof ICManagementCanister.create> | null = null;

/**
 * Returns an authenticated, cached actor for the IC Management Canister.
 * Requires the user to be logged in so that their wallet identity is used.
 */
export async function getICManagementActor() {
  const pnp = globalPnp || initializePNP();
  const identity = getWalletIdentity(pnp);
  if (!identity) {
    throw new Error("Authentication required. Please log in to a wallet before using the management canister.");
  }

  // Return the cached actor if it exists
  if (icManagementActor) {
    return icManagementActor;
  }

  // Create a new HTTP agent using the authenticated identity
  const agent = new HttpAgent({
    identity,
    host: process.env.DFX_NETWORK === "local" ? "http://localhost:4943" : "https://icp0.io",
  });

  // In local development, you must fetch the root key
  if (process.env.DFX_NETWORK === "local") {
    await agent.fetchRootKey();
  }

  // Create the IC Management actor using the @dfinity/ic-management package
  icManagementActor = ICManagementCanister.create({ agent });

  return icManagementActor;
}
