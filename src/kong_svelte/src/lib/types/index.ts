export namespace FE {
  export interface Token {
    token_id: number;
    name: string;
    symbol: string;
    decimals: number;
    canister_id: string;
    address: string;
    price: string;
    balance: string;
    formattedBalance: any;
    fee: number;
    token: string;
    chain: string;
    icrc1: boolean;
    icrc2: boolean;
    icrc3: boolean;
    on_kong: boolean;
    pool_symbol: string;
    pools: string[];
    fee_fixed: string;
    metrics: {
      price: string;
      market_cap: number;
      total_supply?: string;
      price_change_24h?: string;
      volume_24h?: string;
      market_cap_rank?: number;
      updated_at?: Date;
    };
  }

  export interface UserPoolBalance {
    balance: string;
    symbol_0: string;
    symbol_1: string;
  }
} 