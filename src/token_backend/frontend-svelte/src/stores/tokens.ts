import { writable } from 'svelte/store';

interface TokenMetrics {
    market_cap: string;
    previous_price: string;
    price: string;
    price_change_24h: string | null;
    token_id: number;
    total_supply: string;
    tvl: string;
    updated_at: string;
    volume_24h: string;
}

export interface TokenInfo {
    address: string | null;
    canister_id: string;
    decimals: number;
    fee: number;
    fee_fixed: string;
    has_custom_logo: boolean;
    icrc1: boolean;
    icrc2: boolean;
    icrc3: boolean;
    is_removed: boolean;
    logo_url: string;
    metrics: TokenMetrics;
    name: string;
    symbol: string;
    token_id: number;
    token_type: string;
}

interface TokenStore {
    tokens: TokenInfo[];
    isLoading: boolean;
    error: string | null;
}

function createTokenStore() {
    const { subscribe, set, update } = writable<TokenStore>({
        tokens: [],
        isLoading: false,
        error: null
    });

    return {
        subscribe,
        fetchTokens: async () => {
            update(store => ({ ...store, isLoading: true, error: null }));
            try {
                const response = await fetch('https://api.kongswap.io/api/tokens');
                if (!response.ok) {
                    throw new Error('Failed to fetch tokens');
                }
                const data = await response.json();
                update(store => ({
                    ...store,
                    tokens: data.items,
                    isLoading: false
                }));
            } catch (error) {
                console.error('Error fetching tokens:', error);
                update(store => ({
                    ...store,
                    error: error instanceof Error ? error.message : 'Failed to fetch tokens',
                    isLoading: false
                }));
            }
        },
        getCanisterIdBySymbol: (symbol: string) => {
            let result: string | null = null;
            subscribe(store => {
                const token = store.tokens.find(t => t.symbol === symbol);
                if (token) {
                    result = token.canister_id;
                }
            })();
            return result;
        },
        reset: () => {
            set({ tokens: [], isLoading: false, error: null });
        }
    };
}

export const tokenStore = createTokenStore(); 
