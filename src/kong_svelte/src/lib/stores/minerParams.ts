import { writable } from 'svelte/store';
import type { MinerType, MinerInitArgs } from '../../../declarations/miner/miner.did';

// Define an extended interface that includes the token canister ID
interface ExtendedMinerParams extends MinerInitArgs {
  minerType: MinerType;
  tokenCanisterId?: string; // Optional token canister ID for automatic connection
}

// Default values for miner parameters
const defaultMinerParams: ExtendedMinerParams = {
  owner: null, // Will be set by the backend
  minerType: { Normal: null }, // Default to Normal miner type
  tokenCanisterId: undefined, // No token by default
};

function createMinerParamsStore() {
  const { subscribe, set, update } = writable<ExtendedMinerParams>(defaultMinerParams);

  return {
    subscribe,
    set,
    update,
    // Set individual fields
    setOwner: (owner: any) => update(params => ({ ...params, owner })),
    setMinerType: (minerType: MinerType) => update(params => ({ ...params, minerType })),
    setTokenCanisterId: (tokenCanisterId: string | undefined) => update(params => ({ ...params, tokenCanisterId })),
    
    // Reset to default values
    reset: () => set(defaultMinerParams)
  };
}

// Create and export the store
export const minerParams = createMinerParamsStore(); 
