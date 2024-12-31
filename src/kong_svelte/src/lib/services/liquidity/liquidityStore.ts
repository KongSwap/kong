import { get } from 'svelte/store';
import { livePools } from '../pools/poolStore';
import { writable } from 'svelte/store';

interface LiquidityState {
    token0: FE.Token | null;
    token1: FE.Token | null;
    amount0: string;
    amount1: string;
    initialPrice: string;
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
    pool: BE.Pool | null;
}

function createLiquidityStore() {
    const { subscribe, set, update } = writable<LiquidityState>({
        token0: null,
        token1: null,
        amount0: "",
        amount1: "",
        initialPrice: "",
        loading: false,
        error: null,
        showToken0Selector: false,
        showToken1Selector: false,
        tokenSelectorPosition: null,
        pool: null
    });

    return {
        subscribe,
        setToken: (index: 0 | 1, token: FE.Token) => {
            const pools = get(livePools);

            update(s => {
                let pool;
                if(index === 0) {
                    pool = pools.find(pool => pool.address_0 === token.address && pool.address_1 === s.token1?.address) || null;
                } else {
                    pool = pools.find(pool => pool.address_1 === token.address && pool.address_0 === s.token0?.address) || null;
                }

                return {
                    ...s,
                    [index === 0 ? 'token0' : 'token1']: token,
                    pool: pool,
                    showToken0Selector: false,
                    showToken1Selector: false
                };
            });
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
        setInitialPrice: (price: string) => {
            update(s => ({
                ...s,
                initialPrice: price
            }));
        },
        resetAmounts: () => {
            update(s => ({
                ...s,
                amount0: "",
                amount1: ""
            }));
        },
        reset: () => {
            set({
                token0: null,
                token1: null,
                amount0: "",
                amount1: "",
                initialPrice: "",
                loading: false,
                error: null,
                showToken0Selector: false,
                showToken1Selector: false,
                tokenSelectorPosition: null,
                pool: null
            });
        },
    };
}

export const liquidityStore = createLiquidityStore(); 
