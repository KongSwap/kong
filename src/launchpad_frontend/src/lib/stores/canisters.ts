import { writable } from 'svelte/store';
import type { Principal } from '@dfinity/principal';

export interface CanisterMetadata {
    id: string;
    name?: string;
    createdAt: number;
    controller: string;
    tags?: string[];
}

interface CanisterStore {
    canisters: CanisterMetadata[];
    addCanister: (canisterId: Principal, controller: Principal) => void;
    updateCanister: (id: string, updates: Partial<CanisterMetadata>) => void;
    removeCanister: (id: string) => void;
    getCanister: (id: string) => CanisterMetadata | undefined;
    subscribe: (run: (value: CanisterMetadata[]) => void) => () => void;
}

function createCanisterStore(): CanisterStore {
    // Initialize from localStorage if available
    const storedCanisters = typeof localStorage !== 'undefined' 
        ? JSON.parse(localStorage.getItem('canisters') || '[]')
        : [];

    const { subscribe, set, update } = writable<CanisterMetadata[]>(storedCanisters);

    // Helper to persist to localStorage
    const persist = (canisters: CanisterMetadata[]) => {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('canisters', JSON.stringify(canisters));
        }
    };

    return {
        canisters: storedCanisters,
        subscribe,

        addCanister: (canisterId: Principal, controller: Principal) => {
            update(canisters => {
                const newCanister: CanisterMetadata = {
                    id: canisterId.toText(),
                    createdAt: Date.now(),
                    controller: controller.toText(),
                };
                const updated = [...canisters, newCanister];
                persist(updated);
                return updated;
            });
        },

        updateCanister: (id: string, updates: Partial<CanisterMetadata>) => {
            update(canisters => {
                const updated = canisters.map(c => 
                    c.id === id ? { ...c, ...updates } : c
                );
                persist(updated);
                return updated;
            });
        },

        removeCanister: (id: string) => {
            update(canisters => {
                const updated = canisters.filter(c => c.id !== id);
                persist(updated);
                return updated;
            });
        },

        getCanister: (id: string) => {
            let found: CanisterMetadata | undefined;
            subscribe(canisters => {
                found = canisters.find(c => c.id === id);
            })();
            return found;
        }
    };
}

export const canisterStore = createCanisterStore(); 
