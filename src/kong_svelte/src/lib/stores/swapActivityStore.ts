import { writable } from 'svelte/store';

export interface SwapEvent {
    blockNumber: string;
    blockTimestamp: number;
    eventIndex: string;
    eventType: string;
    maker: string;
    pairId: string;
    priceNative: number;
    reserves: {
        asset0: number;
        asset1: number;
    };
    txnId: number;
    txnIndex: string;
    asset0In?: number;
    asset1Out?: number;
}

function createSwapActivityStore() {
    const { subscribe, set, update } = writable<SwapEvent[]>([]);

    return {
        subscribe,
        set,
        update,
        addSwap: (swap: SwapEvent) => {
            update(swaps => {
                // Keep only the latest 50 swaps
                const newSwaps = [swap, ...swaps].slice(0, 50);
                return newSwaps;
            });
        },
        clear: () => set([])
    };
}

export const swapActivityStore = createSwapActivityStore();
