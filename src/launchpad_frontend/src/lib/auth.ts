import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { canisterIds } from '$lib/constants';
import { idlFactory } from '../../../declarations/kong_ledger/kong_ledger.did.js';
import type { _SERVICE } from '../../../declarations/kong_ledger/kong_ledger.did.d.ts';
import { CMCCanister } from '@dfinity/cmc';
import { LedgerCanister } from '@dfinity/ledger-icp';
import { getWalletIdentity } from './utils/wallet';

// Re-export auth and related functionality from services
export { auth, backendActor, selectedWalletId, ledgerActor } from './services/auth';

// Constants for system canisters
export const CMC_CANISTER_ID = Principal.fromText("rkp4c-7iaaa-aaaaa-aaaca-cai");
const LEDGER_CANISTER_ID = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai");

// Actor cache to improve performance
const actorCache = new Map<string, any>();

// Helper to create a cache key
function createCacheKey(canisterId: string, isAnonymous: boolean): string {
  return `${canisterId}-${isAnonymous ? 'anon' : 'auth'}`;
}

// Create an HTTP agent based on environment
async function createAgent(identity?: any): Promise<HttpAgent> {
  const agent = new HttpAgent({
    host: 'https://icp0.io',
    identity
  });

  // Fetch root key when not in production
  // Note: Checking window.location.host instead of env vars for more reliable detection
  if (!window.location.host.includes('icp0.io')) {
    await agent.fetchRootKey().catch(err => {
      console.error('Error fetching root key:', err);
      throw err;
    });
  }

  return agent;
}

interface GetKongActorOptions {
  anonymous?: boolean;
  identity?: any;
  forBalanceCheck?: boolean;
}

// Generic actor creation function that supports both anonymous and authenticated actors
export async function getKongActor(options: GetKongActorOptions = {}): Promise<_SERVICE> {
  const { anonymous = false, identity, forBalanceCheck = false } = options;
  
  // For balance checks and other read-only operations, always use anonymous actor
  if (forBalanceCheck) {
    return getAnonymousKongActor();
  }
  
  const cacheKey = createCacheKey(canisterIds.kong_ledger.ic, anonymous);

  // Check cache first
  const cachedActor = actorCache.get(cacheKey);
  if (cachedActor) {
    return cachedActor;
  }

  // Create new actor if not in cache
  const agent = await createAgent(identity);
  const actor = Actor.createActor<_SERVICE>(idlFactory, {
    agent,
    canisterId: canisterIds.kong_ledger.ic,
  });

  // Cache the actor
  actorCache.set(cacheKey, actor);
  return actor;
}

// Convenience function for anonymous actor, especially for balance checks
export async function getAnonymousKongActor(): Promise<_SERVICE> {
  return getKongActor({ anonymous: true });
}

// Clear cache when needed (e.g., on disconnect)
export function clearActorCache(): void {
  actorCache.clear();
}

// Helper function specifically for balance checks
export async function getKongBalance(principal: Principal): Promise<bigint> {
  const actor = await getAnonymousKongActor();
  try {
    const balance = await actor.icrc1_balance_of({
      owner: principal,
      subaccount: []
    });
    return balance;
  } catch (error) {
    console.error('Error fetching KONG balance:', error);
    return BigInt(0);
  }
}

// Helper function to get KONG fee
export async function getKongFee(): Promise<bigint> {
  const actor = await getAnonymousKongActor();
  try {
    return await actor.icrc1_fee();
  } catch (error) {
    console.error('Error fetching KONG fee:', error);
    return BigInt(10000); // Default fee as fallback
  }
}

// Get CMC actor with proper authentication
export async function getCMCActor(pnp: any) {
  const identity = getWalletIdentity(pnp);
  
  if (!identity) {
    throw new Error("No identity found in PNP wallet");
  }

  const cacheKey = createCacheKey(CMC_CANISTER_ID.toText(), !identity);
  
  // Check cache first
  const cachedActor = actorCache.get(cacheKey);
  if (cachedActor) {
    return cachedActor;
  }

  // Create agent with identity
  const agent = new HttpAgent({
    host: 'https://icp0.io',
    identity: identity
  });

  // Create CMC actor using the official package
  const actor = CMCCanister.create({
    agent,
    canisterId: CMC_CANISTER_ID
  });

  // Cache the actor
  actorCache.set(cacheKey, actor);
  return actor;
}

// Get Ledger actor with proper authentication
export async function getLedgerActor(pnp: any) {
  const identity = getWalletIdentity(pnp);
  
  const cacheKey = createCacheKey(LEDGER_CANISTER_ID.toText(), !identity);
  
  // Check cache first
  const cachedActor = actorCache.get(cacheKey);
  if (cachedActor) {
    return cachedActor;
  }

  // Create agent with identity
  const agent = new HttpAgent({
    host: 'https://icp0.io',
    identity: identity
  });

  const actor = LedgerCanister.create({
    agent,
    canisterId: LEDGER_CANISTER_ID,
  });

  // Cache the actor
  actorCache.set(cacheKey, actor);
  return actor;
}

// Helper function to get ICP to Cycles conversion rate
export async function getIcpToCyclesConversionRate(pnp: any) {
  const cmc = await getCMCActor(pnp);
  try {
    return await cmc.getIcpToCyclesConversionRate();
  } catch (error) {
    console.error('Error fetching conversion rate:', error);
    throw error;
  }
}

// Helper function to get available subnets
export async function getAvailableSubnets(pnp: any) {
  const cmc = await getCMCActor(pnp);
  try {
    return await cmc.getSubnetList();
  } catch (error) {
    console.error('Error fetching subnet list:', error);
    throw error;
  }
}

// Types for notify create canister
interface NotifyCreateCanisterSettings {
  controllers?: Principal[];
  computeAllocation?: bigint;
  memoryAllocation?: bigint;
  freezingThreshold?: bigint;
  wasmMemoryLimit?: bigint;
  wasmMemoryThreshold?: bigint;
  reservedCyclesLimit?: bigint;
  logVisibility?: 'controllers' | 'public';
}

interface SubnetSelection {
  Subnet: {
    subnet: Principal;
  };
}

interface NotifyCreateCanisterArgs {
  blockIndex: bigint;
  controller: Principal;
  subnetType?: string;
  subnet_selection?: [SubnetSelection];
  settings?: NotifyCreateCanisterSettings;
}

// Function to notify CMC about canister creation
export async function notifyCreateCanister(
  pnp: any, 
  args: NotifyCreateCanisterArgs
): Promise<Principal> {
  const cmcActor = await getCMCActor(pnp);
  
  if (!cmcActor) {
    throw new Error('CMC Actor is not properly initialized');
  }

  // Format settings with all required fields
  const formattedSettings = args.settings ? {
    controllers: args.settings.controllers ? [args.settings.controllers] : [],
    compute_allocation: args.settings.computeAllocation ? [args.settings.computeAllocation] : [],
    memory_allocation: args.settings.memoryAllocation ? [args.settings.memoryAllocation] : [],
    freezing_threshold: args.settings.freezingThreshold ? [args.settings.freezingThreshold] : [],
    wasm_memory_limit: args.settings.wasmMemoryLimit ? [args.settings.wasmMemoryLimit] : [],
    wasm_memory_threshold: args.settings.wasmMemoryThreshold ? [args.settings.wasmMemoryThreshold] : [],
    reserved_cycles_limit: args.settings.reservedCyclesLimit ? [args.settings.reservedCyclesLimit] : [],
    log_visibility: args.settings.logVisibility ? [{[args.settings.logVisibility]: null}] : []
  } : undefined;

  const notifyArgs = {
    block_index: args.blockIndex,
    controller: args.controller,
    subnet_type: args.subnetType ? [args.subnetType] : [],
    subnet_selection: args.subnet_selection,
    settings: formattedSettings ? [formattedSettings] : []
  };

  console.log('Calling notifyCreateCanister with args:', notifyArgs);
  
  let result;
  try {
    result = await cmcActor.notifyCreateCanister(notifyArgs);
  } catch (callError) {
    console.error('Error calling notifyCreateCanister:', {
      error: callError,
      errorMessage: callError instanceof Error ? callError.message : String(callError)
    });
    throw new Error(`Failed to call CMC canister: ${callError instanceof Error ? callError.message : String(callError)}`);
  }

  if (!result) {
    console.error('Received null/undefined response from CMC');
    throw new Error('No response received from CMC canister');
  }

  console.log('Raw notifyCreateCanister response:', result);

  // Handle both variant and direct Principal response formats
  if (result instanceof Principal) {
    console.log('Successfully created canister with principal:', result.toText());
    return result;
  }
  
  if (typeof result === 'object' && 'Ok' in result) {
    console.log('Successfully created canister with principal:', result.Ok);
    return result.Ok;
  } 
  
  if (typeof result === 'object' && 'Err' in result) {
    console.error('Received error response:', result.Err);
    throw new Error(`Canister creation failed with error: ${JSON.stringify(result.Err)}`);
  }
  
  console.error('Unexpected response format. Full response:', result);
  throw new Error(`Unexpected response format. Received: ${JSON.stringify(result)}`);
} 
