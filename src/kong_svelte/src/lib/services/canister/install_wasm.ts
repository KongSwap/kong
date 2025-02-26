import { Principal } from "@dfinity/principal";
import { ICManagementCanister } from "@dfinity/ic-management";
import { IDL } from "@dfinity/candid";
import { inflate } from "pako";
import { auth } from "../auth";

export interface WasmMetadata {
    path: string;
    compressedPath?: string;
    description: string;
    initArgsType?: any;
}

export const IC_MANAGEMENT_CANISTER_ID = "aaaaa-aa";

export async function getICManagementActor() {
  let actor = await auth.getActor(IC_MANAGEMENT_CANISTER_ID, ICManagementCanister);
  return actor;
}

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
            // Fetch and decompress WASM
            const wasmModule = await InstallService.fetchWasmModule(wasmMetadata);
            
            // Get the management canister actor
            const management = await getICManagementActor();

            // Encode init args if present
            const arg = InstallService.encodeInitArgs(wasmMetadata.initArgsType, initArgs);

            // Install the WASM
            await management.installCode({
                canisterId: Principal.fromText(canisterId),
                wasmModule,
                mode: { install: null },
                arg
            });
        } catch (error) {
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
        if (wasmMetadata.compressedPath) {
            try {
                const compressedResponse = await fetch(wasmMetadata.compressedPath);
                if (compressedResponse.ok) {
                    const compressedData = await compressedResponse.arrayBuffer();
                    return new Uint8Array(inflate(new Uint8Array(compressedData)));
                }
            } catch (error) {
                console.warn('Failed to fetch/decompress WASM, falling back to uncompressed:', error);
            }
        }

        const response = await fetch(wasmMetadata.path);
        if (!response.ok) {
            throw new Error(`Failed to fetch WASM file: ${response.statusText}`);
        }
        return new Uint8Array(await response.arrayBuffer());
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
