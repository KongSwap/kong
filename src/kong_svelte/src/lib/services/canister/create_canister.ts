import { Principal } from '@dfinity/principal';
import { auth } from '$lib/services/auth';
import { IcrcService } from '../icrc/IcrcService';
import { idlFactory as cmcIdlFactory } from '$lib/services/canister/cmc.idl';

// Constants
const CMC_CANISTER_ID = "rkp4c-7iaaa-aaaaa-aaaca-cai"; // Cycles Minting Canister ID
const CREATE_CANISTER_MEMO = 1095062083n; // Memo for canister creation

// Helper function to create a subaccount from a principal

export async function createCanister(args) {
  try {
    console.log('Creating a new canister with CMC...');
    
    // Ensure controller is a Principal object
    const controllerPrincipal = typeof args.controller === 'string' 
      ? Principal.fromText(args.controller) 
      : args.controller;
    
    console.log('Controller principal:', controllerPrincipal.toText());
    
    // Transfer ICP to CMC with the CREATE_CANISTER memo
    // The subaccount is derived from the controller principal
    const transferResult = await IcrcService.transferIcpToCmc(
      args.amount,
      controllerPrincipal,
      CREATE_CANISTER_MEMO
    );
    
    if ('Err' in transferResult) {
      throw new Error(`Failed to transfer ICP to CMC: ${JSON.stringify(transferResult.Err, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value)}`);
    }
    
    // Get the block index from the successful transfer
    const blockIndex = transferResult.Ok;
    console.log('Transfer successful, block index:', blockIndex.toString());
    
    // Use the imported CMC IDL factory
    const cmcActor = await auth.getActor(
      CMC_CANISTER_ID,
      cmcIdlFactory,
      { requiresSigning: true }
    );
    
    // Ensure settings has all required fields
    // TODO! figure this out, whats best practice etc
    const completeSettings = {
      controllers: args.settings?.controllers ? [args.settings.controllers] : [],
      freezing_threshold: args.settings?.freezing_threshold || [],
      memory_allocation: args.settings?.memory_allocation || [],
      compute_allocation: args.settings?.compute_allocation || [],
      wasm_memory_threshold: args.settings?.wasm_memory_threshold || [],
      reserved_cycles_limit: args.settings?.reserved_cycles_limit || [],
      log_visibility: args.settings?.log_visibility || [],
      wasm_memory_limit: args.settings?.wasm_memory_limit || []
    };
    
    // Prepare subnet selection if subnet_id is provided
    let subnet_selection = [];
    if (args.subnet_id) {
      console.log('Using subnet ID for subnet selection:', args.subnet_id);
      try {
        const subnetPrincipal = Principal.fromText(args.subnet_id);
        subnet_selection = [{
          Subnet: {
            subnet: subnetPrincipal
          }
        }];
        console.log('Subnet selection created successfully:', subnet_selection);
      } catch (error) {
        console.error('Error creating subnet selection:', error);
        throw new Error(`Invalid subnet ID: ${args.subnet_id}`);
      }
    }
    
    // Format notify args
    const notifyArgs = {
      block_index: blockIndex,
      controller: controllerPrincipal,
      subnet_type: args.subnetType ? [args.subnetType] : [],
      subnet_selection: subnet_selection,
      settings: [completeSettings]
    };
    
    // Log the complete notify args for debugging
    console.log('Notify args:', JSON.stringify(notifyArgs, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value));
    
    // Call the function
    const result = await cmcActor.notify_create_canister(notifyArgs);
    
    if ('Ok' in result) {
      return result.Ok;
    } else {
      throw new Error(`CMC error: ${JSON.stringify(result.Err, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value)}`);
    }
  } catch (error) {
    console.error('Error creating canister:', error);
    throw error;
  }
}
