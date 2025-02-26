import { Principal } from '@dfinity/principal';
import { HttpAgent } from '@dfinity/agent';
import { CMCCanister } from '@dfinity/cmc';
import { auth } from '$lib/services/auth';

// CMC Canister ID
export const CMC_CANISTER_ID = Principal.fromText("rkp4c-7iaaa-aaaaa-aaaca-cai");

/**
 * Returns default canister settings with the provided controller
 * 
 * @param controller The principal to set as controller
 * @returns Default canister settings object
 */
export function getDefaultCanisterSettings(controller) {
  return {
    controllers: [controller],
    freezing_threshold: 2_592_000n,
    memory_allocation: 0n,
    compute_allocation: 0n
  };
}

/**
 * Notifies the Cycles Minting Canister to create a new canister
 * 
 * @param args Arguments for canister creation
 * @returns The Principal ID of the newly created canister
 */
export async function createCanister(args) {
  try {
    console.log('Creating a new canister with CMC...');
    
    // Get identity from your auth service
    if (!auth.pnp || !auth.pnp.isWalletConnected()) {
      throw new Error('Wallet not connected');
    }
    
    const identity = auth.pnp.activeWallet.identity;
    
    if (!identity) {
      throw new Error('No identity found. Please reconnect your wallet.');
    }
    
    // Create agent
    const agent = new HttpAgent({
      host: "https://icp0.io",
      identity
    });
    
    // Ensure controller is a Principal object
    const controllerPrincipal = typeof args.controller === 'string' 
      ? Principal.fromText(args.controller) 
      : args.controller;
    
    // Create CMC instance
    const cmc = CMCCanister.create({
      agent,
      canisterId: CMC_CANISTER_ID,
    });
    
    const notifyArgs = {
      block_index: args.blockIndex,
      controller: controllerPrincipal,
      subnet_type: args.subnetType || undefined,
      subnet_selection: args.subnet_selection && args.subnet_selection.length > 0 
        ? args.subnet_selection[0]
        : undefined,
      settings: args.settings || undefined,
    };
    
    console.log('Calling notifyCreateCanister with args:', JSON.stringify(notifyArgs, (_, v) => 
      typeof v === 'bigint' ? v.toString() : v instanceof Principal ? v.toText() : v
    ));
    
    // The CMC package handles all the array wrapping internally based on the IDL
    const canisterId = await cmc.notifyCreateCanister(notifyArgs);
    console.log('Successfully created canister with ID:', canisterId.toText());
    return canisterId;
  } catch (error) {
    console.error('Error creating canister:', error);
    throw new Error(`Failed to create canister: ${error instanceof Error ? error.message : String(error)}`);
  }
}
