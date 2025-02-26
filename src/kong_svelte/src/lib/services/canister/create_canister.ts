import { Principal } from '@dfinity/principal';
import { auth } from '$lib/services/auth';
import { IcrcService } from '../icrc/IcrcService';

// Create a CUSTOM FUCKING IDL FACTORY
function createCmcIdlFactory() {
  return ({ IDL }) => {
    const SubnetFilter = IDL.Record({ subnet_type: IDL.Opt(IDL.Text) });
    const SubnetSelection = IDL.Variant({
      'Filter': IDL.Record({ filter: SubnetFilter }),
      'Subnet': IDL.Record({ subnet: IDL.Principal })
    });
    
    const CanisterSettings = IDL.Record({
      controllers: IDL.Opt(IDL.Vec(IDL.Principal)),
      compute_allocation: IDL.Opt(IDL.Nat),
      memory_allocation: IDL.Opt(IDL.Nat),
      freezing_threshold: IDL.Opt(IDL.Nat)
    });
    
    const NotifyCreateCanisterArg = IDL.Record({
      block_index: IDL.Nat64,
      controller: IDL.Principal,
      subnet_selection: IDL.Opt(IDL.Vec(SubnetSelection)),
      subnet_type: IDL.Opt(IDL.Text),
      settings: IDL.Opt(CanisterSettings)
    });
    
    const NotifyResult = IDL.Variant({
      'Ok': IDL.Principal,
      'Err': IDL.Variant({
        'Refunded': IDL.Record({ block_index: IDL.Opt(IDL.Nat64), reason: IDL.Text }),
        'InvalidTransaction': IDL.Text,
        'Other': IDL.Record({ error_message: IDL.Text, error_code: IDL.Nat }),
        'Processing': IDL.Null,
        'TransactionTooOld': IDL.Nat64
      })
    });
    
    return IDL.Service({
      'notify_create_canister': IDL.Func([NotifyCreateCanisterArg], [NotifyResult], [])
    });
  };
}

// Constants
const CMC_CANISTER_ID = "rkp4c-7iaaa-aaaaa-aaaca-cai"; // Cycles Minting Canister ID
const CREATE_CANISTER_MEMO = 1095062083n; // Memo for canister creation

export async function createCanister(args) {
  try {
    console.log('Creating a new canister with CMC...');
    
    // Ensure controller is a Principal object
    const controllerPrincipal = typeof args.controller === 'string' 
      ? Principal.fromText(args.controller) 
      : args.controller;
    
    // Transfer ICP to CMC with the CREATE_CANISTER memo
    const transferResult = await IcrcService.transferIcpToCmc(
      args.amount,
      controllerPrincipal,
      CREATE_CANISTER_MEMO
    );
    
    if ('Err' in transferResult) {
      throw new Error(`Failed to transfer ICP to CMC: ${JSON.stringify(transferResult.Err)}`);
    }
    
    // Get the block index from the successful transfer
    const blockIndex = transferResult.Ok;
    
    // Using your precious getActor with a custom IDL factory
    const cmcActor = await auth.getActor(
      CMC_CANISTER_ID,
      createCmcIdlFactory(),
      { requiresSigning: true }
    );
    
    // Format notify args
    const notifyArgs = {
      block_index: blockIndex,
      controller: controllerPrincipal,
      subnet_type: args.subnetType ? [args.subnetType] : [],
      subnet_selection: args.subnet_selection || [],
      settings: args.settings ? [args.settings] : []
    };
    
    // Call the function
    const result = await cmcActor.notify_create_canister(notifyArgs);
    
    if ('Ok' in result) {
      return result.Ok;
    } else {
      throw new Error(`CMC error: ${JSON.stringify(result.Err)}`);
    }
  } catch (error) {
    console.error('Error creating canister:', error);
    throw error;
  }
}
