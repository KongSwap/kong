import { Principal } from '@dfinity/principal';
import { Actor, HttpAgent } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
import { ICManagementCanister } from '@dfinity/ic-management';
import { getWalletIdentity } from '$lib/utils/wallet';

/**
 * Installs WASM code to a canister using the IC Management Canister
 * 
 * @param pnp The Plug-n-Play instance
 * @param canisterId The target canister ID as a Principal
 * @param wasmModule The WASM binary module to install
 * @param initArgs Optional initialization arguments for the canister
 * @param mode Installation mode ('install', 'reinstall', or 'upgrade')
 * @returns A promise that resolves when the code is installed
 */
export async function installWasm(
  pnp: any,
  canisterId: Principal,
  wasmModule: Uint8Array,
  initArgs?: any,
  mode: 'install' | 'reinstall' | 'upgrade' = 'install'
): Promise<void> {
  try {
    console.log(`Installing WASM to canister ${canisterId.toText()} using mode: ${mode}`);
    
    // Get identity from wallet
    const identity = getWalletIdentity(pnp);
    if (!identity) {
      throw new Error("No identity found in wallet. Please connect your wallet first.");
    }

    // Create authenticated agent
    const agent = new HttpAgent({
      host: 'https://icp0.io',
      identity: identity
    });

    // Create IC Management Canister actor
    const management = ICManagementCanister.create({
      agent,
    });

    // Encode initArgs if provided
    let arg = new Uint8Array();
    if (initArgs) {
      try {
        // Convert argument to Candid format
        const schema = getInitArgsSchema();
        const encoded = IDL.encode([IDL.Record(schema)], [initArgs]);
        arg = new Uint8Array(encoded);
        console.log('Encoded initialization arguments with schema:', schema);
      } catch (error) {
        console.error('Failed to encode initialization arguments:', error);
        throw new Error(`Failed to encode arguments: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Determine install mode
    const installMode = { 
      [mode]: null 
    };

    // Call the IC Management Canister to install the code
    await management.installCode({
      canisterId: canisterId,
      wasmModule: wasmModule,
      mode: installMode,
      arg: arg
    });

    console.log(`Successfully installed WASM to canister ${canisterId.toText()}`);
  } catch (error) {
    console.error('Error installing WASM:', error);
    throw new Error(`Failed to install WASM: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Creates a schema for token initialization arguments
 * This schema matches the token_backend canister's init args structure
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

/**
 * Loads a WASM module from a URL
 * 
 * @param url The URL to fetch the WASM module from
 * @returns The WASM module as a Uint8Array
 */
export async function loadWasmModule(url: string): Promise<Uint8Array> {
  try {
    console.log(`Fetching WASM module from ${url}...`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM module: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error('Error loading WASM module:', error);
    throw new Error(`Failed to load WASM module: ${error instanceof Error ? error.message : String(error)}`);
  }
} 
