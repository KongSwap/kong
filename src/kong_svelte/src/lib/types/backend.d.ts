declare global {
  namespace BE {

    interface IcrcToken {
      canister_id: string;
      address: string;
      name: string;
      symbol: string;
      fee: number;
      fee_fixed: string;
      decimals: number;
      token_type: string;
      token_id: number;
      chain: string;
      icrc1: boolean;
      icrc2: boolean;
      icrc3: boolean;
      pool_symbol: string;
      pools: any[];
      metrics: TokenMetrics;
      logo_url: string;
      timestamp?: number;
      isFavorite?: boolean;
    }

    interface LPToken {
      address: string;
      chain: string;
      decimals: number;
      fee: bigint;
      name: string;
      pool_id_of: number;
      pool_symbol: string;
      symbol: string;
      token: string;
      token_id: number;
      total_supply: bigint;
    }
  
  }
}

export {};
