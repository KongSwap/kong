import { Principal } from '@dfinity/principal';
import { CMCCanister } from '@dfinity/cmc';
import { auth } from '$lib/services/auth';

// Types for canister creation
export interface CanisterSettings {
  controllers?: Principal[];
  computeAllocation?: bigint;
  memoryAllocation?: bigint;
  freezingThreshold?: bigint;
  wasmMemoryLimit?: bigint;
  wasmMemoryThreshold?: bigint;
  reservedCyclesLimit?: bigint;
  logVisibility?: 'controllers' | 'public';
}

export interface SubnetSelection {
  Subnet: {
    subnet: Principal;
  };
}

export interface NotifyCreateCanisterArgs {
  blockIndex: bigint;
  controller: Principal;
  subnetType?: string;
  subnet_selection?: [SubnetSelection];
  settings?: CanisterSettings;
}

// CMC Canister ID
export const CMC_CANISTER_ID = "rkp4c-7iaaa-aaaaa-aaaca-cai";

// Create CMC actor with authentication
export async function getCMCActor() {
  let actor = await auth.getActor(CMC_CANISTER_ID, CMCCanister);
  return actor;
}

/**
 * Notifies the Cycles Minting Canister to create a new canister
 * 
 * @param pnp The Plug-n-Play instance
 * @param args Arguments for canister creation
 * @returns The Principal ID of the newly created canister
 */
export async function createCanister(
  pnp: any, 
  args: NotifyCreateCanisterArgs
): Promise<Principal> {
  try {
    console.log('Creating a new canister with CMC...');
    const cmcActor = await getCMCActor();
    
    if (!cmcActor) {
      throw new Error('CMC Actor is not properly initialized');
    }

    // Format settings with all required fields for the CMC canister
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

    // Format arguments for notifyCreateCanister
    const notifyArgs = {
      block_index: args.blockIndex,
      controller: args.controller,
      subnet_type: args.subnetType ? [args.subnetType] : [],
      subnet_selection: args.subnet_selection || [],
      settings: formattedSettings ? [formattedSettings] : []
    };

    console.log('Calling notifyCreateCanister with args:', notifyArgs);
    
    // Call the CMC to create the canister
    const result = await cmcActor.notifyCreateCanister(notifyArgs);

    if (!result) {
      console.error('Received null/undefined response from CMC');
      throw new Error('No response received from CMC canister');
    }

    console.log('Raw notifyCreateCanister response:', result);

    // Handle different response formats
    if (result instanceof Principal) {
      console.log('Successfully created canister with principal:', result.toText());
      return result;
    }
    
    if (typeof result === 'object' && 'Ok' in result) {
      console.log('Successfully created canister with principal:', result.Ok.toText());
      return result.Ok;
    } 
    
    if (typeof result === 'object' && 'Err' in result) {
      console.error('Received error response:', result.Err);
      throw new Error(`Canister creation failed with error: ${JSON.stringify(result.Err)}`);
    }
    
    console.error('Unexpected response format:', result);
    throw new Error(`Unexpected response format: ${JSON.stringify(result)}`);
  } catch (error) {
    console.error('Error creating canister:', error);
    throw new Error(`Failed to create canister: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Constants for canister creation
export const CREATE_CANISTER_MEMO = 1095062083n;

// Helper to get the default canister settings
export function getDefaultCanisterSettings(controller: Principal): CanisterSettings {
  return {
    controllers: [controller],
    computeAllocation: 0n,
    memoryAllocation: 0n,
    freezingThreshold: 2592000n // 30 days
  };
} 
