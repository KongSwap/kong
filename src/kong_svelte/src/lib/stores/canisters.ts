import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export interface CanisterMetadata {
  id: string;
  name?: string;
  tags?: string[];
  createdAt: number;
  wasmType?: string;
  wasmVersion?: number;
  hidden?: boolean;
}

const STORAGE_KEY = 'kong_canisters';

function createCanisterStore() {
  // Initialize with empty array or stored data
  const initialCanisters = browser 
    ? JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') 
    : [];
  
  const { subscribe, update } = writable<CanisterMetadata[]>(initialCanisters);

  return {
    subscribe,
    
    addCanister(canister: CanisterMetadata) {
      update(canisters => {
        // Check if canister already exists
        if (canisters.some(c => c.id === canister.id)) {
          return canisters;
        }
        
        const updatedCanisters = [...canisters, canister];
        if (browser) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCanisters));
        }
        return updatedCanisters;
      });
    },
    
    updateCanister(id: string, updates: Partial<CanisterMetadata>) {
      update(canisters => {
        const updatedCanisters = canisters.map(canister => 
          canister.id === id 
            ? { ...canister, ...updates } 
            : canister
        );
        
        if (browser) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCanisters));
        }
        return updatedCanisters;
      });
    },
    
    hideCanister(id: string) {
      this.updateCanister(id, { hidden: true });
    },
    
    showCanister(id: string) {
      this.updateCanister(id, { hidden: false });
    },
    
    removeCanister(id: string) {
      update(canisters => {
        const updatedCanisters = canisters.filter(canister => canister.id !== id);
        if (browser) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCanisters));
        }
        return updatedCanisters;
      });
    },
    
    getCanister(id: string): CanisterMetadata | undefined {
      const canisters = get({ subscribe });
      return canisters.find(canister => canister.id === id);
    }
  };
}

export const canisterStore = createCanisterStore(); 
