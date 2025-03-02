import { Principal } from "@dfinity/principal";
import { IDL } from "@dfinity/candid";
import { ICManagementCanister } from "@dfinity/ic-management";
import { createAgent } from "@dfinity/utils";
import type { PNP } from "@windoge98/plug-n-play";
import { getPnpInstance } from '../pnp/PnpInitializer';
import pako from 'pako';

let icManagementActor = null;
let globalPnp: PNP | null = null;

export interface WasmMetadata {
    path: string;
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
     * Installs a WASM module on a canister using chunked upload
     * @param canisterId - The target canister ID
     * @param wasmMetadata - Metadata about the WASM module to install
     * @param initArgs - Optional initialization arguments
     * @param chunkSize - Size of chunks in bytes (default: 1MB)
     * @returns Promise<void>
     */
    public static async installWasm(
        canisterId: string,
        wasmMetadata: WasmMetadata,
        initArgs?: any,
        chunkSize: number = 1000000
    ): Promise<void> {
        try {
            console.log("Installing WASM for canister:", canisterId);
            console.log("WASM metadata:", JSON.stringify({
                path: wasmMetadata.path,
                description: wasmMetadata.description
            }, null, 2));
            
            // Fetch the WASM module
            const wasmModule = wasmMetadata.wasmModule || 
                await InstallService.fetchWasmModule(wasmMetadata);
            
            if (!wasmModule) {
                throw new Error("Failed to load WASM module: Module is undefined");
            }
            
            console.log("WASM module loaded, byte length:", wasmModule.length);
            
            const management = await getICManagementActor();
            const canisterPrincipal = Principal.fromText(canisterId);
            
            // Check if we need to compress the WASM (if it's over 2MB)
            let moduleToInstall = wasmModule;
            const MAX_DIRECT_INSTALL_SIZE = 2 * 1024 * 1024; // 2MB

            if (wasmModule.length > MAX_DIRECT_INSTALL_SIZE) {
                // Compress the WASM with gzip if it's larger than 2MB
                console.log("WASM file is larger than 2MB, compressing with gzip");
                
                // Only compress if it doesn't already have gzip header (0x1F8B08)
                const isAlreadyCompressed = wasmModule[0] === 0x1F && wasmModule[1] === 0x8B && wasmModule[2] === 0x08;
                
                if (!isAlreadyCompressed) {
                    console.log("Compressing WASM file...");
                    moduleToInstall = pako.gzip(wasmModule);
                    console.log("Compressed WASM size:", moduleToInstall.length, 
                                "Compression ratio:", (moduleToInstall.length / wasmModule.length).toFixed(2));
                } else {
                    console.log("WASM file is already compressed");
                }
                
                // If it's still too large after compression, use chunking as a fallback
                if (moduleToInstall.length > MAX_DIRECT_INSTALL_SIZE) {
                    console.log("WASM is still larger than 2MB after compression, using chunked upload");
                    return await InstallService.installWasmChunked(canisterId, moduleToInstall, wasmMetadata, initArgs, chunkSize);
                }
            }
            
            // Install the WASM (compressed or not)
            const arg = InstallService.encodeInitArgs(
                wasmMetadata.initArgsType, 
                wasmMetadata.initArgs || initArgs
            );
            
            console.log("Installing WASM directly, size:", moduleToInstall.length);
            await management.installCode({
                canisterId: canisterPrincipal,
                wasmModule: moduleToInstall,
                mode: { install: null },
                arg: arg,
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
     * Upgrades a WASM module on a canister using chunked upload
     * @param canisterId - The target canister ID
     * @param wasmMetadata - Metadata about the WASM module to upgrade to
     * @param chunkSize - Size of chunks in bytes (default: 1MB)
     * @returns Promise<void>
     */
    public static async upgradeWasm(
        canisterId: string,
        wasmMetadata: WasmMetadata,
        chunkSize: number = 1000000
    ): Promise<void> {
        try {
            console.log("Upgrading WASM for canister:", canisterId);
            console.log("WASM metadata:", JSON.stringify({
                path: wasmMetadata.path,
                description: wasmMetadata.description
            }, null, 2));
            
            // Fetch the WASM module
            const wasmModule = wasmMetadata.wasmModule || 
                await InstallService.fetchWasmModule(wasmMetadata);
            
            if (!wasmModule) {
                throw new Error("Failed to load WASM module: Module is undefined");
            }
            
            console.log("WASM module loaded, byte length:", wasmModule.length);
            
            const management = await getICManagementActor();
            const canisterPrincipal = Principal.fromText(canisterId);
            
            // Check if we need to compress the WASM (if it's over 2MB)
            let moduleToInstall = wasmModule;
            const MAX_DIRECT_INSTALL_SIZE = 2 * 1024 * 1024; // 2MB

            if (wasmModule.length > MAX_DIRECT_INSTALL_SIZE) {
                // Compress the WASM with gzip if it's larger than 2MB
                console.log("WASM file is larger than 2MB, compressing with gzip");
                
                // Only compress if it doesn't already have gzip header (0x1F8B08)
                const isAlreadyCompressed = wasmModule[0] === 0x1F && wasmModule[1] === 0x8B && wasmModule[2] === 0x08;
                
                if (!isAlreadyCompressed) {
                    console.log("Compressing WASM file...");
                    moduleToInstall = pako.gzip(wasmModule);
                    console.log("Compressed WASM size:", moduleToInstall.length, 
                                "Compression ratio:", (moduleToInstall.length / wasmModule.length).toFixed(2));
                } else {
                    console.log("WASM file is already compressed");
                }
                
                // If it's still too large after compression, use chunking as a fallback
                if (moduleToInstall.length > MAX_DIRECT_INSTALL_SIZE) {
                    console.log("WASM is still larger than 2MB after compression, using chunked upload");
                    return await InstallService.upgradeWasmChunked(canisterId, moduleToInstall, chunkSize);
                }
            }
            
            // Empty arg for upgrade - no init args needed
            const arg = new Uint8Array();
            
            console.log("Upgrading WASM directly, size:", moduleToInstall.length);
            await management.installCode({
                canisterId: canisterPrincipal,
                wasmModule: moduleToInstall,
                mode: { upgrade: [] },
                arg: arg,
                sender_canister_version: []
            });
            
            console.log("WASM upgrade successful!");
        } catch (error) {
            console.error("WASM upgrade error:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('out of cycles')) {
                throw new Error('Insufficient cycles. Please top up your canister and try again.');
            }
            throw error;
        }
    }

    /**
     * Upgrades a WASM module on a canister using chunked upload
     * @param canisterId - The target canister ID
     * @param wasmModule - The WASM module to upgrade to
     * @param chunkSize - Size of chunks in bytes (default: 1MB)
     * @returns Promise<void>
     */
    private static async upgradeWasmChunked(
        canisterId: string,
        wasmModule: Uint8Array,
        chunkSize: number = 1000000
    ): Promise<void> {
        // Clear existing chunk store
        await InstallService.clearChunkStore(canisterId);
        
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
            
            // Convert to Array for proper serialization
            await management.uploadChunk({
                canisterId: canisterPrincipal,
                chunk: Array.from(chunk) // Convert Uint8Array to number[]
            });
            
            offset += chunk.length;
            console.log(`Uploaded ${offset}/${wasmModule.length} bytes (${Math.round(offset/wasmModule.length*100)}%)`);
        }
        
        // Install from chunks with upgrade mode
        const arg = new Uint8Array(); // Empty arg for upgrade
        
        console.log("Upgrading from chunks");
        await management.installCode({
            canisterId: canisterPrincipal,
            wasmModule: [], // Empty array signals to use the uploaded chunks
            mode: { upgrade: [] }, // Use empty array for upgrade mode
            arg: arg,
            sender_canister_version: []
        });
        
        console.log("Chunked WASM upgrade successful!");
    }

    // Move chunking logic to a separate method
    private static async installWasmChunked(
        canisterId: string,
        wasmModule: Uint8Array,
        wasmMetadata: WasmMetadata,
        initArgs?: any,
        chunkSize: number = 1000000
    ): Promise<void> {
        // Clear existing chunk store
        await InstallService.clearChunkStore(canisterId);
        
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
            
            // Convert to Array for proper serialization
            await management.uploadChunk({
                canisterId: canisterPrincipal,
                chunk: Array.from(chunk) // Convert Uint8Array to number[]
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
            arg: arg,
            sender_canister_version: []
        });
        
        console.log("Chunked WASM installation successful!");
    }
    
    /**
     * Fetches a WASM module
     */
    private static async fetchWasmModule(wasmMetadata: WasmMetadata): Promise<Uint8Array> {
        try {
            const response = await fetch(wasmMetadata.path);
            console.log('WASM fetch response:', response.status, response.statusText);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`);
            }
            
            const buffer = await response.arrayBuffer();
            console.log('WASM buffer size:', buffer.byteLength);
            
            const wasmBytes = new Uint8Array(buffer);
            
            // Log if the file is already gzipped (gzip header is 0x1F, 0x8B, 0x08)
            if (wasmBytes.length > 2 && wasmBytes[0] === 0x1F && wasmBytes[1] === 0x8B && wasmBytes[2] === 0x08) {
                console.log('Fetched WASM is already gzip compressed');
            }
            
            return wasmBytes;
        } catch (error) {
            console.error('WASM fetch failed:', error);
            throw error;
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

    /**
     * Clears the chunk store for a canister
     * @param canisterId - The target canister ID
     */
    public static async clearChunkStore(canisterId: string): Promise<void> {
        try {
            console.log("Clearing chunk store for canister:", canisterId);
            
            const management = await getICManagementActor();
            
            await management.clearChunkStore({
                canisterId: Principal.fromText(canisterId)
            });
            
            console.log("Chunk store cleared successfully");
        } catch (error) {
            console.error("Failed to clear chunk store:", error);
            throw error;
        }
    }
}
