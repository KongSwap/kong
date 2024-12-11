import { writable } from 'svelte/store';

interface LiquidityState {
    token0: FE.Token | null;
    token1: FE.Token | null;
    amount0: string;
    amount1: string;
    loading: boolean;
    error: string | null;
    showToken0Selector: boolean;
    showToken1Selector: boolean;
    tokenSelectorPosition: {
        x: number;
        y: number;
        height: number;
        windowHeight: number;
        windowWidth: number;
    } | null;
}

function createLiquidityStore() {
    const { subscribe, set, update } = writable<LiquidityState>({
        token0: null,
        token1: null,
        amount0: "",
        amount1: "",
        loading: false,
        error: null,
        showToken0Selector: false,
        showToken1Selector: false,
        tokenSelectorPosition: null
    });

    return {
        subscribe,
        setToken: (index: 0 | 1, token: FE.Token) => {
            update(s => ({
                ...s,
                [index === 0 ? 'token0' : 'token1']: token,
                showToken0Selector: false,
                showToken1Selector: false
            }));
        },
        setAmount: (index: 0 | 1, amount: string) => {
            update(s => ({
                ...s,
                [index === 0 ? 'amount0' : 'amount1']: amount
            }));
        },
        toggleTokenSelector: (index: 0 | 1, position: any) => {
            update(s => ({
                ...s,
                showToken0Selector: index === 0,
                showToken1Selector: index === 1,
                tokenSelectorPosition: position
            }));
        },
        closeTokenSelector: () => {
            update(s => ({
                ...s,
                showToken0Selector: false,
                showToken1Selector: false,
                tokenSelectorPosition: null
            }));
        },
        setError: (error: string | null) => {
            update(s => ({ ...s, error }));
        },
        setLoading: (loading: boolean) => {
            update(s => ({ ...s, loading }));
        },
        reset: () => {
            set({
                token0: null,
                token1: null,
                amount0: "",
                amount1: "",
                loading: false,
                error: null,
                showToken0Selector: false,
                showToken1Selector: false,
                tokenSelectorPosition: null
            });
        }
    };
}

export const liquidityStore = createLiquidityStore(); 
