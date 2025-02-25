import { Principal } from '@dfinity/principal';
import { Actor, HttpAgent } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
import { managementCanisterIdl } from '../idls/management.did';

// Interface for the IC Management Canister
export interface ManagementCanister {
  install_code: (args: {
    mode: { install: null } | { reinstall: null } | { upgrade: null };
    canister_id: Principal;
    wasm_module: Uint8Array;
    arg: Uint8Array;
  }) => Promise<undefined>;
}

/**
 * Installs WASM code to a canister
 * 
 * @param agent An authenticated HttpAgent
 * @param canisterId The target canister ID as a Principal
 * @param wasmModule The WASM binary module to install
 * @param initArgs Optional initialization arguments for the canister
 * @returns A promise that resolves when the code is installed
 */
export async function installCode(
  agent: HttpAgent,
  canisterId: Principal,
  wasmModule: Uint8Array,
  initArgs?: any
): Promise<void> {
  try {
    console.log(`Installing code to canister ${canisterId.toText()}...`);

    // Create management canister actor
    const management = Actor.createActor<ManagementCanister>(managementCanisterIdl, {
      agent,
      canisterId: Principal.fromText('aaaaa-aa'), // Management canister ID
    });

    let arg = new Uint8Array();

    // If init arguments provided, encode them
    if (initArgs) {
      try {
        // Using candid to encode the arguments
        // You'd typically use a specific IDL for your canister's init args
        // This is a generic approach - might need adjustment for specific token types
        const encodedArgs = IDL.encode([IDL.Record(getInitArgsSchema())], [initArgs]);
        arg = new Uint8Array(encodedArgs);
        console.log('Encoded initialization arguments:', arg);
      } catch (encodeError) {
        console.error('Failed to encode init arguments:', encodeError);
        throw new Error(`Argument encoding failed: ${encodeError.message}`);
      }
    }

    // Install the code
    await management.install_code({
      mode: { install: null }, // For fresh install. Use { upgrade: null } for upgrades
      canister_id: canisterId,
      wasm_module: wasmModule,
      arg
    });

    console.log(`Successfully installed code to canister ${canisterId.toText()}`);
  } catch (error) {
    console.error('Error installing code:', error);
    throw new Error(`Failed to install code: ${error.message}`);
  }
}

/**
 * Creates a schema for token initialization arguments
 * Adjust this based on your token's specific init args
 */
function getInitArgsSchema() {
  return {
    name: IDL.Text,
    ticker: IDL.Text,
    total_supply: IDL.Nat,
    logo: IDL.Text,
    decimals: IDL.Nat8,
    transfer_fee: IDL.Nat,
    archive_options: IDL.Opt(IDL.Record({
      num_blocks_to_archive: IDL.Nat64,
      trigger_threshold: IDL.Nat64,
      max_message_size_bytes: IDL.Opt(IDL.Nat64),
      cycles_for_archive_creation: IDL.Opt(IDL.Nat64),
      node_max_memory_size_bytes: IDL.Opt(IDL.Nat64),
      controller_id: IDL.Principal
    })),
    initial_block_reward: IDL.Nat,
    block_time_target_seconds: IDL.Nat,
    halving_interval: IDL.Nat
  };
} 
