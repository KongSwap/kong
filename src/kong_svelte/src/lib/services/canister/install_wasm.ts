import { Principal } from "@dfinity/principal";
import { IDL } from "@dfinity/candid";
import { inflate } from "pako";
import { auth } from "../auth";
import { idlFactory as icManagementIdlFactory } from "./ic-management.idl";
import { getWalletIdentity } from "$lib/utils/wallet";
import { ICManagementCanister } from "@dfinity/ic-management";
import { createAgent } from "@dfinity/utils";
import { initializePNP, pnp } from "../pnp/PnpInitializer";
import { HttpAgent } from "@dfinity/agent";
import type { PNP } from "@windoge98/plug-n-play";
import { getPnpInstance } from '../pnp/PnpInitializer';

let icManagementActor = null;
let globalPnp: PNP | null = null;

export interface WasmMetadata {
    path: string;
    compressedPath?: string;
    description: string;
    initArgsType?: any;
    wasmModule?: Uint8Array;
    initArgs?: any;
}

export const IC_MANAGEMENT_CANISTER_ID = "aaaaa-aa";

export async function getICManagementActor() {
  console.log("getICManagementActor called");
  
  // If we have a cached actor, return it
  if (icManagementActor) {
    return icManagementActor;
  }
  
  // Try to get identity
  try {
    const pnp = getPnpInstance();
    console.log("PNP provider:", pnp?.provider);
    
    // Try to extract identity from provider (found in the log)
    if (pnp?.provider?.authClient?._identity) {
      console.log("Found identity in provider.authClient._identity");
      const identity = pnp.provider.authClient._identity;
      
      // Define host based on network
      const HOST = process.env.DFX_NETWORK === "local" ? "http://localhost:4943" : "https://icp0.io";
      
      // Create agent using the found identity
      const agent = await createAgent({
        identity,
        host: HOST,
        fetchRootKey: process.env.DFX_NETWORK === "local",
      });
      
      // Create management canister
      icManagementActor = ICManagementCanister.create({ agent });
      return icManagementActor;
    }
    
    // If provider has agent, use it directly
    if (pnp?.provider?.agent) {
      console.log("Using provider agent directly");
      const agent = pnp.provider.agent;
      icManagementActor = ICManagementCanister.create({ agent });
      return icManagementActor;
    }
  } catch (error) {
    console.error("Error setting up management actor:", error);
  }
  
  throw new Error("Authentication required. Please log in to a wallet before using the management canister.");
}

export const agent = null; // This will be replaced by the agent created in getICManagementActor

export class InstallService {
    /**
     * Installs a WASM module on a canister
     * @param canisterId - The target canister ID
     * @param wasmMetadata - Metadata about the WASM module to install
     * @param initArgs - Optional initialization arguments
     * @returns Promise<void>
     */
    public static async installWasm(
        canisterId: string,
        wasmMetadata: WasmMetadata,
        initArgs?: any
    ): Promise<void> {
        try {
            console.log("Installing WASM for canister:", canisterId);
            console.log("WASM metadata:", JSON.stringify(wasmMetadata, null, 2));
            
            // Use provided wasmModule or fetch it
            const wasmModule = wasmMetadata.wasmModule || 
                await InstallService.fetchWasmModule(wasmMetadata);
            
            // Validate the WASM module
            if (!wasmModule) {
                console.error("WASM module is undefined!");
                throw new Error("Failed to load WASM module: Module is undefined");
            }
            
            console.log("WASM module loaded, byte length:", wasmModule.length);
            
            // Get the management canister actor
            const management = await getICManagementActor();
            console.log("Management actor obtained:", management);

            // Encode init args if present
            const arg = InstallService.encodeInitArgs(
                wasmMetadata.initArgsType, 
                wasmMetadata.initArgs || initArgs
            );
            
            console.log("Encoded init args length:", arg.length);
            console.log("Calling installCode with parameters:", {
                canister_id: canisterId,
                wasm_module_length: wasmModule?.length,
                mode: "install", 
                arg_length: arg.length
            });

            // Install the WASM
            await management.installCode({
                canisterId: Principal.fromText(canisterId),
                wasmModule: Array.from(wasmModule),
                mode: { install: null },
                arg: Array.from(arg),
                sender_canister_version: []
            });
            
            console.log("WASM installation successful!");
        } catch (error) {
            console.error("WASM installation error:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('out of cycles')) {
                throw new Error('Insufficient cycles. Please top up your canister and try again.');
            }
            throw error;
        }
    }

    /**
     * Installs a WASM module on a canister using chunked upload for large files
     */
    public static async installWasmChunked(
        canisterId: string,
        wasmMetadata: WasmMetadata,
        initArgs?: any,
        chunkSize: number = 1048576 // 1MB chunks (maximum allowed by IC)
    ): Promise<void> {
        try {
            console.log("Installing large WASM for canister:", canisterId);
            
            const wasmModule = wasmMetadata.wasmModule || 
                await InstallService.fetchWasmModule(wasmMetadata);
            
            if (!wasmModule) {
                throw new Error("Failed to load WASM module: Module is undefined");
            }
            
            console.log("WASM module loaded, byte length:", wasmModule.length);
            
            const management = await getICManagementActor();
            const canisterPrincipal = Principal.fromText(canisterId);
            
            // Upload chunks
            let offset = 0;
            const totalChunks = Math.ceil(wasmModule.length / chunkSize);
            console.log(`Uploading WASM in ${totalChunks} chunks of ~${chunkSize/1024/1024}MB each`);
            
            while (offset < wasmModule.length) {
                const chunk = wasmModule.slice(offset, offset + chunkSize);
                const chunkNumber = Math.floor(offset / chunkSize) + 1;
                console.log(`Uploading chunk ${chunkNumber}/${totalChunks}: ${offset} to ${offset + chunk.length} bytes`);
                
                await management.uploadChunk({
                    canisterId: canisterPrincipal,
                    chunk: Array.from(chunk)
                });
                
                offset += chunk.length;
                console.log(`Uploaded ${offset}/${wasmModule.length} bytes (${Math.round(offset/wasmModule.length*100)}%)`);
            }
            
            // Install from chunks
            const arg = InstallService.encodeInitArgs(
                wasmMetadata.initArgsType, 
                wasmMetadata.initArgs || initArgs
            );
            
            console.log("Installing from chunks");
            await management.installCode({
                canisterId: canisterPrincipal,
                wasmModule: [], // Empty array signals to use the uploaded chunks
                mode: { install: null },
                arg: Array.from(arg),
                sender_canister_version: []
            });
            
            console.log("WASM installation successful!");
        } catch (error) {
            console.error("Chunked WASM installation error:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('out of cycles')) {
                throw new Error('Insufficient cycles. Please top up your canister and try again.');
            }
            throw error;
        }
    }

    /**
     * Fetches and optionally decompresses a WASM module
     */
    private static async fetchWasmModule(wasmMetadata: WasmMetadata): Promise<Uint8Array> {
        const validatePath = (path: string) => {
            if (!path.startsWith('/')) {
                throw new Error(`Invalid WASM path: ${path} - must start with '/'`);
            }
        };

        const loadWasm = async (path: string, tryDecompress: boolean = false): Promise<Uint8Array> => {
            try {
                console.log("Fetching WASM from:", path);
                const response = await fetch(path);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} - ${response.statusText}`);
                }
                
                const buffer = await response.arrayBuffer();
                console.log(`Fetched ${buffer.byteLength} bytes`);
                
                const data = new Uint8Array(buffer);
                
                // Try decompression only if requested
                if (tryDecompress) {
                    try {
                        console.log("Attempting to decompress WASM file...");
                        const decompressed = inflate(data);
                        console.log("Decompression successful, size:", decompressed.length);
                        return decompressed;
                    } catch (decompressError) {
                        console.log("File is not compressed or decompression failed:", decompressError);
                        // If decompression fails, return the original data
                        // This handles cases where the file might have .gz extension but isn't actually compressed
                        return data;
                    }
                }
                
                return data;
            } catch (error) {
                console.error(`Failed to load WASM:`, error);
                throw error;
            }
        };

        try {
            // If we have a wasmModule already, use it
            if (wasmMetadata.wasmModule) {
                console.log("Using provided WASM module");
                return wasmMetadata.wasmModule;
            }
            
            let wasm: Uint8Array | null = null;
            
            // Try compressed path first if available
            if (wasmMetadata.compressedPath) {
                validatePath(wasmMetadata.compressedPath);
                try {
                    wasm = await loadWasm(wasmMetadata.compressedPath, true);
                } catch (error) {
                    console.warn("Failed to load compressed WASM, falling back to uncompressed:", error);
                }
            }
            
            // If compressed path failed or doesn't exist, try uncompressed
            if (!wasm && wasmMetadata.path) {
                validatePath(wasmMetadata.path);
                wasm = await loadWasm(wasmMetadata.path, false);
            }
            
            if (!wasm || wasm.length === 0) {
                throw new Error("Failed to load WASM: Empty or missing WASM file");
            }
            
            return wasm;
        } catch (error) {
            console.error("WASM loading failed:", error);
            throw new Error(`Failed to load WASM: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Encodes initialization arguments for the WASM module
     */
    private static encodeInitArgs(initArgsType: any, initArgs: any): Uint8Array {
        if (!initArgsType || !initArgs) {
            return new Uint8Array();
        }

        try {
            const candidArgs = InstallService.convertToCandidArgs(initArgs);
            return new Uint8Array(IDL.encode([initArgsType], [candidArgs]));
        } catch (error) {
            console.error('Failed to encode init args:', error);
            throw new Error(`Failed to encode initialization arguments: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Converts JavaScript arguments to Candid format
     */
    private static convertToCandidArgs(args: any): any {
        if (Array.isArray(args)) {
            return args.map(arg => InstallService.convertToCandidArgs(arg));
        } else if (typeof args === 'bigint') {
            // Handle BigInt values directly - no conversion needed for Candid
            return args;
        } else if (typeof args === 'object' && args !== null) {
            const result: any = {};
            for (const [key, value] of Object.entries(args)) {
                result[key] = InstallService.convertToCandidArgs(value);
            }
            return result;
        }
        return args;
    }
}
