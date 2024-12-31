declare global {
  namespace BE {
    interface ICToken {
      symbol: string;
      fee: number;
      fee_fixed: bigint;
      decimals: number;
      token: string;
      token_id: number;
      chain: string;
      name: string;
      canister_id: string;
      address: string;  
      icrc1: boolean;
      icrc2: boolean;
      icrc3: boolean;
      pool_symbol: string;
      on_kong: boolean;
    }
  
    interface LPToken {
      address: string;
      chain: string;
      decimals: number;
      fee: bigint;
      name: string;
      on_kong: boolean;
      pool_id_of: number;
      pool_symbol: string;
      symbol: string;
      token: string;
      token_id: number;
      total_supply: bigint;
    }
  
    type Token = { IC?: ICToken, LP?: LPToken };
  
    interface Pool {
      address_0: string;
      address_1: string;
      symbol_0: string;
      symbol_1: string;
      amount_0: string;
      amount_1: string;
      price: number;
      tvl: string;
      rolling_24h_volume: string;
      rolling_24h_apy: string;
    }
  }
}

export {};
