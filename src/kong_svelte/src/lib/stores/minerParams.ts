import { writable } from 'svelte/store';
import type { MinerType, MinerInitArgs } from '../../../declarations/miner/miner.did';

// Default values for miner parameters
const defaultMinerParams: MinerInitArgs & { minerType: MinerType } = {
  owner: null, // Will be set by the backend
  minerType: { Normal: null }, // Default to Normal miner type
};

function createMinerParamsStore() {
  const { subscribe, set, update } = writable<MinerInitArgs & { minerType: MinerType }>(defaultMinerParams);

  return {
    subscribe,
    set,
    update,
    // Set individual fields
    setOwner: (owner: any) => update(params => ({ ...params, owner })),
    setMinerType: (minerType: MinerType) => update(params => ({ ...params, minerType })),
    
    // Reset to default values
    reset: () => set(defaultMinerParams)
  };
}

export const minerParams = createMinerParamsStore(); 
