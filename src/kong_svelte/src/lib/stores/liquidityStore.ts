import { writable } from 'svelte/store';

interface LiquidityState {
    token0: Kong.Token | null;
    token1: Kong.Token | null;
    amount0: string;
    amount1: string;
    initialPrice: string;
    needsAllowance0: boolean;
    needsAllowance1: boolean;
}

function createLiquidityStore() {
    const { subscribe, set, update } = writable<LiquidityState>({
        token0: null,
        token1: null,
        amount0: "",
        amount1: "",
        initialPrice: "",
        needsAllowance0: false,
        needsAllowance1: false,
    });

    return {
        subscribe,
        setToken: (index: 0 | 1, token: Kong.Token | null) => {
            update(s => ({
                ...s,
                [index === 0 ? 'token0' : 'token1']: token,
            }));
        },
        setAmount: (index: 0 | 1, amount: string) => {
            update(s => ({
                ...s,
                [index === 0 ? 'amount0' : 'amount1']: amount
            }));
        },
        setInitialPrice: (price: string) => {
            update(s => ({
                ...s,
                initialPrice: price
            }));
        },
        setNeedsAllowance: (index: 0 | 1, needsAllowance: boolean) => {
            update(s => ({
                ...s,
                [index === 0 ? 'needsAllowance0' : 'needsAllowance1']: needsAllowance
            }));
        },
        resetAmounts: () => {
            update(s => ({
                ...s,
                amount0: "",
                amount1: "",
                initialPrice: ""
            }));
        },
        reset: () => {
            set({
                token0: null,
                token1: null,
                amount0: "",
                amount1: "",
                initialPrice: "",
                needsAllowance0: false,
                needsAllowance1: false,
            });
        },
    };
}

export const liquidityStore = createLiquidityStore(); 
